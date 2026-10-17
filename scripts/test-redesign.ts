import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-redesign-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  WORKER_MODE: "external",
  APP_ROLE: "all",
});
async function main() {
  let mongo: any;
  if (process.argv.includes("--mongo")) {
    mongo = await (
      await import("mongodb-memory-server")
    ).MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  try {
    const auth = await import("../lib/auth/server"),
      jobs = await import("../lib/jobs/store"),
      route = await import("../app/api/jobs/[id]/route");
    const { markEmailVerified } = await import("../lib/billing/rewards");
    const user = await auth.register(
        "Learner",
        "redesign@example.test",
        "fixture-password-only",
      ),
      other = await auth.register(
        "Other",
        "redesign-other@example.test",
        "fixture-password-only",
      );
    for (const u of [user, other]) await markEmailVerified(u.id);
    const cookie = async (u: any) =>
      (await auth.startSession(u, new Request("http://localhost:3192"))).headers
        .get("set-cookie")!
        .split(";")[0];
    const own = await cookie(user),
      foreign = await cookie(other);
    const job = await jobs.createJob(
      user.id,
      ["Database normalization"],
      "concise",
    );
    const call = (c: string, b: unknown) =>
      route.POST(
        new NextRequest(`http://localhost:3192/api/jobs/${job.id}`, {
          method: "POST",
          headers: {
            cookie: c,
            origin: "http://localhost:3192",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(b),
        }),
        { params: Promise.resolve({ id: job.id }) },
      );
    const appearance = {
      font: "Kalam",
      paper: "cream",
      template: "cornell",
      seed: "attacker-choice",
    };
    assert.equal(
      (
        await call(foreign, {
          action: "notebook-appearance",
          revision: 0,
          appearance,
        })
      ).status,
      404,
    );
    const saved = await call(own, {
      action: "notebook-appearance",
      revision: 0,
      appearance,
    });
    assert.equal(saved.status, 200);
    const latest = (await jobs.getJob(job.id))!;
    assert.equal(latest.pdfTemplate, "cornell");
    assert.equal(latest.notebookAppearance?.seed, job.id);
    assert.equal(latest.notebookAppearance?.version, 1);
    assert.equal(
      (
        await call(own, {
          action: "notebook-appearance",
          revision: 0,
          appearance,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call(own, {
          action: "notebook-appearance",
          revision: latest.revision,
          appearance: {
            ...appearance,
            font: "x';background:url(https://evil.test)",
          },
        })
      ).status,
      400,
    );
    assert.equal(
      auth.originError(
        new Request("https://www.syaahii.in/api/test", {
          method: "POST",
          headers: { referer: "https://evil.example/page" },
        }),
      )?.status,
      403,
    );
    assert.equal(
      auth.originError(
        new Request("https://www.syaahii.in/api/test", {
          method: "POST",
          headers: { referer: "https://www.syaahii.in/dashboard" },
        }),
      ),
      null,
    );
    const { renderDocument, renderReadingBody } =
      await import("../lib/pdf/document");
    const hostile =
      "## <img src=x onerror=alert(1)>\n**Definition:** Safe text\nDiagram: flow | <script>alert(1)</script> | Result";
    assert(!renderReadingBody(hostile).includes("<script>"));
    assert(renderReadingBody(hostile).includes("&lt;img"));
    for (const template of ["sketchnote", "bluepen", "cornell"]) {
      const html = renderDocument([{ markdown: hostile, template }]);
      assert(html.includes(`template-${template}`));
      assert(!html.includes("<img src=x"));
      assert(html.includes("document.fonts.ready"));
    }
    const { readerDefaults, validateReader } =
      await import("../lib/study/preferences");
    assert.equal(readerDefaults().mode, "notebook");
    assert.equal(
      validateReader({ ...readerDefaults(), mode: "reading" }, 1).mode,
      "reading",
    );
    const assist = await import("../app/api/reviews/assist/route");
    const feedback =
      "The explanation helped me study, but I need more worked examples.";
    const assistCall = (c: string) =>
      assist.POST(
        new Request("http://localhost:3192/api/reviews/assist", {
          method: "POST",
          headers: {
            cookie: c,
            origin: "http://localhost:3192",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: feedback }),
        }),
      );
    assert.equal((await assistCall("")).status, 401);
    assert.equal((await assistCall(own)).status, 403);
    await jobs.updateJob(job.id, { status: "done" });
    const oldFetch = globalThis.fetch;
    const oldGroq = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "fixture-not-a-real-key";
    let promptBody = "";
    globalThis.fetch = async (input, init) => {
      assert(String(input).startsWith("https://api.groq.com/"));
      promptBody = String(init?.body || "");
      return Response.json({
        id: "fixture",
        model: "fixture",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: feedback },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 20, total_tokens: 40 },
      });
    };
    try {
      const proposal = await assistCall(own);
      assert.equal(proposal.status, 200);
      assert.equal((await proposal.json()).proposal, feedback);
      assert(promptBody.includes("Preserve its meaning"));
      assert(!promptBody.includes("Database normalization"));
      assert.equal(
        (await (await import("../lib/growth/reviews")).publicReviews()).length,
        0,
      );
    } finally {
      globalThis.fetch = oldFetch;
      if (oldGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = oldGroq;
    }
    const { admitRequest } = await import("../lib/security/admission");
    process.env.API_MAX_IN_FLIGHT = "4";
    const releases = Array.from({ length: 4 }, () =>
      admitRequest(new Request("https://www.syaahii.in/api/test")),
    );
    assert(releases.every(Boolean));
    assert.equal(
      admitRequest(new Request("https://www.syaahii.in/api/test")),
      null,
    );
    assert(admitRequest(new Request("https://www.syaahii.in/api/health")));
    releases.forEach((r) => {
      r?.();
      r?.();
    });
    const next = admitRequest(new Request("https://www.syaahii.in/api/test"));
    assert(next);
    next();
    console.log(
      "PASS redesign: owned style persistence, stale-write denial, style-injection rejection, escaped notebook content, three render compositions, accessible preference compatibility and load shedding.",
    );
  } finally {
    if (mongo) {
      await (
        await (await import("../lib/storage/mongo")).mongo()
      ).client.close();
      await mongo.stop();
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
