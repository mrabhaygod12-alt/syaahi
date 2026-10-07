import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-monthly-catalog-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.RAZORPAY_KEY_ID = "rzp_test_catalog";
process.env.RAZORPAY_KEY_SECRET = "fixture-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "fixture-webhook";
for (const tier of ["TRY", "STARTER", "POPULAR", "PRO", "MAX"])
  delete process.env[`RAZORPAY_PLAN_${tier}_INR`];
async function main() {
  const { resolveMonthlyPlan, monthlyCheckoutConfigured, registeredPlanId } =
    await import("../lib/billing/monthly-catalog");
  const plans = new Map<string, any>();
  let creates = 0;
  const calls: string[] = [];
  const provider = async (path: string, body?: any) => {
    calls.push(path);
    assert.match(
      path,
      /^plans(?:[/?]|$)/,
      "Catalog resolution cannot create a customer, subscription or charge",
    );
    if (body) {
      assert.equal(path, "plans");
      const plan = { ...body, id: `plan_Catalog${++creates}` };
      plans.set(plan.id, plan);
      return plan;
    }
    if (path.startsWith("plans?")) return { items: [...plans.values()] };
    const plan = plans.get(path.slice(6));
    if (!plan) throw new Error("Not found");
    return plan;
  };
  assert.equal(
    monthlyCheckoutConfigured("starter"),
    true,
    "Missing IDs no longer disable configured merchant checkout",
  );
  const ids = await Promise.all(
    Array.from({ length: 10 }, () => resolveMonthlyPlan("starter", provider)),
  );
  assert.equal(new Set(ids).size, 1);
  assert.equal(creates, 1, "Competing requests must reuse a catalogue plan");
  assert.equal(await registeredPlanId("starter"), ids[0]);
  assert.equal(await resolveMonthlyPlan("starter", provider), ids[0]);
  assert.equal(creates, 1);
  const pro = {
    id: "plan_ExistingPro",
    period: "monthly",
    interval: 1,
    item: { name: "Syaahi Pro monthly INR v1", currency: "INR", amount: 17900 },
  };
  plans.set(pro.id, pro);
  assert.equal(await resolveMonthlyPlan("pro", provider), pro.id);
  assert.equal(creates, 1, "Existing correctly priced plans are reused");
  process.env.RAZORPAY_PLAN_MAX_INR = pro.id;
  await assert.rejects(
    () => resolveMonthlyPlan("max", provider),
    /published price/,
  );
  assert.equal(
    creates,
    1,
    "A wrong configured price must not be silently substituted",
  );
  delete process.env.RAZORPAY_PLAN_MAX_INR;
  process.env.RAZORPAY_AUTO_PROVISION_PLANS = "0";
  assert.equal(monthlyCheckoutConfigured("max"), false);
  await assert.rejects(() => resolveMonthlyPlan("max", provider), /paused/);
  delete process.env.RAZORPAY_AUTO_PROVISION_PLANS;
  process.env.RAZORPAY_KEY_ID = "rzp_live_differentmerchant";
  assert.equal(
    await registeredPlanId("starter"),
    "",
    "Merchant/mode registries cannot cross-contaminate",
  );
  const rejectedCalls: string[] = [];
  await assert.rejects(
    () =>
      resolveMonthlyPlan("max", async (path) => {
        rejectedCalls.push(path);
        throw new Error("Authentication rejected");
      }),
    /Authentication/,
  );
  assert.equal(rejectedCalls.length, 1);
  assert.equal(creates, 1);
  const {
    MONTHLY_PLANS,
    STUDENT_MONTHLY_TIERS,
    WRITER_MONTHLY_TIERS,
    purchasableMonthlyTier,
  } = await import("../lib/billing/subscription-plans");
  assert.deepEqual(
    STUDENT_MONTHLY_TIERS.map((t) => MONTHLY_PLANS[t].inr),
    [399],
  );
  assert.deepEqual(
    STUDENT_MONTHLY_TIERS.map((t) => MONTHLY_PLANS[t].credits),
    [360],
  );
  assert.deepEqual(WRITER_MONTHLY_TIERS, ["max"]);
  assert.equal(purchasableMonthlyTier("pro"), null);
  assert.equal(purchasableMonthlyTier("popular", "writer"), null);
  assert.equal(purchasableMonthlyTier("max", "writer"), "max");
  const { createSubscription } = await import("../lib/billing/subscriptions");
  await assert.rejects(
    () =>
      createSubscription("unused-owner", "pro", async () => {
        throw new Error("Must never call provider");
      }),
    /retired/,
  );
  for (const tier of ["try", "popular", "max"] as const) {
    const id = await resolveMonthlyPlan(tier, provider);
    const plan = plans.get(id);
    assert.equal(plan.item.amount, MONTHLY_PLANS[tier].inr * 100);
    assert.equal(plan.period, "monthly");
    assert.equal(plan.interval, 1);
  }
  const { register, startSession } = await import("../lib/auth/server");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  const user = await register(
    "Billing fixture",
    "billing@example.test",
    "fixture-password-123",
  );
  await markEmailVerified(user.id);
  const session = await startSession(
    user,
    new Request("https://www.syaahii.in/api/auth"),
  );
  const cookie = session.headers.get("set-cookie")!.split(";")[0];
  const { GET: catalogState, POST: checkout } =
    await import("../app/api/billing/subscription/route");
  const read = new NextRequest(
    "https://www.syaahii.in/api/billing/subscription",
    { headers: { cookie } },
  );
  assert.deepEqual(
    Object.keys((await (await catalogState(read)).json()).plans),
    ["max"],
  );
  const retired = await checkout(
    new NextRequest(read.url, {
      method: "POST",
      headers: {
        cookie,
        origin: "https://www.syaahii.in",
        "content-type": "application/json",
      },
      body: JSON.stringify({ tier: "pro", acceptRecurring: true }),
    }),
  );
  assert.equal(retired.status, 400);
  const { enrollWriter } = await import("../lib/writing/profile"),
    { setWorkspace } = await import("../lib/workspace-preference");
  await enrollWriter(user);
  await setWorkspace(user.id, "writer");
  assert.deepEqual(
    Object.keys((await (await catalogState(read)).json()).plans),
    ["max"],
  );
  const hidden = await checkout(
    new NextRequest(read.url, {
      method: "POST",
      headers: {
        cookie,
        origin: "https://www.syaahii.in",
        "content-type": "application/json",
      },
      body: JSON.stringify({ tier: "popular", acceptRecurring: true }),
    }),
  );
  assert.equal(
    hidden.status,
    400,
    "Writer checkout cannot bypass the two-plan offer policy",
  );
  delete process.env.LEGACY_CREDIT_PACK_CHECKOUT;
  for (const [path, post] of [
    ["razorpay", (await import("../app/api/razorpay/order/route")).POST],
    ["upi", (await import("../app/api/upi/order/route")).POST],
  ] as const) {
    const response = await post(
      new NextRequest(`https://www.syaahii.in/api/${path}/order`, {
        method: "POST",
        headers: {
          cookie,
          origin: "https://www.syaahii.in",
          "content-type": "application/json",
        },
        body: JSON.stringify({ pack: "pro" }),
      }),
    );
    assert.equal(
      response.status,
      410,
      "Retired packs must never start new orders",
    );
  }
  console.log(
    "PASS: missing plan IDs resolved, concurrent/restarted checkout reuse, published price validation, merchant isolation and no customer/charge operations.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
