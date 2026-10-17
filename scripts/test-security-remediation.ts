import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { fixturePdf } from "./fixtures/pdf";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-remediation-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";

async function main() {
  const { originError, endSession } = await import("../lib/auth/server");
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(
      originError(
        new Request("https://www.syaahii.in/api/user/profile", {
          method,
          headers: { cookie: "syaahi-session=test" },
        }),
      )?.status,
      403,
    );
    assert.equal(
      originError(
        new Request("https://www.syaahii.in/api/user/profile", {
          method,
          headers: { origin: "null" },
        }),
      )?.status,
      403,
    );
    assert.equal(
      originError(
        new Request("https://www.syaahii.in/api/user/profile", {
          method,
          headers: { referer: "https://www.syaahii.in/dashboard" },
        }),
      ),
      null,
    );
  }
  process.env.RAZORPAY_WEBHOOK_SECRET = "fixture-only-secret";
  const webhook = await import("../app/api/razorpay/webhook/route");
  assert.equal(
    (
      await webhook.POST(
        new NextRequest("https://www.syaahii.in/api/razorpay/webhook", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    401,
    "Headerless webhook still requires a valid HMAC",
  );
  assert.equal(
    originError(
      new Request("https://www.syaahii.in/api/razorpay/webhook", {
        method: "POST",
        headers: { cookie: "ambient" },
      }),
    )?.status,
    403,
  );
  assert.match(
    (
      await endSession(new Request("https://www.syaahii.in/api/auth/logout"))
    ).headers.get("set-cookie")!,
    /Secure/i,
  );

  const storage = await import("../lib/workspace-records");
  const mongoJobs = await import("../lib/storage/mongo-jobs");
  const documents = await import("../lib/documents/store");
  for (const bad of [{ $ne: null }, { $gt: "" }, ["id"], null, ""]) {
    await assert.rejects(storage.record(bad as any));
    await assert.rejects(storage.records("presentation", bad as any));
    await assert.rejects(mongoJobs.mongoGetJob(bad as any));
    await assert.rejects(mongoJobs.mongoList(bad as any, 20));
    await assert.rejects(documents.getDocument("owner", bad as any));
  }
  await assert.rejects(
    storage.mutateRecord(
      "x",
      () =>
        ({
          id: "x",
          owner: { $ne: null },
          kind: "test",
          updatedAt: "now",
        }) as any,
    ),
  );

  const { clientIp } = await import("../lib/ratelimit");
  process.env.TRUST_PROXY_HEADERS = "true";
  assert.equal(
    clientIp(
      new Request("https://x.test", {
        headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.5" },
      }),
    ),
    "203.0.113.5",
  );
  assert.equal(
    clientIp(
      new Request("https://x.test", {
        headers: { "x-forwarded-for": "not-an-ip" },
      }),
    ),
    "unknown",
  );
  process.env.BACKEND_PROXY_SECRET = "private-fixture-envelope";
  process.env.TRUST_PROXY_HEADERS = "false";
  assert.equal(
    clientIp(
      new Request("https://x.test", {
        headers: { "x-syaahi-client-ip": "198.51.100.1" },
      }),
    ),
    "local",
  );
  assert.equal(
    clientIp(
      new Request("https://x.test", {
        headers: {
          "x-syaahi-proxy": "private-fixture-envelope",
          "x-syaahi-client-ip": "203.0.113.8",
          "x-forwarded-for": "198.51.100.1",
        },
      }),
    ),
    "203.0.113.8",
  );

  const { middleware } = await import("../middleware");
  const a = middleware(
    new NextRequest("https://app.test/login", {
      headers: { "x-nonce": "attacker" },
    }),
  );
  const b = middleware(new NextRequest("https://app.test/login"));
  assert.notEqual(
    a.headers.get("content-security-policy"),
    b.headers.get("content-security-policy"),
  );
  const { contentSecurityPolicy } = await import("../lib/security/csp");
  const policy = contentSecurityPolicy("fixed-fixture-nonce");
  assert(
    !policy
      .split(";")
      .find((s) => s.includes("script-src "))!
      .includes("unsafe-inline"),
  );
  assert(!/(?:^|\s)(?:https:|wss:)(?:\s|;|$)/.test(policy));
  assert(!a.headers.get("content-security-policy")!.includes("attacker"));
  const health = await import("../app/api/health/route");
  const workerHealth = await import("../app/api/health/worker/route");
  for (const response of [await health.GET(), await workerHealth.GET()])
    assert.deepEqual(await response.json(), { ok: true });
  process.env.APP_ROLE = "backend";
  const unavailable = await health.GET();
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { ok: false });
  process.env.APP_ROLE = "all";

  const { renderReadingBody } = await import("../lib/pdf/document");
  for (const attack of [
    "<img src=x onerror=alert(1)>",
    "**<svg/onload=alert(1)>**",
    "`</code><script>alert(1)</script>`",
    "$\\href{javascript:alert(1)}{click}$",
    "$$\\htmlClass{evil}{<img src=x>}$$",
  ]) {
    const html = renderReadingBody(attack);
    assert(!/<script|<img|<svg|\shref=["']javascript:/i.test(html));
  }
  const { extractPdf, ExtractionError } =
    await import("../lib/documents/extract");
  process.env.PDF_MAX_CONCURRENT = "1";
  const inFlight = extractPdf(fixturePdf());
  await assert.rejects(
    extractPdf(fixturePdf()),
    (e) => e instanceof ExtractionError && e.status === 503,
  );
  await inFlight;
  let ticked = false;
  setTimeout(() => {
    ticked = true;
  }, 0);
  const parsed = await extractPdf(fixturePdf());
  assert(ticked, "PDF extraction leaves the HTTP event loop responsive");
  assert.equal(parsed.pageCount, 1);
  assert.match(parsed.pages[0].text, /normalization/);
  await assert.rejects(
    extractPdf(fixturePdf(), { timeoutMs: 1 }),
    (e) => e instanceof ExtractionError,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(extractPdf(fixturePdf(), { signal: controller.signal }));
  await assert.rejects(extractPdf(Buffer.from("%PDF-broken")));
  assert.equal(
    (await extractPdf(fixturePdf())).pageCount,
    1,
    "Failed workers release capacity",
  );
  console.log(
    "PASS security remediation: fail-closed CSRF/HMAC, secure logout, primitive selectors, trusted IPs, fresh CSP nonces, minimal health, escaped payloads and isolated bounded PDF parsing.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
