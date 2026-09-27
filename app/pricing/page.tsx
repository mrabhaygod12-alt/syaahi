import { headers } from "next/headers";
import PricingClient from "@/components/pricing/PricingClient";
import { currencyForCountry } from "@/lib/billing/currency";

export default async function PricingPage() {
  const requestHeaders = await headers();
  const currency = currencyForCountry(
    requestHeaders.get("x-vercel-ip-country"),
  );
  return <PricingClient currency={currency} />;
}
