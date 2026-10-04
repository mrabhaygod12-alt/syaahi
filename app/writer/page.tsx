import WriterDashboard from "@/components/WriterDashboard";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Writer dashboard",
  description:
    "Manage private drafts, editorial feedback and published articles and guides.",
  path: "/writer",
  noindex: true,
});
export default function Page() {
  return <WriterDashboard />;
}
