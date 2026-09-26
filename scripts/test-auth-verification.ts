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

  const originalFetch = globalThis.fetch;
  let lastEmail = "";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    lastEmail = String(init?.body || "");
    return Response.json({ id: "email_test" });
  }) as typeof fetch;

  try {
    const { POST: authPost } = await import("../app/api/auth/route");
    const { POST: verifyPost } =
      await import("../app/api/auth/verify-email/route");
    const { currentUser } = await import("../lib/auth/server");
    const headers = {
      origin: "https://www.syaahii.in",
      "content-type": "application/json",
    };
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
          termsVersion: "2026-09-24",
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
          termsVersion: "2026-09-24",
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
    const cookie = confirmation.headers.get("set-cookie")?.split(";")[0];
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
      "PASS: signup has no session cookie, unverified login is blocked and resends verification, confirmed token creates an authenticated session.",
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
