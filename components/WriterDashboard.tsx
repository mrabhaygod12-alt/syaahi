"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { Story } from "@/lib/writing/stories";
import WriterShell, { useWriter, WriterAvatar } from "./writer/WriterShell";
import Modal from "./Modal";
type View = "home" | "stories" | "library" | "stats";
const date = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function StoryRow({
  story,
  own = false,
  onDelete,
}: {
  story: Partial<Story>;
  own?: boolean;
  onDelete?: (id: string) => void;
}) {
  const href =
    own && story.status !== "published"
      ? `/write?draft=${story.id}`
      : `/guides/${story.slug}`;
  const cover = story.document?.content?.find((n) => n.type === "image")?.attrs
    ?.src;
  return (
    <article className="writer-story-row">
      <div>
        <p className="writer-story-byline">
          {story.authorName}{" "}
          <span>
            · {date(story.publishedAt || story.updatedAt || story.createdAt!)}
            {own && ` · ${story.status?.replaceAll("_", " ")}`}
          </span>
        </p>
        <a className="writer-story-title" href={href}>
          <h2>{story.title}</h2>
        </a>
        <p className="writer-story-summary">{story.summary}</p>
        <div className="writer-story-meta">
          <span>
            {Math.max(
              1,
              Math.ceil((story.body?.split(/\s+/).length || 0) / 220),
            )}{" "}
            min read
          </span>
          {story.tags?.slice(0, 2).map((tag) => (
            <a
              key={tag}
              className="writer-topic"
              href={`/writer?q=${encodeURIComponent(tag)}`}
            >
              {tag}
            </a>
          ))}
          {own && story.status !== "published" && <a href={href}>Edit draft</a>}
          {own && ["draft", "changes_requested"].includes(story.status!) && (
            <button
              className="writer-text-button"
              onClick={() => onDelete?.(story.id!)}
            >
              Delete
            </button>
          )}
        </div>
        {story.reviewNote && own && (
          <p className="writer-review-note">Editor: {story.reviewNote}</p>
        )}
      </div>
      {cover && (
        <a href={href} className="writer-story-cover">
          <img src={String(cover)} alt="Story cover" />
        </a>
      )}
    </article>
  );
}
function DashboardContent({ view }: { view: View }) {
  const { profile } = useWriter();
  const [stories, setStories] = useState<Story[]>([]),
    [analytics, setAnalytics] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("draft"),
    [search, setSearch] = useState(""),
    [remove, setRemove] = useState<string | null>(null),
    [deleting, setDeleting] = useState(false);
  const load = () => {
    setLoading(true);
    setError("");
    requestJson(
      view === "home"
        ? "/api/publications"
        : view === "library"
          ? "/api/writer/library"
          : "/api/stories",
    )
      .then(({ response, data }) => {
        if (!response.ok)
          throw new Error(data.error || "Could not load stories.");
        setStories(data.stories || []);
        setAnalytics(data.analytics);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  };
  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get("q") || "");
    load();
  }, [view]);
  const visible = stories.filter(
    (s) =>
      (view !== "stories" ||
        filter === "all" ||
        (filter === "draft"
          ? ["draft", "changes_requested"].includes(s.status)
          : s.status === filter)) &&
      `${s.title} ${s.summary} ${s.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const titles = {
    home: "For the curious mind.",
    stories: "Your stories",
    library: "Your library",
    stats: "Your impact",
  };
  return (
    <div className="writer-content-layout">
      <section className="writer-primary">
        <p className="writer-kicker">
          {view === "home" ? "READ. THINK. WRITE." : "YOUR WRITING SPACE"}
        </p>
        <div className="writer-page-heading">
          <h1>{titles[view]}</h1>
          {view === "stories" && (
            <a className="btn dark" href="/write">
              Write a story
            </a>
          )}
        </div>
        <p className="writer-description">
          {view === "home"
            ? "Ideas worth spending time with. Discover stories from the Syaahi community."
            : view === "stories"
              ? "Every idea starts as a draft. Pick up where you left off."
              : view === "library"
                ? "Stories you saved, ready when you are."
                : "See how your published stories are finding readers."}
        </p>
        {view === "stories" && (
          <div className="writer-tabs" role="tablist" aria-label="Story status">
            {[
              ["draft", "Drafts"],
              ["submitted", "In review"],
              ["published", "Published"],
              ["all", "All stories"],
            ].map(([key, label]) => (
              <button
                role="tab"
                aria-selected={filter === key}
                key={key}
                onClick={() => setFilter(key)}
              >
                {label}{" "}
                <small>
                  {
                    stories.filter(
                      (s) =>
                        key === "all" ||
                        (key === "draft"
                          ? ["draft", "changes_requested"].includes(s.status)
                          : s.status === key),
                    ).length
                  }
                </small>
              </button>
            ))}
          </div>
        )}
        {view !== "stats" && (
          <input
            className="writer-list-search"
            type="search"
            aria-label="Filter stories"
            placeholder="Search titles, summaries or topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        {loading ? (
          <p role="status" className="writer-empty">
            Loading stories…
          </p>
        ) : error ? (
          <div className="writer-empty">
            <p role="alert">{error}</p>
            <button className="btn light" onClick={load}>
              Try again
            </button>
          </div>
        ) : view === "stats" ? (
          <>
            <div className="writer-metrics">
              {[
                [analytics?.approximateGuideOpens || 0, "Story opens"],
                [analytics?.published || 0, "Published stories"],
                [analytics?.drafts || 0, "Drafts"],
                [analytics?.inReview || 0, "In review"],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="writer-fine-print">
              Story opens are approximate page views, including repeat visits.
              They do not measure completed reads or unique readers. Counts
              below cover your latest 50 stories.
            </p>
            <div className="writer-stats-table">
              <table>
                <thead>
                  <tr>
                    <th>Story</th>
                    <th>Status</th>
                    <th>Opens</th>
                  </tr>
                </thead>
                <tbody>
                  {stories.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <a
                          href={
                            s.status === "published"
                              ? `/guides/${s.slug}`
                              : `/write?draft=${s.id}`
                          }
                        >
                          {s.title}
                        </a>
                      </td>
                      <td>{s.status.replaceAll("_", " ")}</td>
                      <td>{s.analytics?.views || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!stories.length && (
              <p className="writer-empty">
                Publish your first story to start seeing your impact.
              </p>
            )}
          </>
        ) : visible.length ? (
          visible.map((s) => (
            <StoryRow
              key={s.id || s.slug}
              story={s}
              own={view === "stories"}
              onDelete={setRemove}
            />
          ))
        ) : (
          <div className="writer-empty">
            <span className="writer-empty-symbol">✎</span>
            <h2>
              {search
                ? "No matching stories"
                : view === "library"
                  ? "Make room for a good read."
                  : view === "home"
                    ? "The next great idea could be yours."
                    : "A fresh page is waiting."}
            </h2>
            <p>
              {view === "library"
                ? "Use Save on a published story to keep it here."
                : "Start with a thought, an experience or something you have learned."}
            </p>
            <a
              className="btn light"
              href={view === "library" ? "/writer" : "/write"}
            >
              {view === "library"
                ? "Discover stories"
                : "Write your first story"}
            </a>
          </div>
        )}
      </section>
      <aside className="writer-right-rail">
        <WriterAvatar profile={profile} size={64} />
        <h3>{profile.name}</h3>
        <p>
          {profile.bio ||
            "Your perspective is worth sharing. Make your writer profile your own."}
        </p>
        <a href="/writer/profile">View your profile →</a>
        <hr />
        <p className="writer-kicker">MAKE SOMETHING MEANINGFUL</p>
        <h3>One idea. A thousand possibilities.</h3>
        <p>Write a guide, share a lesson, or tell a story only you can tell.</p>
        <a className="btn dark" href="/write">
          Start writing
        </a>
        <hr />
        <h3>More room to create</h3>
        <p>
          One membership covers learning and writing. Your balance follows your
          account.
        </p>
        <a href="/pricing">Explore membership ↗</a>
      </aside>
      {remove && (
        <Modal
          title="Delete draft"
          onClose={() => {
            if (!deleting) setRemove(null);
          }}
        >
          <h2>Delete this draft?</h2>
          <p>
            This permanently deletes the saved draft and its revision history.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="writer-dialog-actions">
            <button
              className="btn light"
              disabled={deleting}
              onClick={() => setRemove(null)}
            >
              Keep draft
            </button>
            <button
              className="btn dark"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                setError("");
                try {
                  const { response, data } = await requestJson(
                    `/api/stories?id=${remove}`,
                    { method: "DELETE" },
                  );
                  if (!response.ok) throw new Error(data.error);
                  setStories((old) => old.filter((s) => s.id !== remove));
                  setRemove(null);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not delete.",
                  );
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete draft"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function WriterDashboard({ view = "home" }: { view?: View }) {
  return (
    <WriterShell>
      <DashboardContent view={view} />
    </WriterShell>
  );
}
