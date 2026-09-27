import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Credit Packs & Pricing",
  description:
    "Compare Syaahi study credit packs, regional INR, USD and EUR prices, and how credits are used to create handwritten-style notes.",
  path: "/pricing",
});
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
