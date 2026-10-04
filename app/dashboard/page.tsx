import { pageMeta } from "@/lib/seo";
import DashboardRouter from "./DashboardRouter";

export const metadata = pageMeta({
  title: "Dashboard",
  description:
    "Your Syaahi dashboard: learn box, lessons, folders, credits and history.",
  path: "/dashboard",
  noindex: true,
});

export default function Dashboard() {
  return <DashboardRouter />;
}
