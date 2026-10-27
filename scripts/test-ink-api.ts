import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { fixtureDocx, fixtureOfficePart } from "./fixtures/docx";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-ink-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  NEXT_PUBLIC_APP_URL: "https://www.syaahii.in",
  TAVILY_API_KEY: "",
  BRAVE_SEARCH_API_KEY: "",
});
const origin = process.env.NEXT_PUBLIC_APP_URL!;
async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    replica = await (
      await import("mongodb-memory-server")
    ).MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  try {
    const { register, startSession } = await import("../lib/auth/server");
    const { markEmailVerified } = await import("../lib/billing/rewards");
    const { saveOrder } = await import("../lib/billing/orders");
    const { db } = await import("../lib/db");
    const { collection, mongo } = await import("../lib/storage/mongo");
    const api = await import("../app/api/ink/route");
    const rewrite = await import("../app/api/ink/rewrite/route");
    const importer = await import("../app/api/ink/import/route");
    const { officeText } = await import("../lib/intake/office");
    await assert.rejects(
      officeText(
        fixtureOfficePart(
          Buffer.from("<w:document>" + "<w:tab ".repeat(50000)),
        ),
        "docx",
      ),
      /Malformed/,
    );
    const { analyse } = await import("../lib/ink/analyse");
    const { assertPreserved } = await import("../lib/ink/rewrite");
    const { getReport } = await import("../lib/ink/store");
    const cookies: string[] = [];
    const users = [];
    for (let i = 0; i < 3; i++) {
      const user = await register(
        "Ink learner",
        `ink${i}@example.test`,
        "fixture-password-long",
      );
      users.push(user);
      await markEmailVerified(user.id);
      cookies.push(
        (await startSession(user, new Request(origin))).headers
          .get("set-cookie")!
          .split(";")[0],
      );
    }
    const req = (cookie: string, data?: unknown, query = "") =>
      new NextRequest(origin + "/api/ink" + query, {
        method: data === undefined ? "GET" : "POST",
        headers: { origin, cookie, "Content-Type": "application/json" },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    assert.equal((await api.GET(req(""))).status, 401);
    assert.equal(
      (await api.POST(req(cookies[0], { text: "not paid" }))).status,
      402,
    );
    const access = await (
      await api.GET(req(cookies[0], undefined, "?access=1"))
    ).json();
    assert.equal(
      access.entitled,
      false,
      "signup credits cannot unlock paid feature",
    );
    for (let i = 0; i < 2; i++) {
      await saveOrder(`ink-paid-${i}`, users[i].id, "try", 900, 3);
      if (replica)
        await (
          await collection("orders")
        ).updateOne(
          { _id: `ink-paid-${i}` },
          { $set: { paid: true, paymentId: `pay_fixture_${i}` } },
        );
      else
        db()
          .prepare("UPDATE orders SET paid=1,payment_id=? WHERE id=?")
          .run(`pay_fixture_${i}`, `ink-paid-${i}`);
    }
    const text =
      "Machine learning models require substantial amounts of labelled training data to generalise well. When the training set is small or biased the resulting model tends to reproduce those biases at inference time. Researchers have therefore explored semi supervised approaches that combine a small labelled set with a much larger unlabelled corpus.";
    const upload = (cookie: string, bytes: Buffer, name = "chapter.docx") => {
      const form = new FormData();
      form.set("file", new File([new Uint8Array(bytes)], name));
      return new NextRequest(origin + "/api/ink/import", {
        method: "POST",
        headers: { origin, cookie },
        body: form,
      });
    };
    assert.equal(
      (await importer.POST(upload("", fixtureDocx(text)))).status,
      401,
    );
    assert.equal(
      (await importer.POST(upload(cookies[2], fixtureDocx(text)))).status,
      402,
    );
    const docxResponse = await importer.POST(
      upload(
        cookies[0],
        fixtureDocx(text + "\nप्रमाण और संदर्भ सुरक्षित रहते हैं।"),
      ),
    );
    assert.equal(docxResponse.status, 200, await docxResponse.clone().text());
    const docxBody = await docxResponse.json();
    assert.match(docxBody.text, /Machine learning/);
    assert.match(docxBody.text, /प्रमाण/);
    assert.equal(
      (await importer.POST(upload(cookies[0], Buffer.from("not a zip"))))
        .status,
      422,
    );
    assert.equal(
      (
        await importer.POST(
          upload(cookies[0], fixtureDocx(text, "other/document.xml")),
        )
      ).status,
      422,
      "missing Word part is not a document",
    );
    assert.equal(
      (await importer.POST(upload(cookies[0], fixtureDocx("x".repeat(120001)))))
        .status,
      422,
      "complete document must not be silently truncated",
    );
    assert.equal(
      (
        await importer.POST(
          upload(cookies[0], fixtureDocx(text), "chapter.doc"),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await importer.POST(
          upload(cookies[0], Buffer.alloc(10 * 1024 * 1024 + 1)),
        )
      ).status,
      413,
    );
    const body = {
      text,
      referenceText: text,
      allowWeb: false,
      requestId: "fixture-report",
      title: "Private thesis",
    };
    const response = await api.POST(req(cookies[0], body));
    assert.equal(response.status, 200, await response.clone().text());
    const { report } = await response.json();
    assert.equal(report.comparedSources, 1);
    assert.equal(report.match.coverage, 1);
    assert.equal(report.search.status, "skipped");
    assert.equal(
      report.match.sources[0].source.text,
      "",
      "full source body not retained",
    );
    assert.equal(
      (await api.POST(req(cookies[0], body)).then((r) => r.json())).report.id,
      report.id,
    );
    assert.equal(
      (await api.GET(req(cookies[1], undefined, `?id=${report.id}`))).status,
      404,
    );
    assert.equal(
      (await api.POST(req(cookies[1], { action: "delete", id: report.id })))
        .status,
      404,
    );
    assert.equal(
      (await api.POST(req(cookies[0], { ...body, text: "x".repeat(120001) })))
        .status,
      400,
    );
    assert.equal((await api.POST(req(cookies[0], null))).status, 400);
    assert.equal(
      (await rewrite.POST(req(cookies[0], { mode: "__proto__", text }))).status,
      400,
    );
    assert.equal(
      (
        await rewrite.POST(
          req(cookies[0], { mode: "plain", text: "x".repeat(6001) }),
        )
      ).status,
      400,
    );
    // No provider credentials are present in this isolated test. Service outages
    // must be retryable 503 responses rather than blaming the learner's draft.
    for (const key of Object.keys(process.env))
      if (/API_KEY(?:_?\d+)?$/.test(key)) delete process.env[key];
    const unavailable = await rewrite.POST(
      req(cookies[0], { mode: "plain", text }),
    );
    assert.equal(unavailable.status, 503);
    assert(Number(unavailable.headers.get("retry-after")) > 0);
    const noSources = await analyse({ text, allowWeb: false });
    assert.equal(noSources.comparedSources, 0);
    assert.throws(() =>
      assertPreserved("Results: 12.5% [3].", "Results: 25% [3]."),
    );
    assertPreserved("Results: 12.5% [3].", "The result was 12.5% [3].");
    assert.throws(() =>
      assertPreserved(
        "Use `const x = 3` and $x^2$.",
        "Use `const x = 4` and $x^2$.",
      ),
    );
    if (replica)
      await (
        await collection("users")
      ).updateOne({ _id: users[1].id }, { $set: { workspace: "writer" } });
    else
      db()
        .prepare("UPDATE users SET workspace='writer' WHERE id=?")
        .run(users[1].id);
    assert.equal(
      (await api.POST(req(cookies[1], body))).status,
      403,
      "writer cannot use student entitlement",
    );
    assert.equal(
      (await api.POST(req(cookies[0], { action: "delete", id: report.id })))
        .status,
      200,
    );
    assert.equal(await getReport(users[0].id, report.id), null);
    if (replica) await (await mongo()).client.close();
    console.log(
      `PASS AI Ink ${replica ? "Mongo" : "SQLite"}: paid access, anonymous denial, private report ownership, matching evidence, repeat idempotency, input bounds, prototype-mode rejection, preservation checks, permanent deletion. No live inference.`,
    );
  } finally {
    await replica?.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
