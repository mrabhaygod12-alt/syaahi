import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Student Credit Packs ₹9, ₹39, ₹79 & Max ₹399/month",
  description:
    "One-time student packs: ₹9 for 3 credits, ₹39 for 15, ₹79 for 36. Max ₹399/month includes 360 credits per captured renewal. Writer plans are Free and Max ₹399/month.",
  path: "/pricing",
});
import PricingClient from "@/components/pricing/PricingClient";

export default function PricingPage() {
  return <PricingClient />;
}
