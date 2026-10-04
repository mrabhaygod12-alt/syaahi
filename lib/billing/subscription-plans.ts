export const MONTHLY_PLANS = {
  starter: { label: "Starter", inr: 39, credits: 15, maxSlides: 8 },
  pro: { label: "Pro", inr: 179, credits: 90, maxSlides: 12 },
  max: { label: "Max", inr: 399, credits: 360, maxSlides: 15 },
} as const;
export type MonthlyTier = keyof typeof MONTHLY_PLANS;
export function monthlyTier(value: unknown): MonthlyTier | null {
  return typeof value === "string" && Object.hasOwn(MONTHLY_PLANS, value)
    ? (value as MonthlyTier)
    : null;
}
export const DECK_CREDITS = 5;
export const SUBSCRIPTION_CYCLES = 120;
