import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Help & Support",
  description:
    "Get help with Syaahi login, note generation, PDF exports, credits and payments. Contact support and track your issue.",
  path: "/support",
});
import { PageHero } from "@/components/site";
import SupportDesk from "@/components/SupportDesk";
export default function Support() {
  return (
    <>
      <PageHero
        kicker="HELP & SUPPORT"
        title="Let’s get you moving again."
        lede="Track an issue, add context, and receive replies in one place."
      />
      <div className="wrap" style={{ paddingBottom: 70 }}>
        <SupportDesk />
      </div>
    </>
  );
}
