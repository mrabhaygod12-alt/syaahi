import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Monthly Plans: Free, Starter, Pro, Max & Team",
  description:
    "Compare Syaahi monthly plans: Starter ₹39 for 15 credits, Pro ₹179 for 90, Max ₹399 for 360. Create notes, editable presentations and study material.",
  path: "/pricing",
});
import PricingClient from "@/components/pricing/PricingClient";

export default function PricingPage() {
  return <PricingClient />;
}
