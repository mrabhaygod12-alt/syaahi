export const MONTHLY_PLANS = {
  try: { label: "Try", inr: 9, credits: 3, maxSlides: 6 },
  starter: { label: "Starter", inr: 39, credits: 15, maxSlides: 8 },
  popular: { label: "Popular", inr: 79, credits: 36, maxSlides: 12 },
  // Historical subscriptions keep their original grants and renewal terms.
  pro: { label: "Pro", inr: 179, credits: 90, maxSlides: 12 },
  max: { label: "Max", inr: 399, credits: 360, maxSlides: 15 },
} as const;
export type MonthlyTier = keyof typeof MONTHLY_PLANS;
export const STUDENT_MONTHLY_TIERS = [
  "try",
  "starter",
  "popular",
  "max",
] as const;
export const WRITER_MONTHLY_TIERS = ["max"] as const;
export function purchasableMonthlyTier(
  value: unknown,
  workspace: "student" | "writer" = "student",
): MonthlyTier | null {
  const tier = monthlyTier(value);
  const offered: readonly MonthlyTier[] =
    workspace === "writer" ? WRITER_MONTHLY_TIERS : STUDENT_MONTHLY_TIERS;
  return tier && offered.includes(tier) ? tier : null;
}
export function monthlyTier(value: unknown): MonthlyTier | null {
  return typeof value === "string" && Object.hasOwn(MONTHLY_PLANS, value)
    ? (value as MonthlyTier)
    : null;
}
export const DECK_CREDITS = 5;
export const SUBSCRIPTION_CYCLES = 120;
