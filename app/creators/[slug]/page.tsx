import { notFound } from "next/navigation";
import { listPublicStoriesByCreator } from "@/lib/writing/stories";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const stories = await listPublicStoriesByCreator(slug);
  if (!stories.length)
    return pageMeta({
      title: "Creator not found",
      description: "This Syaahi creator profile is unavailable.",
      path: "/community",
      noindex: true,
    });
  return pageMeta({
    title: `${stories[0].authorName} | Verified Syaahi Creator`,
    description: `Read reviewed study guides from ${stories[0].authorName} on Syaahi.`,
    path: `/creators/${stories[0].creatorSlug}`,
  });
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const stories = await listPublicStoriesByCreator(slug);
  if (!stories.length) notFound();
  const creator = stories[0];
  const firstPublished = stories
    .map((story) => story.publishedAt || story.createdAt)
    .sort()[0];
  return (
    <main className="wrap feature-section">
      <section className="interactive-panel" style={{ maxWidth: 860 }}>
        <span className="eyebrow">VERIFIED SYAAHI CREATOR</span>
        <h1>{creator.authorName}</h1>
        <p className="small">
          This profile is created only from guides approved by Syaahi’s editorial
          review. It does not disclose the creator’s email or private drafts.
        </p>
        <p className="small">
          First published {new Date(firstPublished).toLocaleDateString()}
        </p>
      </section>
      <section style={{ marginTop: 24 }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">REVIEWED GUIDES</span>
            <h2>Published by {creator.authorName}</h2>
          </div>
        </div>
        <div className="steps-grid">
          {stories.map((story) => (
            <article key={story.slug} className="interactive-panel">
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
              <div className="about-tags">
                {story.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <p className="small">
                Published {new Date(story.publishedAt || story.createdAt).toLocaleDateString()}
              </p>
              <a className="btn dark" href="/community">Browse reviewed guides →</a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
