import { notFound } from "next/navigation";
import { publicGuides } from "@/lib/writing/public";
import { cache } from "react";
const getPublicStory = cache(
  async (slug: string) => (await publicGuides("slug", slug))[0],
);
import { pageMeta } from "@/lib/seo";
import ReportPublication from "@/components/ReportPublication";
import PublicationEngagement from "@/components/PublicationEngagement";
import PublicationActions from "@/components/PublicationActions";
import StoryDocument from "@/components/StoryDocument";
import StoryReader from "@/components/writer/StoryReader";
import FollowWriter from "@/components/writer/FollowWriter";
import { SITE, jsonLd, breadcrumbSchema } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const story = await getPublicStory((await params).slug);
  if (!story)
    return pageMeta({
      title: "Article not found",
      description: "This article or guide is unavailable.",
      path: "/community",
      noindex: true,
    });
  const metadata = pageMeta({
    title: story.title,
    description: story.summary,
    path: `/guides/${story.slug}`,
    article: {
      author: story.authorName,
      publishedAt: story.publishedAt || story.createdAt,
    },
  });
  return story.canonicalUrl
    ? { ...metadata, alternates: { canonical: story.canonicalUrl } }
    : metadata;
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const story = await getPublicStory((await params).slug);
  if (!story) notFound();
  return (
    <main className="wrap feature-section">
      <PublicationEngagement slug={story.slug!} />
      <article className="interactive-panel" style={{ maxWidth: 860 }}>
        <p className="eyebrow">REVIEWED ARTICLE</p>
        <h1>{story.title}</h1>
        <p className="small">
          By <a href={`/creators/${story.creatorSlug}`}>{story.authorName}</a> ·
          Published{" "}
          {new Date(story.publishedAt || story.createdAt).toLocaleDateString()}
        </p>
        <p style={{ fontSize: 18 }}>{story.summary}</p>
        <FollowWriter slug={story.creatorSlug} />
        <div className="about-tags">
          {story.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: story.title,
              description: story.summary,
              datePublished: story.publishedAt || story.createdAt,
              author: {
                "@type": "Person",
                name: story.authorName,
                url: `${SITE.url}/creators/${story.creatorSlug}`,
              },
              mainEntityOfPage: `${SITE.url}/guides/${story.slug}`,
              publisher: { "@id": `${SITE.url}/#organization` },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbSchema([
                { name: "Community articles", path: "/community" },
                { name: story.title, path: `/guides/${story.slug}` },
              ]),
            ),
          }}
        />
        <StoryReader slug={story.slug!}>
          <StoryDocument document={story.document} fallback={story.body} />
        </StoryReader>
        <PublicationActions slug={story.slug!} />
        <ReportPublication slug={story.slug!} />
      </article>
    </main>
  );
}
