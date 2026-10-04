import { createHash, randomUUID } from "node:crypto";
import { paymentConfiguration, razorpayCredentials } from "./configuration";
import { MONTHLY_PLANS, type MonthlyTier } from "./subscription-plans";
import {
  record,
  mutateRecord,
  type WorkspaceRecord,
} from "@/lib/workspace-records";

type Provider = (path: string, body?: unknown) => Promise<any>;
interface PlanRegistration extends WorkspaceRecord {
  kind: "billing-plan";
  planId: string | null;
  lease: string | null;
  leaseUntil: number;
}
export const configuredPlanId = (tier: MonthlyTier) =>
  (process.env[`RAZORPAY_PLAN_${tier.toUpperCase()}_INR`] || "").trim();
export const automaticPlansEnabled = () =>
  process.env.RAZORPAY_AUTO_PROVISION_PLANS !== "0";
export function monthlyCheckoutConfigured(tier: MonthlyTier) {
  return (
    paymentConfiguration().configured &&
    (/^plan_[a-zA-Z0-9]+$/.test(configuredPlanId(tier)) ||
      (!configuredPlanId(tier) && automaticPlansEnabled()))
  );
}
function registrationId(tier: MonthlyTier) {
  const merchant = createHash("sha256")
    .update(razorpayCredentials().keyId)
    .digest("hex")
    .slice(0, 24);
  return `billing-plan:${merchant}:${tier}:${MONTHLY_PLANS[tier].inr * 100}:v1`;
}
export async function registeredPlanId(tier: MonthlyTier) {
  return (
    configuredPlanId(tier) ||
    (await record<PlanRegistration>(registrationId(tier)))?.planId ||
    ""
  );
}
export function validateMonthlyPlan(plan: any, tier: MonthlyTier) {
  if (
    !/^plan_[A-Za-z0-9]+$/.test(plan?.id || "") ||
    plan.period !== "monthly" ||
    plan.interval !== 1 ||
    plan.item?.currency !== "INR" ||
    Number(plan.item?.amount) !== MONTHLY_PLANS[tier].inr * 100
  )
    throw new Error(
      "Monthly plan does not match the published price and billing interval. Contact support.",
    );
}
const pending = new Map<string, Promise<string>>();
/** Only provisions catalogue plans; never creates a customer, mandate or charge. */
export async function resolveMonthlyPlan(
  tier: MonthlyTier,
  provider: Provider,
): Promise<string> {
  if (!paymentConfiguration().configured)
    throw new Error(
      "Monthly payments require valid merchant and webhook configuration.",
    );
  const configured = configuredPlanId(tier);
  if (configured) {
    if (!/^plan_[A-Za-z0-9]+$/.test(configured))
      throw new Error(
        "Monthly plan configuration is invalid. Contact support.",
      );
    const plan = await provider(`plans/${configured}`);
    validateMonthlyPlan(plan, tier);
    if (plan.id !== configured)
      throw new Error("Monthly plan identity mismatch.");
    return configured;
  }
  if (!automaticPlansEnabled())
    throw new Error("Monthly checkout is paused. Please contact support.");
  const id = registrationId(tier);
  const current = pending.get(id);
  if (current) return current;
  const task = registerPlan(id, tier, provider);
  pending.set(id, task);
  try {
    return await task;
  } finally {
    if (pending.get(id) === task) pending.delete(id);
  }
}
async function registerPlan(id: string, tier: MonthlyTier, provider: Provider) {
  let saved = await record<PlanRegistration>(id);
  if (saved?.planId) {
    const plan = await provider(`plans/${saved.planId}`);
    validateMonthlyPlan(plan, tier);
    if (plan.id !== saved.planId)
      throw new Error("Monthly plan identity mismatch.");
    return saved.planId;
  }
  const lease = randomUUID();
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      saved = await mutateRecord<PlanRegistration>(id, (old) => {
        if (old?.leaseUntil && old.leaseUntil > Date.now())
          throw new Error("Plan registration in progress.");
        return {
          id,
          owner: "system:billing",
          kind: "billing-plan",
          planId: old?.planId || null,
          lease,
          leaseUntil: Date.now() + 60000,
          updatedAt: new Date().toISOString(),
        };
      });
      break;
    } catch (error) {
      const existing = await record<PlanRegistration>(id);
      if (existing?.planId) {
        validateMonthlyPlan(await provider(`plans/${existing.planId}`), tier);
        return existing.planId;
      }
      if (
        !(error instanceof Error) ||
        error.message !== "Plan registration in progress."
      )
        throw error;
      if (attempt === 59)
        throw new Error(
          "Checkout preparation is still running. Please retry shortly.",
        );
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  if (saved?.planId) return saved.planId;
  try {
    const config = MONTHLY_PLANS[tier],
      name = `Syaahi ${config.label} monthly INR v1`;
    let selected: any;
    for (let skip = 0; skip < 1000; skip += 100) {
      const page = await provider(`plans?count=100&skip=${skip}`);
      if (!Array.isArray(page.items))
        throw new Error("Provider returned an invalid plan catalogue.");
      selected = page.items.find(
        (p: any) =>
          p.item?.name === name &&
          p.period === "monthly" &&
          p.interval === 1 &&
          p.item?.currency === "INR" &&
          Number(p.item?.amount) === config.inr * 100,
      );
      if (selected || page.items.length < 100) break;
      if (skip === 900)
        throw new Error("Plan catalogue requires operator review.");
    }
    selected ||= await provider("plans", {
      period: "monthly",
      interval: 1,
      item: {
        name,
        amount: config.inr * 100,
        currency: "INR",
        description: `${config.credits} shared generation credits per captured monthly payment.`,
      },
      notes: { product: "syaahi-monthly-v1", tier },
    });
    validateMonthlyPlan(selected, tier);
    await mutateRecord<PlanRegistration>(id, (old) => {
      if (old?.lease !== lease)
        throw new Error("Plan registration changed. Retry checkout.");
      return {
        ...old,
        planId: selected.id,
        lease: null,
        leaseUntil: 0,
        updatedAt: new Date().toISOString(),
      };
    });
    return selected.id as string;
  } finally {
    await mutateRecord<PlanRegistration>(id, (old) => {
      if (!old) throw new Error("Plan registration missing.");
      return old.lease === lease
        ? {
            ...old,
            lease: null,
            leaseUntil: 0,
            updatedAt: new Date().toISOString(),
          }
        : old;
    });
  }
}
