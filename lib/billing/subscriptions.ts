import { randomUUID } from "node:crypto";
import {
  MONTHLY_PLANS,
  type MonthlyTier,
  SUBSCRIPTION_CYCLES,
} from "./subscription-plans";
import { paymentConfiguration } from "./configuration";
import { grant } from "@/lib/credits/store";
import {
  mutateRecord,
  record,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
export interface Subscription extends WorkspaceRecord {
  kind: "subscription";
  tier: MonthlyTier;
  providerPlan: string;
  status: string;
  amount: number;
  credits: number;
  currency: "INR";
  currentEnd: number;
  lastPayment?: string;
  settledInvoices?: string[];
  cancelScheduled: boolean;
  createdAt: string;
  mode: string;
}
interface AccountSlot extends WorkspaceRecord {
  kind: "subscription-slot";
  subscriptionId: string | null;
  creatingUntil: number;
  attempt?: string;
  tier?: MonthlyTier;
}
type ProviderRequest = (path: string, body?: unknown) => Promise<any>;
export const subscriptionReady = (tier: MonthlyTier) =>
  paymentConfiguration().configured &&
  /^plan_[a-zA-Z0-9]+$/.test(
    process.env[`RAZORPAY_PLAN_${tier.toUpperCase()}_INR`] || "",
  );
export async function subscriptionRequest(
  path: string,
  body?: unknown,
): Promise<any> {
  if (!paymentConfiguration().configured)
    throw new Error("Subscription payments are not configured yet.");
  if (
    !/^(subscriptions|plans|payments|invoices)(\/[A-Za-z0-9_]+)?(\/cancel)?(?:\?(?:count|skip|subscription_id|from)=[A-Za-z0-9_]+(?:&(?:count|skip|subscription_id|from)=[A-Za-z0-9_]+)*)?$/.test(
      path,
    )
  )
    throw new Error("Invalid payment operation.");
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      "Subscription provider is unavailable. Please retry or contact support.",
    );
  return response.json();
}
export async function currentSubscription(
  owner: string,
): Promise<Subscription | null> {
  const slot = await record<AccountSlot>(`subscription-account:${owner}`);
  return slot?.subscriptionId
    ? record<Subscription>(slot.subscriptionId)
    : null;
}
export async function createSubscription(
  owner: string,
  tier: MonthlyTier,
  api: ProviderRequest = subscriptionRequest,
) {
  if (!subscriptionReady(tier))
    throw new Error("This monthly plan is not ready for checkout yet.");
  const old = await currentSubscription(owner);
  if (old && !["cancelled", "completed", "expired"].includes(old.status)) {
    if (old.tier === tier && old.status === "created") return old;
    throw new Error(
      "You already have a subscription. Manage or cancel it before choosing another plan.",
    );
  }
  if (old && old.currentEnd > Date.now() / 1000)
    throw new Error(
      "Your paid billing period is still active. Change plans after it ends.",
    );
  const slotId = `subscription-account:${owner}`,
    attempt = randomUUID();
  await mutateRecord<AccountSlot>(slotId, (previous) => {
    if (
      previous &&
      (previous.creatingUntil > 0 ||
        previous.subscriptionId !== (old?.id || null))
    )
      throw new Error(
        "A checkout is already being created. Check billing before retrying.",
      );
    return {
      id: slotId,
      owner,
      kind: "subscription-slot",
      subscriptionId: previous?.subscriptionId || null,
      creatingUntil: Date.now(),
      attempt,
      tier,
      updatedAt: new Date().toISOString(),
    };
  });
  let posted = false;
  try {
    const providerPlan =
        process.env[`RAZORPAY_PLAN_${tier.toUpperCase()}_INR`]!,
      plan = await api(`plans/${providerPlan}`),
      config = MONTHLY_PLANS[tier];
    if (
      plan.period !== "monthly" ||
      plan.interval !== 1 ||
      plan.item?.currency !== "INR" ||
      Number(plan.item?.amount) !== config.inr * 100
    )
      throw new Error(
        "Configured plan does not match the published monthly price.",
      );
    posted = true;
    const remote = await api("subscriptions", {
      plan_id: providerPlan,
      quantity: 1,
      total_count: SUBSCRIPTION_CYCLES,
      customer_notify: 1,
      notes: { syaahi_owner: owner, syaahi_attempt: attempt, tier },
    });
    if (!/^sub_[A-Za-z0-9]+$/.test(remote.id))
      throw new Error("Provider returned an invalid subscription.");
    const now = new Date().toISOString(),
      local: Subscription = {
        id: remote.id,
        owner,
        kind: "subscription",
        updatedAt: now,
        createdAt: now,
        tier,
        providerPlan,
        status: "created",
        amount: config.inr * 100,
        credits: config.credits,
        currency: "INR",
        currentEnd: 0,
        cancelScheduled: false,
        mode: paymentConfiguration().mode,
      };
    await mutateRecord<Subscription>(local.id, () => local);
    await mutateRecord<AccountSlot>(slotId, (previous) => ({
      ...previous!,
      subscriptionId: local.id,
      creatingUntil: 0,
      updatedAt: now,
    }));
    return local;
  } catch (error) {
    // A timed-out POST stays locked until reconciliation to prevent a second mandate.
    if (!posted)
      await mutateRecord<AccountSlot>(slotId, (previous) => ({
        ...previous!,
        creatingUntil: 0,
        updatedAt: new Date().toISOString(),
      }));
    throw error;
  }
}
export async function syncSubscription(
  id: string,
  api: ProviderRequest = subscriptionRequest,
) {
  const remote = await api(`subscriptions/${id}`);
  const local =
    (await record<Subscription>(id)) ||
    (await recoverRemoteSubscription(remote));
  if (!local) return null;
  if (remote.id !== id || remote.plan_id !== local.providerPlan)
    throw new Error("Subscription identity mismatch.");
  return mutateRecord<Subscription>(id, (old) => ({
    ...old!,
    status: String(remote.status),
    updatedAt: new Date().toISOString(),
  }));
}
export async function settleSubscription(
  id: string,
  paymentId: string,
  api: ProviderRequest = subscriptionRequest,
) {
  const local =
    (await record<Subscription>(id)) ||
    (await recoverRemoteSubscription(await api(`subscriptions/${id}`)));
  if (!local) throw new Error("Unknown subscription.");
  const payment = await api(`payments/${paymentId}`);
  if (!/^inv_[A-Za-z0-9]+$/.test(payment.invoice_id || ""))
    return { credited: false, subscription: await syncSubscription(id, api) };
  const invoice = await api(`invoices/${payment.invoice_id}`),
    remote = await api(`subscriptions/${id}`);
  if (
    invoice.id !== payment.invoice_id ||
    remote.id !== id ||
    remote.plan_id !== local.providerPlan ||
    invoice.subscription_id !== id ||
    invoice.payment_id !== paymentId ||
    payment.id !== paymentId
  )
    throw new Error("Payment does not belong to this subscription.");
  if (payment.status !== "captured" || invoice.status !== "paid")
    return { credited: false, subscription: local };
  if (
    Number(payment.amount) !== local.amount ||
    Number(invoice.amount_paid) !== local.amount ||
    payment.currency !== local.currency ||
    invoice.currency !== local.currency
  )
    throw new Error("Subscription payment amount or currency mismatch.");
  const currentEnd = Number(invoice.billing_end);
  if (!Number.isSafeInteger(currentEnd) || currentEnd <= 0)
    throw new Error("Payment has no valid billing period.");
  // The immutable invoice key also protects reconciliation after a crash or webhook replay.
  await grant(local.owner, local.credits, `subscription-invoice:${invoice.id}`);
  const next = await mutateRecord<Subscription>(id, (old) => ({
    ...old!,
    status: String(remote.status),
    currentEnd: Math.max(old!.currentEnd, currentEnd),
    lastPayment: paymentId,
    settledInvoices: [
      ...new Set([...(old!.settledInvoices || []), invoice.id]),
    ].slice(-140),
    updatedAt: new Date().toISOString(),
  }));
  return { credited: true, subscription: next };
}
async function recoverRemoteSubscription(remote: any) {
  const owner = remote.notes?.syaahi_owner;
  if (typeof owner !== "string" || !/^sub_[A-Za-z0-9]+$/.test(remote.id || ""))
    return null;
  const slotId = `subscription-account:${owner}`,
    slot = await record<AccountSlot>(slotId);
  if (
    !slot?.creatingUntil ||
    !slot.tier ||
    slot.attempt !== remote.notes?.syaahi_attempt ||
    remote.plan_id !==
      process.env[`RAZORPAY_PLAN_${slot.tier.toUpperCase()}_INR`]
  )
    return null;
  const config = MONTHLY_PLANS[slot.tier],
    now = new Date().toISOString();
  const local = await mutateRecord<Subscription>(
    remote.id,
    (old) =>
      old || {
        id: remote.id,
        owner,
        kind: "subscription",
        tier: slot.tier!,
        providerPlan: remote.plan_id,
        status: String(remote.status),
        amount: config.inr * 100,
        credits: config.credits,
        currency: "INR",
        currentEnd: 0,
        cancelScheduled: false,
        mode: paymentConfiguration().mode,
        createdAt: now,
        updatedAt: now,
      },
  );
  await mutateRecord<AccountSlot>(slotId, (old) => {
    if (!old || old.attempt !== slot.attempt)
      throw new Error("Checkout changed during reconciliation.");
    return {
      ...old,
      subscriptionId: remote.id,
      creatingUntil: 0,
      updatedAt: now,
    };
  });
  return local;
}
export async function refreshBilling(
  owner: string,
  api: ProviderRequest = subscriptionRequest,
) {
  let local = await currentSubscription(owner);
  const slot = await record<AccountSlot>(`subscription-account:${owner}`);
  if (slot?.creatingUntil && slot.attempt) {
    const remote = await api(
      `subscriptions?count=100&from=${Math.max(0, Math.floor(slot.creatingUntil / 1000) - 60)}`,
    );
    const candidates = (remote.items || []).filter(
      (s: any) =>
        s.notes?.syaahi_owner === owner &&
        s.notes?.syaahi_attempt === slot.attempt,
    );
    if (candidates.length === 1)
      local = await recoverRemoteSubscription(candidates[0]);
    else
      throw new Error(
        "Checkout reconciliation is pending. Contact support before starting another mandate.",
      );
  }
  if (!local) return null;
  const invoices = await api(`invoices?subscription_id=${local.id}&count=100`);
  for (const invoice of invoices.items || [])
    if (
      invoice.status === "paid" &&
      invoice.subscription_id === local.id &&
      /^pay_[A-Za-z0-9]+$/.test(invoice.payment_id || "") &&
      !local.settledInvoices?.includes(invoice.id)
    )
      await settleSubscription(local.id, invoice.payment_id, api);
  return syncSubscription(local.id, api);
}
export async function cancelSubscription(
  owner: string,
  api: ProviderRequest = subscriptionRequest,
) {
  const local = await currentSubscription(owner);
  if (!local) throw new Error("No subscription to cancel.");
  if (
    local.cancelScheduled ||
    ["cancelled", "completed", "expired"].includes(local.status)
  )
    return local;
  const remote = await api(`subscriptions/${local.id}/cancel`, {
    cancel_at_cycle_end: local.status === "active" ? 1 : 0,
  });
  if (remote.id !== local.id)
    throw new Error("Subscription identity mismatch.");
  return mutateRecord<Subscription>(local.id, (old) => ({
    ...old!,
    status: String(remote.status),
    cancelScheduled: true,
    updatedAt: new Date().toISOString(),
  }));
}
export async function presentationLimit(owner: string) {
  const subscription = await currentSubscription(owner);
  return subscription && subscription.currentEnd > Date.now() / 1000
    ? MONTHLY_PLANS[subscription.tier].maxSlides
    : 6;
}
export function publicSubscription(value: Subscription | null) {
  if (!value) return null;
  const {
    id,
    tier,
    status,
    amount,
    currency,
    currentEnd,
    cancelScheduled,
    mode,
    credits,
  } = value;
  return {
    id,
    tier,
    status,
    amount,
    currency,
    currentEnd,
    cancelScheduled,
    mode,
    credits,
  };
}
