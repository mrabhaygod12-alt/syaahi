import { MONTHLY_PLANS } from "../lib/billing/subscription-plans";
const apply = process.argv.includes("--apply");
async function main() {
  if (!apply) {
    console.log("Preview only. No provider requests or changes.");
    for (const [tier, plan] of Object.entries(MONTHLY_PLANS))
      console.log(
        `${tier}: INR ${plan.inr}/month, ${plan.credits} credits; RAZORPAY_PLAN_${tier.toUpperCase()}_INR`,
      );
    return;
  }
  const key = process.env.RAZORPAY_KEY_ID?.trim(),
    secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key || !secret)
    throw new Error("Set server-side Razorpay credentials before applying.");
  if (key.startsWith("rzp_live_") && !process.argv.includes("--live"))
    throw new Error(
      "Live plan creation requires --live in addition to --apply. Test first.",
    );
  const call = async (path: string, body?: unknown) => {
    const res = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
      throw new Error(
        "Razorpay rejected plan provisioning. Check your account and credentials.",
      );
    return res.json();
  };
  const existing: any[] = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    const result = await call(`plans?count=100&skip=${skip}`);
    existing.push(...result.items);
    if (result.items.length < 100) break;
    if (skip === 900)
      throw new Error(
        "Too many existing plans. Reconcile manually before creating more.",
      );
  }
  for (const [tier, plan] of Object.entries(MONTHLY_PLANS)) {
    const name = `Syaahi ${plan.label} monthly INR v1`;
    let remote = existing.find(
      (p) =>
        p.period === "monthly" &&
        p.interval === 1 &&
        p.item?.name === name &&
        p.item?.currency === "INR" &&
        p.item?.amount === plan.inr * 100,
    );
    if (!remote)
      remote = await call("plans", {
        period: "monthly",
        interval: 1,
        item: {
          name,
          amount: plan.inr * 100,
          currency: "INR",
          description: `${plan.credits} study credits per captured monthly payment.`,
        },
        notes: { product: "syaahi-monthly-v1", tier },
      });
    console.log(`RAZORPAY_PLAN_${tier.toUpperCase()}_INR=${remote.id}`);
  }
}
main().catch(() => {
  console.error(
    "Plan provisioning did not finish. Check account configuration; re-running reuses matching plans. No credentials are printed.",
  );
  process.exitCode = 1;
});
