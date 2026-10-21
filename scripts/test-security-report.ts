import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-report-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";
process.env.NEXT_PUBLIC_APP_URL = "https://www.syaahii.in";
process.env.BACKEND_PROXY_SECRET = "fixture-measurement-signing-secret";
for (const key of Object.keys(process.env))
  if (/SUPABASE/.test(key)) delete process.env[key];
const origin = "https://www.syaahii.in";
function request(path: string, body: unknown, cookie = "") {
  return new NextRequest(origin + path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}
async function main() {
  const { register } = await import("../lib/auth/server"),
    { POST: auth } = await import("../app/api/auth/route"),
    { hostedEmailConfirmed, resendHostedVerification } =
      await import("../lib/auth/hosted-verification"),
    { rewardSummary } = await import("../lib/billing/rewards");
  const password = "fixture-verified-password";
  const user = await register(
    "Native verified learner",
    "native@example.test",
    password,
  );
  const input = {
    mode: "login",
    email: user.email,
    password,
    acceptTerms: true,
    termsVersion: "2026-10-03",
  };
  const missing = await auth(
    request("/api/auth", {
      ...input,
      email: "missing@example.test",
      password: "wrong-password-long",
    }),
  );
  const wrong = await auth(
    request("/api/auth", { ...input, password: "wrong-password-long" }),
  );
  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(await missing.json(), await wrong.json());
  const duplicate = await auth(
    request("/api/auth", { ...input, mode: "signup" }),
  );
  assert.equal(duplicate.status, 202);
  assert.equal(duplicate.headers.get("set-cookie"), null);
  const savedFetch = globalThis.fetch;
  let confirmedEmail = user.email,
    confirmed = true,
    resend = false;
  const identity = () => ({
    id: randomUUID(),
    aud: "authenticated",
    role: "authenticated",
    email: confirmedEmail,
    email_confirmed_at: confirmed ? new Date().toISOString() : undefined,
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  });
  process.env.SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
  const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: randomUUID(), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "fixture.supabase.co");
    if (url.pathname.endsWith("/token"))
      return Response.json({
        access_token: jwt,
        refresh_token: "fixture-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: identity(),
      });
    if (url.pathname.endsWith("/user")) return Response.json(identity());
    if (url.pathname.endsWith("/resend")) {
      resend = true;
      return Response.json({});
    }
    return new Response(null, { status: 204 });
  };
  try {
    assert(await hostedEmailConfirmed(user.email, password));
    confirmedEmail = "another@example.test";
    assert.equal(
      await hostedEmailConfirmed(user.email, password),
      false,
      "Mismatched hosted identity cannot verify a local account",
    );
    confirmedEmail = user.email;
    confirmed = false;
    assert.equal(
      await hostedEmailConfirmed(user.email, password),
      false,
      "An unconfirmed hosted identity is insufficient",
    );
    confirmed = true;
    assert(await resendHostedVerification(user.email));
    assert(resend);
    const login = await auth(request("/api/auth", input));
    assert.equal(login.status, 200);
    assert(login.headers.get("set-cookie")?.includes("syaahi-session="));
    assert((await rewardSummary(user.id)).emailVerified);
  } finally {
    globalThis.fetch = savedFetch;
  }
  const { POST: consent } = await import("../app/api/growth/consent/route"),
    { POST: event } = await import("../app/api/growth/events/route"),
    { metricsReport } = await import("../lib/growth/metrics");
  const fake = `syaahi-measurement=1; syaahi-visitor=${randomUUID()}`;
  await event(
    request("/api/growth/events", { event: "visit", id: randomUUID() }, fake),
  );
  assert.equal(
    (await metricsReport()).visitors,
    0,
    "Forged consent cookies do not pollute metrics",
  );
  const accepted = await consent(
    request("/api/growth/consent", { allowed: true }),
  );
  const cookie = accepted.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
  assert(cookie.includes("syaahi-measurement-proof="));
  assert.equal(
    (
      await event(
        request(
          "/api/growth/events",
          { event: "visit", id: randomUUID(), arbitrary: true },
          cookie,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await event(
        request(
          "/api/growth/events",
          { event: "visit", id: randomUUID() },
          cookie,
        ),
      )
    ).status,
    204,
  );
  assert.equal((await metricsReport()).visitors, 1);
  const target = {
    ...input,
    email: "throttle@example.test",
    password: "wrong-password-long",
  };
  for (let n = 0; n < 6; n++)
    assert.equal(
      (await auth(request("/api/auth", target))).status,
      n < 5 ? 401 : 429,
    );
  console.log(
    "PASS report: generic auth failures, non-enumerating duplicate signup, trusted hosted verification sync, unconfirmed/mismatched identity rejection, native resend, signed consent/event validation and targeted login throttle.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
