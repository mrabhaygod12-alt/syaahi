import { notFound } from "next/navigation";
import { purchasableMonthlyTier } from "@/lib/billing/subscription-plans";
import SubscriptionCheckout from "@/components/SubscriptionCheckout";
export const metadata = {
  title: "Monthly checkout",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const tier = purchasableMonthlyTier((await params).tier);
  if (!tier) notFound();
  return <SubscriptionCheckout tier={tier} />;
}
