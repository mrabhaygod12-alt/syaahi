import { notFound } from "next/navigation";
import { getPublicStory } from "@/lib/writing/stories";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const story = await getPublicStory((await params).slug);
  if (!story) return pageMeta({ title: "Guide not found", description: "This study guide is unavailable.", path: "/community", noindex: true });
  return pageMeta({ title: story.title, description: story.summary, path: `/guides/${story.slug}` });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const story = await getPublicStory((await params).slug);
  if (!story) notFound();
  return <main className="wrap feature-section"><article className="interactive-panel" style={{ maxWidth: 860 }}><p className="eyebrow">REVIEWED STUDY GUIDE</p><h1>{story.title}</h1><p className="small">By <a href={`/creators/${story.creatorSlug}`}>{story.authorName}</a> · Published {new Date(story.publishedAt || story.createdAt).toLocaleDateString()}</p><p style={{ fontSize: 18 }}>{story.summary}</p><div className="about-tags">{story.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, marginTop: 24 }}>{story.body}</div></article></main>;
}
