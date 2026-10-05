import AudienceView from "@/components/presentations/AudienceView";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Audience presentation",
  path: "/presentations/audience",
  noindex: true,
});
export default function Page() {
  return <AudienceView />;
}
