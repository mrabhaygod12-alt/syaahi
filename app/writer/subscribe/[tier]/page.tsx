import { notFound } from "next/navigation";
import { purchasableMonthlyTier } from "@/lib/billing/subscription-plans";
import WriterServices from "@/components/writer/WriterServices";
export default async function Page({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const tier = purchasableMonthlyTier((await params).tier, "writer");
  if (!tier) notFound();
  return <WriterServices view="subscribe" tier={tier} />;
}
