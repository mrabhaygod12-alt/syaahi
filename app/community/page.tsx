import CommunityPublications from "@/components/CommunityPublications";
import { pageMeta } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = pageMeta({
  title: "Reviewed Study Guides",
  description: "Read reviewed study guides from the Syaahi learning community.",
  path: "/community",
});
export default function CommunityPage() {
  return (
    <main className="wrap feature-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">SYAAHI LEARNING COMMONS</span>
          <h1>Guides reviewed for learners.</h1>
          <p className="small">
            Every guide shown here has passed editorial review. Creator drafts
            remain private until published.
          </p>
        </div>
        <a className="btn dark" href="/write">
          Write a guide
        </a>
      </div>
      <CommunityPublications />
    </main>
  );
}
