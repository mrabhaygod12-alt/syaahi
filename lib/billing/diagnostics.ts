import { MONTHLY_PLANS } from "./subscription-plans";

/** Operator-only, read-only probe. Never return provider bodies or credentials. */
export async function diagnoseRazorpay(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
) {
  const keyId = (env.RAZORPAY_KEY_ID || "").trim();
  const secret = (env.RAZORPAY_KEY_SECRET || "").trim();
  const mode = /^rzp_live_[A-Za-z0-9]+$/.test(keyId)
    ? "live"
    : /^rzp_test_[A-Za-z0-9]+$/.test(keyId)
      ? "test"
      : "unconfigured";
  const report = {
    mode,
    authentication: "not-configured",
    httpStatus: null as number | null,
    webhookConfigured: !!env.RAZORPAY_WEBHOOK_SECRET?.trim(),
    plans: Object.fromEntries(
      Object.keys(MONTHLY_PLANS).map((tier) => {
        const variable = `RAZORPAY_PLAN_${tier.toUpperCase()}_INR`;
        const id = (env[variable] || "").trim();
        return [
          tier,
          {
            variable,
            status: !id
              ? "missing"
              : /^plan_[A-Za-z0-9]+$/.test(id)
                ? "unverified"
                : "invalid-id",
          },
        ];
      }),
    ),
  };
  if (mode === "unconfigured" || !secret) return report;
  const get = (path: string) =>
    request(`https://api.razorpay.com/v1/${path}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  try {
    const auth = await get("plans?count=1");
    report.httpStatus = auth.status;
    report.authentication = auth.ok
      ? "accepted"
      : auth.status === 401
        ? "rejected"
        : "provider-error";
    // Discard the body: it may contain merchant information.
    await auth.body?.cancel();
    if (!auth.ok) return report;
    await Promise.all(
      Object.entries(MONTHLY_PLANS).map(async ([tier, expected]) => {
        const entry = report.plans[tier];
        const id = (env[entry.variable] || "").trim();
        if (!/^plan_[A-Za-z0-9]+$/.test(id)) {
          entry.status = id ? "invalid-id" : "missing";
          return;
        }
        try {
          const response = await get(`plans/${id}`);
          if (!response.ok) {
            entry.status =
              response.status === 404
                ? "not-found-in-this-mode"
                : "provider-error";
            await response.body?.cancel();
            return;
          }
          const plan = await response.json();
          entry.status =
            plan.id === id &&
            plan.period === "monthly" &&
            plan.interval === 1 &&
            plan.item?.currency === "INR" &&
            Number(plan.item?.amount) === expected.inr * 100
              ? "verified"
              : "price-or-interval-mismatch";
        } catch {
          entry.status = "unreachable";
        }
      }),
    );
  } catch {
    report.authentication = "unreachable";
  }
  return report;
}
