// Storage uses integer page units. 1 token = 3 generated note pages.
export const PAGES_PER_TOKEN = 3;
export const STUDENT_CREDIT_PACKS = ["try", "starter", "popular"] as const;
export const purchasablePack = (
  id: unknown,
): id is (typeof STUDENT_CREDIT_PACKS)[number] =>
  typeof id === "string" &&
  (STUDENT_CREDIT_PACKS as readonly string[]).includes(id);
export const tokenLabel = (pages: number) =>
  `${Number((pages / PAGES_PER_TOKEN).toFixed(2))} tokens`;
export type BillingCurrency = "INR" | "USD" | "EUR";

/** Fixed merchant price points; foreign prices are not live FX conversions. */
export const PACKS: Record<
  string,
  {
    credits: number;
    inr: number;
    usd: number;
    eur: number;
    /** Informational study window; this is a one-time bulk-credit purchase. */
    durationDays?: number;
  }
> = {
  try: { credits: 3, inr: 9, usd: 5, eur: 5 },
  starter: { credits: 15, inr: 39, usd: 22, eur: 22 },
  popular: { credits: 36, inr: 79, usd: 44, eur: 44 },
  pro: { credits: 90, inr: 179, usd: 99, eur: 99 },
  semester: {
    credits: 360,
    inr: 399,
    usd: 149,
    eur: 139,
    durationDays: 183,
  },
};

export function packPrice(pack: string, currency: BillingCurrency): number {
  const plan = PACKS[pack];
  if (!plan) throw new Error("Unknown pack.");
  return plan[currency.toLowerCase() as "inr" | "usd" | "eur"];
}

export function packAmountMinor(
  pack: string,
  currency: BillingCurrency,
): number {
  const amount = packPrice(pack, currency) * 100;
  if (!Number.isSafeInteger(amount) || amount < 100)
    throw new Error("Minimum payment is 100 minor units.");
  return amount;
}

export function formatMinorPrice(amount: number, currency: BillingCurrency) {
  return new Intl.NumberFormat(
    currency === "INR" ? "en-IN" : currency === "EUR" ? "de-DE" : "en-US",
    { style: "currency", currency, maximumFractionDigits: 0 },
  ).format(amount / 100);
}
