import { notFound } from "next/navigation";
import { monthlyTier } from "@/lib/billing/subscription-plans";
import WriterServices from "@/components/writer/WriterServices";
export default async function Page({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const tier = monthlyTier((await params).tier);
  if (!tier) notFound();
  return <WriterServices view="subscribe" tier={tier} />;
}
