import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-security-"));
process.env.TRUST_PROXY_HEADERS = "false";
async function main() {
  const { apiHandler } = await import("../lib/api-handler");
  const { rateLimit } = await import("../lib/ratelimit");
  const { register, startSession, currentUser, passwordHash, passwordMatches } =
    await import("../lib/auth/server");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  let called = false;
  const handler = apiHandler(async (req: Request) => {
    called = true;
    return Response.json(await req.json());
  });
  const oversized = await handler(
    new Request("https://www.syaahii.in/api/test", {
      method: "POST",
      body: '"' + "x".repeat(2 * 1024 * 1024) + '"',
    }),
  );
  assert.equal(oversized.status, 413);
  assert.equal(called, false);
  const crossSite = await handler(
    new Request("https://www.syaahii.in/api/test", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
      body: "{}",
    }),
  );
  assert.equal(crossSite.status, 403);
  const ok = await handler(
    new Request("https://www.syaahii.in/api/test", {
      method: "POST",
      headers: { origin: "https://www.syaahii.in" },
      body: '{"ok":true}',
    }),
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true });
  const route = "cookie-spoof-" + randomBytes(6).toString("hex");
  for (let i = 0; i < 3; i++) {
    const result = await rateLimit(
      new Request("https://www.syaahii.in/api/test", {
        headers: {
          cookie: `syaahi-session=${randomBytes(32).toString("hex")}`,
        },
      }),
      route,
      2,
      60000,
    );
    assert.equal(result?.status, i === 2 ? 429 : undefined);
  }
  const password = "valid-long-password-42";
  const hash = passwordHash(password);
  assert.notEqual(hash, passwordHash(password));
  assert(passwordMatches(password, hash));
  assert(!passwordMatches("wrong", hash));
  const user = await register(
    "Security test",
    "boundary@example.test",
    password,
  );
  const req = new Request("https://www.syaahii.in/api/auth");
  let session = await startSession(user, req);
  let cookie = session.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    await currentUser(new Request(req.url, { headers: { cookie } })),
    null,
    "Old unverified session rejected",
  );
  await markEmailVerified(user.id);
  session = await startSession(user, req);
  cookie = session.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await currentUser(new Request(req.url, { headers: { cookie } })))?.id,
    user.id,
  );
  assert.match(session.headers.get("set-cookie")!, /HttpOnly/i);
  assert.match(session.headers.get("set-cookie")!, /Secure/i);
  const { GET } = await import("../app/api/admin/moderation/route");
  const { NextRequest } = await import("next/server");
  assert.equal(
    (await GET(new NextRequest("https://www.syaahii.in/api/admin/moderation")))
      .status,
    401,
  );
  assert.equal(
    (
      await GET(
        new NextRequest("https://www.syaahii.in/api/admin/moderation", {
          headers: { cookie },
        }),
      )
    ).status,
    403,
  );
  const { GET: access } = await import("../app/api/admin/access/route");
  assert.equal(
    (
      await access(
        new Request("https://www.syaahii.in/api/admin/access", {
          headers: { cookie },
        }),
      )
    ).status,
    403,
  );
  process.env.ADMIN_EMAILS = user.email;
  assert.equal(
    (
      await access(
        new Request("https://www.syaahii.in/api/admin/access", {
          headers: { cookie },
        }),
      )
    ).status,
    200,
  );
  console.log(
    "PASS: actual body limit, CSRF, forged-cookie throttling, password hashing, verified sessions and admin API denial.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
