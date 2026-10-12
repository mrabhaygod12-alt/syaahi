import { pageMeta, jsonLd, SITE } from "@/lib/seo";
import { blogFeed } from "@/lib/blog-feed";
import "./blog.css";
export const dynamic = "force-dynamic";
export const metadata = pageMeta({
  title: "Blog: AI, Computer Science & University Learning",
  description:
    "Read reviewed writer articles and practical study guides on AI, cybersecurity, computer science and UG/PG learning. Explore new perspectives on Syaahi.",
  path: "/blog",
});
metadata.alternates = {
  ...metadata.alternates,
  types: { "application/rss+xml": "/feed.xml" },
};
export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; topic?: string; page?: string }>;
}) {
  const { entries, unavailable } = await blogFeed();
  const query = await searchParams;
  const search =
    typeof query.q === "string" ? query.q.slice(0, 120).trim() : "";
  const topic = typeof query.topic === "string" ? query.topic.slice(0, 60) : "";
  const filtered = entries.filter(
    (e) =>
      (!topic || e.tags.some((t) => t.toLowerCase() === topic.toLowerCase())) &&
      (!search ||
        [e.title, e.excerpt, e.author, e.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const page = Math.max(
    1,
    Math.min(pages, Math.floor(Number(query.page) || 1)),
  );
  const current = filtered.slice((page - 1) * 12, page * 12);
  const topics = [...new Set(entries.flatMap((e) => e.tags))].slice(0, 12);
  const link = (next: number) =>
    "/blog?" +
    new URLSearchParams({
      ...(search ? { q: search } : {}),
      ...(topic ? { topic } : {}),
      page: String(next),
    });
  return (
    <main className="syaahi-blog">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "Syaahi Blog",
            url: SITE.url + "/blog",
            publisher: {
              "@type": "Organization",
              name: SITE.name,
              url: SITE.url,
            },
            blogPost: current.map((e) => ({
              "@type": "BlogPosting",
              headline: e.title,
              description: e.excerpt,
              url: SITE.url + e.href,
              datePublished: e.date,
              author: { "@type": "Person", name: e.author },
            })),
          }),
        }}
      />
      <header className="blog-masthead">
        <p className="eyebrow">THE SYAAHI JOURNAL</p>
        <h1>
          Ideas for your
          <br />
          <em>next breakthrough.</em>
        </h1>
        <p>
          AI, computer science, cybersecurity and university learning.
          <br />
          Reviewed stories from writers, alongside practical study guides.
        </p>
        <div className="blog-edition">
          <span>FOR CURIOUS UG & PG MINDS</span>
          <a href="/feed.xml">Follow the story feed ↗</a>
        </div>
      </header>
      <section aria-label="Find articles" className="blog-search">
        <form action="/blog">
          <label className="sr-only" htmlFor="blog-query">
            Search articles
          </label>
          <input
            id="blog-query"
            name="q"
            defaultValue={search}
            maxLength={120}
            placeholder="Find an idea, topic or author…"
          />
          <button className="btn dark">Search</button>
        </form>
        <nav aria-label="Blog topics">
          <a href="/blog" aria-current={!topic ? "page" : undefined}>
            All stories
          </a>
          {topics.map((t) => (
            <a
              href={"/blog?topic=" + encodeURIComponent(t)}
              aria-current={topic === t ? "page" : undefined}
              key={t}
            >
              {t}
            </a>
          ))}
        </nav>
      </section>
      {unavailable && (
        <p className="blog-service-note" role="status">
          Writer articles are temporarily unavailable. Study guides remain
          available. <a href="/blog">Try again</a>
        </p>
      )}
      <section className="blog-stories" aria-label="Blog articles">
        {current.map((post, i) => (
          <article className="blog-story" key={post.href}>
            <a
              href={post.href}
              className="blog-art"
              aria-label={"Read " + post.title}
            >
              {post.image ? (
                <img
                  src={post.image.src}
                  alt={post.image.alt}
                  loading="lazy"
                  width={720}
                  height={405}
                />
              ) : (
                <div
                  className={"blog-type-art art-" + (i % 3)}
                  aria-hidden="true"
                >
                  <span>{post.category}</span>
                  <strong>{["Aa", "{ }", "↗"][i % 3]}</strong>
                  <small>SYAAHI · IDEAS & INSIGHT</small>
                </div>
              )}
            </a>
            <div className="blog-story-body">
              <p className="blog-category">
                {post.category}{" "}
                <span>
                  {post.kind === "writer" ? "Reviewed story" : "Study guide"}
                </span>
              </p>
              <h2>
                <a href={post.href}>{post.title}</a>
              </h2>
              <p>{post.excerpt}</p>
              <div className="blog-byline">
                <span>{post.author}</span>
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Kolkata",
                  })}
                </time>
              </div>
            </div>
          </article>
        ))}
      </section>
      {!current.length && (
        <div className="blog-empty">
          <h2>No matching stories yet.</h2>
          <p>Try a broader topic or explore all articles.</p>
          <a className="btn light" href="/blog">
            Browse all stories
          </a>
        </div>
      )}
      {pages > 1 && (
        <nav className="blog-pagination" aria-label="Blog pagination">
          {page > 1 && <a href={link(page - 1)}>← Previous</a>}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages && <a href={link(page + 1)}>Next →</a>}
        </nav>
      )}
      <aside className="blog-learning-callout">
        <div>
          <p className="eyebrow">TURN READING INTO UNDERSTANDING</p>
          <h2>Put a new idea to work.</h2>
          <p>
            Explore source-aware notes and recall practice in your learning
            workspace.
          </p>
        </div>
        <a className="btn dark" href="/dashboard">
          Open learning workspace ↗
        </a>
      </aside>
    </main>
  );
}
