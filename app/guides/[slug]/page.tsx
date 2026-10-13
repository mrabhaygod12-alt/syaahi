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
import { publicCreator } from "@/lib/writing/public-profile";
import {
  readerDocument,
  readerDocumentText,
  readerHeadings,
  readerCover,
} from "@/lib/writing/reader-document";
import "../article.css";

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
    title: story.searchMetadata?.title || story.title,
    description: story.searchMetadata?.description || story.summary,
    path: `/guides/${story.slug}`,
    article: {
      author: story.authorName,
      publishedAt: story.publishedAt || story.createdAt,
    },
  });
  const cover = readerCover(story.document);
  return {
    ...metadata,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large" as const,
      },
    },
    openGraph: {
      ...metadata.openGraph,
      modifiedTime: story.updatedAt,
      ...(cover
        ? { images: [{ url: `${SITE.url}${cover.src}`, alt: cover.alt }] }
        : {}),
    },
    ...(cover
      ? {
          twitter: { ...metadata.twitter, images: [`${SITE.url}${cover.src}`] },
        }
      : {}),
    ...(story.canonicalUrl
      ? { alternates: { canonical: story.canonicalUrl } }
      : {}),
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const story = await getPublicStory((await params).slug);
  if (!story) notFound();
  const [related, creator] = await Promise.all([
    publicGuides("related", story.slug!).catch(() => []),
    publicCreator(story.creatorSlug).catch(() => null),
  ]);
  const document = readerDocument(story.document, story.body);
  const headings = readerHeadings(document);
  const words = readerDocumentText(story.document, story.body)
    .trim()
    .split(/\s+/).length;
  const readingMinutes = Math.max(1, Math.ceil(words / 220));
  const publishedAt = story.publishedAt || story.createdAt;
  const cover = readerCover(story.document);
  return (
    <main className="public-article">
      <PublicationEngagement slug={story.slug!} />
      <nav className="article-breadcrumb" aria-label="Breadcrumb">
        <a href="/blog">Syaahi Blog</a>
        <span aria-hidden="true">/</span>
        <span>Reviewed story</span>
      </nav>
      <article className="public-article-sheet">
        <header className="public-article-header">
          <div className="article-edition">
            <span>Ideas worth spending time with</span>
            <span>Reviewed on Syaahi</span>
          </div>
          <p className="article-category">{story.tags[0] || "Perspective"}</p>
          <h1>{story.title}</h1>
          <p className="article-deck">{story.summary}</p>
          <div className="article-author-row">
            <a
              className="article-author-avatar"
              href={`/creators/${story.creatorSlug}`}
              aria-label={`${story.authorName}’s profile`}
            >
              {creator?.avatar ? (
                <img src={creator.avatar} alt="" width={48} height={48} />
              ) : (
                <span aria-hidden="true">
                  {story.authorName.charAt(0).toUpperCase()}
                </span>
              )}
            </a>
            <div className="article-author-details">
              <a href={`/creators/${story.creatorSlug}`}>{story.authorName}</a>
              <p>
                <time dateTime={publishedAt}>
                  {new Date(publishedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
                <span aria-hidden="true"> · </span>
                {readingMinutes} min read
              </p>
            </div>
            <FollowWriter slug={story.creatorSlug} />
          </div>
          <div className="article-topic-tags" aria-label="Story topics">
            {story.tags.map((tag) => (
              <a key={tag} href={`/blog?topic=${encodeURIComponent(tag)}`}>
                {tag}
              </a>
            ))}
          </div>
        </header>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: story.title,
              description: story.summary,
              datePublished: story.publishedAt || story.createdAt,
              dateModified: story.updatedAt,
              ...(cover ? { image: `${SITE.url}${cover.src}` } : {}),
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
                { name: "Syaahi Blog", path: "/blog" },
                { name: story.title, path: `/guides/${story.slug}` },
              ]),
            ),
          }}
        />
        <div
          className={`article-reading-layout${headings.length > 1 ? " has-contents" : ""}`}
        >
          {headings.length > 1 && (
            <aside className="article-contents">
              <details open>
                <summary>In this story</summary>
                <nav aria-label="Story sections">
                  <ol>
                    {headings.map((heading) => (
                      <li
                        key={heading.id}
                        className={heading.level === 3 ? "nested" : ""}
                      >
                        <a href={`#${heading.id}`}>{heading.text}</a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </details>
            </aside>
          )}
          <div className="article-reading-column">
            <StoryReader
              slug={story.slug!}
              afterContent={<PublicationActions slug={story.slug!} />}
            >
              <StoryDocument
                document={document}
                fallback={story.body}
                embedded
              />
            </StoryReader>
            <ReportPublication slug={story.slug!} />
          </div>
        </div>
      </article>
      {related.length > 0 && (
        <section
          aria-labelledby="related-reading"
          className="related-public-reading"
        >
          <p className="eyebrow">KEEP YOUR CURIOSITY GOING</p>
          <h2 id="related-reading">A few more perspectives</h2>
          <div>
            {related.map((s) => (
              <article key={s.slug}>
                <p className="small">{s.authorName}</p>
                <a href={`/guides/${s.slug}`}>
                  <h3>{s.title}</h3>
                </a>
                <p>{s.summary}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
