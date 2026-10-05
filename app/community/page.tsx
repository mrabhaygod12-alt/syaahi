import CommunityPublications from "@/components/CommunityPublications";
import { pageMeta } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = pageMeta({
  title: "Stories for curious minds",
  description:
    "Discover reviewed stories, guides and new perspectives on Syaahi.",
  path: "/community",
});
metadata.alternates = {
  ...metadata.alternates,
  types: { "application/rss+xml": "/feed.xml" },
};
export default function CommunityPage() {
  return (
    <div className="community-editorial-page">
      <header className="community-editorial-hero">
        <p className="landing-eyebrow">THE SYAAHI COMMUNITY</p>
        <h1>
          Read a little.
          <br />
          <em>See a little differently.</em>
        </h1>
        <p>
          Thoughtful guides, practical experiences and perspectives worth your
          time.
        </p>
        <a href="/writing">Have a story to tell? ↗</a>
        <a href="/feed.xml">Follow the reviewed story feed ↗</a>
        <span aria-hidden="true">✦</span>
      </header>
      <div className="community-editorial-wrap">
        <CommunityPublications />
      </div>
    </div>
  );
}
