import { publicGuides } from "@/lib/writing/public";

export default async function CommunityPublications() {
  const items = await publicGuides();
  return (
    <>
      <div className="steps-grid">
        {items.map((item) => (
          <article key={item.slug} className="interactive-panel">
            <p className="eyebrow">REVIEWED ARTICLE</p>
            <h2>{item.title}</h2>
            <p>{item.summary}</p>
            <p className="small">
              By <a href={`/creators/${item.creatorSlug}`}>{item.authorName}</a>{" "}
              ·{" "}
              {new Date(item.publishedAt || item.createdAt).toLocaleDateString(
                "en-IN",
              )}
            </p>
            <div className="about-tags">
              {item.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <a className="btn dark" href={`/guides/${item.slug}`}>
              Read article →
            </a>
          </article>
        ))}
      </div>
      {!items.length && (
        <div className="card">
          <h2>Your explanation could help the next reader.</h2>
          <p>
            Draft an article or guide in Writer Studio and submit it for
            editorial review.
          </p>
          <a className="btn dark" href="/write">
            Open Writer Studio
          </a>
        </div>
      )}
    </>
  );
}
