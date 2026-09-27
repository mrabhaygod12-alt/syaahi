import { notFound } from "next/navigation";
import { PACKS } from "@/lib/billing/packs";
import Checkout from "@/components/payments/Checkout";
export default async function Page({
  params,
}: {
  params: Promise<{ pack: string }>;
}) {
  const { pack } = await params;
  if (!Object.hasOwn(PACKS, pack)) notFound();
  return <Checkout pack={pack} />;
}
