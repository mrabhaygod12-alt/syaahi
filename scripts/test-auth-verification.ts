import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { NextRequest } from "next/server";

async function main() {
  const replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.12" },
  });
  process.env.MONGODB_URI = replica.getUri();
  process.env.DATA_BACKEND = "mongo";
  process.env.MONGODB_DATABASE = "auth_verification_test";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.syaahii.in";
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.EMAIL_FROM = "Syaahi <verify@example.test>";
  for (const key of [
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_KEY",
  ])
    delete process.env[key];

  const originalFetch = globalThis.fetch;
  let lastEmail = "";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    lastEmail = String(init?.body || "");
    return Response.json({ id: "email_test" });
  }) as typeof fetch;

  try {
    const { POST: authPost } = await import("../app/api/auth/route");
    const { POST: googlePost } = await import("../app/api/auth/google/route");
    const { GET: googleCallback } =
      await import("../app/api/auth/callback/route");
    const { POST: verifyPost } =
      await import("../app/api/auth/verify-email/route");
    const { currentUser } = await import("../lib/auth/server");
    const headers = {
      origin: "https://www.syaahii.in",
      "content-type": "application/json",
    };
    const google = await googlePost(
      new NextRequest("https://www.syaahii.in/api/auth/google", {
        method: "POST",
        headers,
        body: JSON.stringify({
          acceptTerms: true,
          termsVersion: "2026-10-03",
        }),
      }),
    );
    assert.equal(google.status, 503);
    const googleError = await google.json();
    assert.match(googleError.error, /temporarily unavailable/i);
    assert.doesNotMatch(googleError.error, /SUPABASE_PUBLISHABLE_KEY/);

    for (const scenario of [
      {
        workspace: "writer",
        mode: "signup",
        next: "/writer/stories",
        path: "/signup",
        expectedWorkspace: "writer",
        expectedNext: "/writer/stories",
      },
      {
        workspace: "writer",
        mode: "login",
        next: "/pricing",
        path: "/login",
        expectedWorkspace: "writer",
        expectedNext: "/writer/membership",
      },
      {
        workspace: "student",
        mode: "login",
        next: "/presentations",
        path: "/login",
        expectedWorkspace: "student",
        expectedNext: "/presentations",
      },
      {
        workspace: "invalid",
        mode: "invalid",
        next: "//example.test/private",
        path: "/login",
        expectedWorkspace: "student",
        expectedNext: "/dashboard",
      },
    ]) {
      const cancelled = await googleCallback(
        new NextRequest(
          "https://www.syaahii.in/api/auth/callback?error=access_denied&error_description=private-provider-detail",
          {
            headers: {
              cookie: `syaahi-oauth-consent=2026-10-03; syaahi-oauth-workspace=${scenario.workspace}; syaahi-oauth-mode=${scenario.mode}; syaahi-oauth-next=${encodeURIComponent(scenario.next)}`,
            },
          },
        ),
      );
      assert.equal(cancelled.status, 307);
      const retry = new URL(cancelled.headers.get("location")!);
      assert.equal(retry.origin, "https://www.syaahii.in");
      assert.equal(retry.pathname, scenario.path);
      assert.equal(
        retry.searchParams.get("workspace"),
        scenario.expectedWorkspace,
      );
      assert.equal(retry.searchParams.get("next"), scenario.expectedNext);
      assert.match(retry.searchParams.get("error")!, /Please retry/);
      assert.doesNotMatch(retry.href, /private-provider-detail/);
      assert.equal(cancelled.headers.get("cache-control"), "no-store");
      const clearedCookies = cancelled.headers.getSetCookie();
      for (const cookie of clearedCookies) {
        assert.match(cookie, /^syaahi-oauth-/);
        assert.match(cookie, /Max-Age=0/i);
      }
      assert.equal(clearedCookies.length, 5);
    }

    const signup = await authPost(
      new NextRequest("https://www.syaahii.in/api/auth", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "signup",
          name: "Verified Learner",
          email: "verified-learner@example.test",
          password: "test-password-12345",
          acceptTerms: true,
          termsVersion: "2026-10-03",
        }),
      }),
    );
    assert.equal(signup.status, 202);
    assert.equal(signup.headers.get("set-cookie"), null);
    assert.equal((await signup.json()).requireVerification, true);

    const login = await authPost(
      new NextRequest("https://www.syaahii.in/api/auth", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "login",
          email: "verified-learner@example.test",
          password: "test-password-12345",
          acceptTerms: true,
          termsVersion: "2026-10-03",
        }),
      }),
    );
    assert.equal(login.status, 403);
    assert.equal(login.headers.get("set-cookie"), null);
    const token = lastEmail.match(/\/verify-email#([a-f0-9]{64})/)?.[1];
    assert(token, "login retry sends a one-hour verification link");

    const confirmation = await verifyPost(
      new NextRequest("https://www.syaahii.in/api/auth/verify-email", {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      }),
    );
    assert.equal(confirmation.status, 200);
    const sessionCookie = confirmation.headers.get("set-cookie") || "";
    assert.match(sessionCookie, /Max-Age=604800/i);
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=lax/i);
    const cookie = sessionCookie.split(";")[0];
    if (!cookie?.startsWith("syaahi-session="))
      throw new Error(
        "Verified confirmation did not set the application session.",
      );
    assert.equal(
      (
        await currentUser(
          new Request("https://www.syaahii.in/api/auth", {
            headers: { cookie },
          }),
        )
      )?.email,
      "verified-learner@example.test",
    );
    console.log(
      "PASS: missing Google config returns a generic public error; cancelled OAuth preserves workspace/mode with a safe retry destination and clears transient cookies; signup has no session before verification; verified login issues a seven-day HttpOnly cookie that authenticates on a later request.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    const { mongo } = await import("../lib/storage/mongo");
    await (await mongo()).client.close();
    await replica.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
