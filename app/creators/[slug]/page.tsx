import { notFound } from "next/navigation";
import { publicGuides } from "@/lib/writing/public";
import { publicCreator } from "@/lib/writing/public-profile";
import { pageMeta } from "@/lib/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [profile, stories] = await Promise.all([
    publicCreator(slug),
    publicGuides("creator", slug),
  ]);
  const name = profile?.name || stories[0]?.authorName;
  return pageMeta({
    title: name ? `${name} | Syaahi Author` : "Creator not found",
    description: profile?.bio || `Read reviewed stories on Syaahi.`,
    path: `/creators/${slug}`,
    noindex: !name,
  });
}
export default async function CreatorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [profile, stories] = await Promise.all([
    publicCreator(slug),
    publicGuides("creator", slug),
  ]);
  if (!profile && !stories.length) notFound();
  const name = profile?.name || stories[0].authorName;
  return (
    <div className="writer-app">
      <div className="writer-content-layout">
        <section className="writer-primary">
          <p className="writer-kicker">SYAAHI WRITERS</p>
          <h1>{name}</h1>
          <div className="writer-tabs">
            <a href="#stories">Stories</a>
            <a href="#about">About</a>
          </div>
          <div id="stories">
            {stories.length ? (
              stories.map((story) => (
                <article key={story.slug} className="writer-story-row">
                  <div>
                    <p className="writer-story-byline">
                      {name} ·{" "}
                      {new Date(
                        story.publishedAt || story.createdAt,
                      ).toLocaleDateString("en-IN")}
                    </p>
                    <a
                      className="writer-story-title"
                      href={`/guides/${story.slug}`}
                    >
                      <h2>{story.title}</h2>
                    </a>
                    <p className="writer-story-summary">{story.summary}</p>
                    <div className="writer-story-meta">
                      {story.tags.map((tag) => (
                        <span key={tag} className="writer-topic">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="writer-empty">
                Published stories will appear here.
              </p>
            )}
          </div>
          {profile?.about && (
            <section className="writer-about" id="about">
              <h2>About {name}</h2>
              <p>{profile.about}</p>
            </section>
          )}
        </section>
        <aside className="writer-right-rail">
          {profile?.avatar ? (
            <span className="writer-avatar" style={{ width: 88, height: 88 }}>
              <img src={profile.avatar} alt={name} />
            </span>
          ) : (
            <span className="writer-avatar" style={{ width: 88, height: 88 }}>
              {name.charAt(0)}
            </span>
          )}
          <h3>
            {name} <small>{profile?.pronouns?.join(" · ")}</small>
          </h3>
          <p>{profile?.bio}</p>
          {profile?.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              Visit website ↗
            </a>
          )}
          <hr />
          <a href="/community">Discover more stories →</a>
        </aside>
      </div>
    </div>
  );
}
