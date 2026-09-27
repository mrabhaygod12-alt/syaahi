import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PACKS } from "@/lib/billing/packs";
import { currencyForCountry } from "@/lib/billing/currency";
import Checkout from "@/components/payments/Checkout";
export default async function Page({
  params,
}: {
  params: Promise<{ pack: string }>;
}) {
  const { pack } = await params;
  if (!Object.hasOwn(PACKS, pack)) notFound();
  const requestHeaders = await headers();
  const currency = currencyForCountry(
    requestHeaders.get("x-vercel-ip-country"),
  );
  return <Checkout pack={pack} currency={currency} />;
}
