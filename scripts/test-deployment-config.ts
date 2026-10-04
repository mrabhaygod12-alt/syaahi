import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { releaseRevision } from "../lib/release";
import { diagnoseRazorpay } from "../lib/billing/diagnostics";
import {
  razorpayCredentials,
  paymentConfiguration,
} from "../lib/billing/configuration";
import {
  subscriptionReady,
  subscriptionRequest,
} from "../lib/billing/subscriptions";

async function main() {
  const commit = "a".repeat(40);
  assert.equal(releaseRevision(` ${commit} `), commit);
  for (const invalid of [
    undefined,
    "secret",
    "a".repeat(39),
    `${commit}\ncredential`,
  ])
    assert.equal(releaseRevision(invalid), null);
  process.env.APP_ROLE = "frontend";
  process.env.VERCEL_GIT_COMMIT_SHA = commit;
  process.env.BACKEND_URL = "https://backend.test";
  process.env.BACKEND_PROXY_SECRET = "fixture-proxy";
  for (const path of ["/", "/api/health"])
    assert.equal(
      middleware(new NextRequest(`https://frontend.test${path}`)).headers.get(
        "x-syaahi-frontend-revision",
      ),
      commit,
    );
  process.env.VERCEL_GIT_COMMIT_SHA = "not-a-commit";
  assert.equal(
    middleware(new NextRequest("https://frontend.test/")).headers.get(
      "x-syaahi-frontend-revision",
    ),
    null,
  );
  process.env.RAZORPAY_KEY_ID = " rzp_test_fixture ";
  process.env.RAZORPAY_KEY_SECRET = " fixture-secret ";
  process.env.RAZORPAY_WEBHOOK_SECRET = " fixture-webhook ";
  process.env.RAZORPAY_PLAN_STARTER_INR = " plan_starter ";
  assert.deepEqual(razorpayCredentials(), {
    keyId: "rzp_test_fixture",
    keySecret: "fixture-secret",
  });
  assert.deepEqual(paymentConfiguration(), { configured: true, mode: "test" });
  assert.equal(subscriptionReady("starter"), true);
  const calls: string[] = [];
  const fixtureFetch: typeof fetch = async (input, init) => {
    assert.equal(
      init?.method,
      "GET",
      "Diagnostics must never create an order or mandate",
    );
    assert.equal(init?.body, undefined);
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      `Basic ${Buffer.from("rzp_test_fixture:fixture-secret").toString("base64")}`,
    );
    const path = String(input).split("/v1/")[1];
    calls.push(path);
    if (path === "plans?count=1")
      return Response.json({ items: [{ secret: "must-not-escape" }] });
    if (path === "plans/plan_starter")
      return Response.json({
        id: "plan_starter",
        period: "monthly",
        interval: 1,
        item: { currency: "INR", amount: 3900 },
      });
    if (path === "plans/plan_pro")
      return Response.json({
        id: "plan_pro",
        period: "yearly",
        interval: 1,
        item: { currency: "INR", amount: 17900 },
      });
    throw new Error("Unexpected request");
  };
  const report = await diagnoseRazorpay(
    {
      ...process.env,
      RAZORPAY_PLAN_PRO_INR: "plan_pro",
      RAZORPAY_PLAN_MAX_INR: "",
    },
    fixtureFetch,
  );
  assert.equal(report.authentication, "accepted");
  assert.equal(report.plans.starter.status, "verified");
  assert.equal(report.plans.pro.status, "price-or-interval-mismatch");
  assert.equal(report.plans.max.status, "missing");
  for (const forbidden of [
    "fixture-secret",
    "rzp_test_fixture",
    "must-not-escape",
    "plan_starter",
  ])
    assert.equal(JSON.stringify(report).includes(forbidden), false);
  assert.equal(calls.length, 3);
  let rejectedCalls = 0;
  const rejected = await diagnoseRazorpay(process.env, async () => {
    rejectedCalls++;
    return Response.json(
      { error: { description: "sensitive provider body" } },
      { status: 401 },
    );
  });
  assert.equal(rejected.authentication, "rejected");
  assert.equal(rejectedCalls, 1, "Do not retry rejected authentication");
  assert.equal(
    (
      await diagnoseRazorpay(process.env, async () => {
        throw new Error("secret timeout data");
      })
    ).authentication,
    "unreachable",
  );
  const originalFetch = globalThis.fetch;
  const originalLog = console.error;
  const logged: unknown[][] = [];
  try {
    globalThis.fetch = fixtureFetch;
    assert.equal(
      (await subscriptionRequest("plans/plan_starter")).item.amount,
      3900,
    );
    globalThis.fetch = async () =>
      Response.json(
        { error: { description: "must-not-escape" } },
        { status: 401 },
      );
    console.error = (...args) => logged.push(args);
    await assert.rejects(
      () => subscriptionRequest("plans/plan_starter"),
      /merchant configuration update/,
    );
    await assert.rejects(
      () => subscriptionRequest("plans/../../orders"),
      /Invalid payment operation/,
    );
    assert.equal(JSON.stringify(logged).includes("fixture-secret"), false);
    assert.equal(JSON.stringify(logged).includes("must-not-escape"), false);
    assert.equal(
      JSON.stringify(logged).includes("merchant-authentication"),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalLog;
  }
  delete process.env.MONGODB_URI;
  delete process.env.RENDER_GIT_COMMIT;
  process.env.APP_ROLE = "all";
  process.env.DATA_BACKEND = "sqlite";
  process.env.VERCEL_GIT_COMMIT_SHA = commit;
  const { GET } = await import("../app/api/health/route");
  const health = await GET();
  assert.equal((await health.json()).revision, commit);
  assert.equal(health.headers.get("cache-control"), "no-store");
  console.log(
    "PASS deployment/payment configuration: sanitized release identity, normalized authentication, GET-only diagnostics, matching monthly prices, rejected-auth classification and no secret/provider-body disclosure.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
