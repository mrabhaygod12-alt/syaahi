import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Student Monthly Plans: ₹9, ₹39, ₹79 and ₹399",
  description:
    "Compare Syaahi student monthly plans: Try ₹9 for 3 credits, Starter ₹39 for 15, Popular ₹79 for 36, Max ₹399 for 360. Writer plans are Free and Max ₹399/month.",
  path: "/pricing",
});
import PricingClient from "@/components/pricing/PricingClient";

export default function PricingPage() {
  return <PricingClient />;
}
