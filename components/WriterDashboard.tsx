"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { Story } from "@/lib/writing/stories";
import WriterShell, { useWriter, WriterAvatar } from "./writer/WriterShell";
import Modal from "./Modal";
import "./writer/preferences.css";
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
  publicFeed = false,
  onUnsave,
  onPublication,
  publicationBusy = false,
  reason,
}: {
  story: Partial<Story>;
  own?: boolean;
  onDelete?: (id: string) => void;
  publicFeed?: boolean;
  onUnsave?: (slug: string) => void;
  onPublication?: (
    story: Story,
    action: "revise" | "unpublish" | "cancel_schedule",
  ) => void;
  publicationBusy?: boolean;
  reason?: string;
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
        {reason && <p className="writer-recommendation-reason">{reason}</p>}
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
              href={`${publicFeed ? "/community" : "/writer"}?q=${encodeURIComponent(tag)}`}
            >
              {tag}
            </a>
          ))}
          {own && ["draft", "changes_requested"].includes(story.status!) && (
            <a href={href}>Edit draft</a>
          )}
          {own && ["published", "unpublished"].includes(story.status!) && (
            <button
              className="writer-text-button"
              disabled={publicationBusy}
              onClick={() => onPublication?.(story as Story, "revise")}
            >
              {story.pendingRevisionId
                ? "Open private revision"
                : story.status === "unpublished"
                  ? "Revise and republish"
                  : "Edit private revision"}
            </button>
          )}
          {own && story.status === "published" && (
            <button
              className="writer-text-button"
              disabled={publicationBusy || !!story.pendingRevisionId}
              onClick={() => onPublication?.(story as Story, "unpublish")}
            >
              Unpublish
            </button>
          )}
          {own && story.status === "scheduled" && (
            <button
              className="writer-text-button"
              disabled={publicationBusy}
              onClick={() => onPublication?.(story as Story, "cancel_schedule")}
            >
              Cancel schedule
            </button>
          )}
          {onUnsave && (
            <button
              className="writer-text-button"
              onClick={() => onUnsave(story.slug!)}
            >
              Remove from library
            </button>
          )}
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
        {own && story.scheduledFor && (
          <p className="writer-review-note">
            Approved · Scheduled for{" "}
            {new Date(story.scheduledFor).toLocaleString()}
          </p>
        )}
        {own && story.revisionOf && (
          <p className="writer-fine-print">
            Private revision of your original article.
          </p>
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
  const [feedMode, setFeedMode] = useState("for_you"),
    [reasons, setReasons] = useState<Record<string, string>>({});
  const requestController = useRef<AbortController | null>(null);
  const [stories, setStories] = useState<Story[]>([]),
    [analytics, setAnalytics] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("draft"),
    [search, setSearch] = useState(""),
    [remove, setRemove] = useState<string | null>(null),
    [deleting, setDeleting] = useState(false);
  const [publication, setPublication] = useState<{
      story: Story;
      action: "unpublish" | "cancel_schedule";
    } | null>(null),
    [publicationBusy, setPublicationBusy] = useState(false),
    [publicationError, setPublicationError] = useState("");
  async function changePublication(
    story: Story,
    action: "revise" | "unpublish" | "cancel_schedule",
  ) {
    if (publicationBusy) return;
    setPublicationBusy(true);
    setPublicationError("");
    try {
      const { response, data } = await requestJson("/api/writer/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: story.id,
          expectedUpdatedAt: story.updatedAt,
          action,
        }),
      });
      if (!response.ok) throw new Error(data.error);
      if (action === "revise")
        location.assign(`/write?draft=${encodeURIComponent(data.story.id)}`);
      else {
        setPublication(null);
        setFilter(action === "unpublish" ? "unpublished" : "draft");
        load();
      }
    } catch (e) {
      setPublicationError(
        e instanceof Error ? e.message : "Could not change this publication.",
      );
    } finally {
      setPublicationBusy(false);
    }
  }
  const load = () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setError("");
    requestJson(
      view === "home"
        ? `/api/writer/feed?mode=${feedMode}`
        : view === "library"
          ? "/api/writer/library"
          : "/api/stories",
      { signal: controller.signal },
    )
      .then(({ response, data }) => {
        if (
          controller.signal.aborted ||
          requestController.current !== controller
        )
          return;
        if (!response.ok)
          throw new Error(data.error || "Could not load stories.");
        setStories(data.stories || []);
        setReasons(data.reasons || {});
        setAnalytics(data.analytics);
        setLoading(false);
      })
      .catch((e) => {
        if (
          controller.signal.aborted ||
          requestController.current !== controller
        )
          return;
        setError(e.message);
        setLoading(false);
      });
  };
  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get("q") || "");
    load();
    return () => requestController.current?.abort();
  }, [view, feedMode, profile.owner]);
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
        {view === "library" && (
          <a className="btn light" href="/writer/reading">
            Continue reading, highlights & following →
          </a>
        )}
        {view === "home" && (
          <>
            <div
              className="writer-tabs"
              role="tablist"
              aria-label="Reading feed"
            >
              {[
                ["for_you", "For you"],
                ["latest", "Latest"],
                ["following", "Following"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={feedMode === key}
                  onClick={() => setFeedMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="writer-fine-print">
              Chosen topics, followed writers and different perspectives.{" "}
              <a href="/writer/settings#reading-preferences">
                Refine your reading preferences
              </a>
            </p>
          </>
        )}
        {view === "stories" && (
          <div className="writer-tabs" role="tablist" aria-label="Story status">
            {[
              ["draft", "Drafts"],
              ["submitted", "In review"],
              ["published", "Published"],
              ["scheduled", "Scheduled"],
              ["unpublished", "Unpublished"],
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
        {publicationError && !publication && (
          <p role="alert" className="writer-empty">
            {publicationError}
          </p>
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
                [analytics?.qualifiedReaders || 0, "Signed-in readers · 30s"],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="writer-fine-print">
              Story opens are approximate page views, including repeat visits.
              Qualified reader counts reflect signed-in accounts with at least
              30 seconds of reported active reading, bounded by server time.
              They do not prove completion or attention. Story opens cover your
              latest 50 stories.
            </p>
            <div className="writer-impact-chart">
              <h2>Your most opened stories</h2>
              {stories
                .filter((s) => s.status === "published")
                .sort(
                  (a, b) =>
                    (b.analytics?.views || 0) - (a.analytics?.views || 0),
                )
                .slice(0, 5)
                .map((s) => (
                  <div key={s.id}>
                    <span>{s.title}</span>
                    <div>
                      <i
                        style={{
                          width: `${Math.max(2, ((s.analytics?.views || 0) / Math.max(1, ...stories.map((t) => t.analytics?.views || 0))) * 100)}%`,
                        }}
                      />
                    </div>
                    <b>{s.analytics?.views || 0}</b>
                  </div>
                ))}
              {!stories.some((s) => s.status === "published") && (
                <p>Published stories will appear here.</p>
              )}
            </div>
            <div className="writer-stats-table">
              <table>
                <thead>
                  <tr>
                    <th>Story</th>
                    <th>Status</th>
                    <th>Opens</th>
                    <th>Readers · 30s</th>
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
                      <td>{analytics?.byStory?.[s.id] || 0}</td>
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
              publicationBusy={publicationBusy}
              reason={view === "home" ? reasons[s.slug!] : undefined}
              onPublication={(story, action) => {
                setPublicationError("");
                if (action === "revise") void changePublication(story, action);
                else setPublication({ story, action });
              }}
              onUnsave={
                view === "library"
                  ? async (slug) => {
                      try {
                        const { response, data } = await requestJson(
                          `/api/publications/${encodeURIComponent(slug)}/engagement`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "bookmark",
                              value: false,
                            }),
                          },
                        );
                        if (!response.ok) throw new Error(data.error);
                        setStories((old) => old.filter((s) => s.slug !== slug));
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Could not remove saved story.",
                        );
                      }
                    }
                  : undefined
              }
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
        <a href="/writer/membership">Explore membership ↗</a>
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
      {publication && (
        <Modal
          title={
            publication.action === "unpublish"
              ? "Unpublish article"
              : "Cancel publication schedule"
          }
          onClose={() => {
            if (!publicationBusy) setPublication(null);
          }}
        >
          <p className="writer-kicker">YOUR PUBLICATION</p>
          <h2>
            {publication.action === "unpublish"
              ? "Take this article offline?"
              : "Return this article to drafts?"}
          </h2>
          <p>{publication.story.title}</p>
          <p>
            {publication.action === "unpublish"
              ? "Readers will no longer be able to open the public article. Your content and existing URL are retained. Republish through a private revision and fresh editorial review."
              : "The approved schedule will be cancelled. Your content returns to drafts and needs fresh editorial approval before publication."}
          </p>
          {publicationError && <p role="alert">{publicationError}</p>}
          <div className="writer-dialog-actions">
            <button
              className="btn light"
              disabled={publicationBusy}
              onClick={() => setPublication(null)}
            >
              Keep current state
            </button>
            <button
              className="btn dark"
              disabled={publicationBusy}
              onClick={() =>
                void changePublication(publication.story, publication.action)
              }
            >
              {publicationBusy
                ? "Saving…"
                : publication.action === "unpublish"
                  ? "Confirm unpublish"
                  : "Confirm cancel schedule"}
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
