import { notFound } from "next/navigation";
import { monthlyTier } from "@/lib/billing/subscription-plans";
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
  const tier = monthlyTier((await params).tier);
  if (!tier) notFound();
  return <SubscriptionCheckout tier={tier} />;
}
