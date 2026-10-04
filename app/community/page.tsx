import CommunityPublications from "@/components/CommunityPublications";
import { pageMeta } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = pageMeta({
  title: "Community Articles & Reviewed Guides",
  description:
    "Read reviewed articles, teaching guides and professional explanations on Syaahi. Discover the creators and submit your own work for editorial review.",
  path: "/community",
});
export default function CommunityPage() {
  return (
    <main className="wrap feature-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE SYAAHI COMMUNITY</span>
          <h1>Articles and guides, reviewed before publication.</h1>
          <p className="small">
            Every article shown here has passed editorial review. Creator drafts
            remain private until published.
          </p>
        </div>
        <a className="btn dark" href="/write">
          Write an article
        </a>
      </div>
      <CommunityPublications />
    </main>
  );
}
