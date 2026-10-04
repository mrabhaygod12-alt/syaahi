"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import WorkspaceSwitch from "./WorkspaceSwitch";
export default function WriterDashboard() {
  const [data, setData] = useState<any>(null),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [guest, setGuest] = useState(false);
  useEffect(() => {
    requestJson("/api/stories")
      .then(({ response, data }) => {
        if (response.status === 401) {
          setGuest(true);
          return;
        }
        if (!response.ok) throw new Error(data.error);
        setData(data);
      })
      .catch((e) => setError(e.message));
  }, []);
  const stories = (data?.stories || []).filter(
    (s: any) => filter === "all" || s.status === filter,
  );
  return (
    <div className="writer-dashboard wrap">
      <aside>
        <h2>Your writing</h2>
        <a href="/write">New story</a>
        <a href="/profile">Profile & biography</a>
        <a href="/community">Community</a>
        <a href="/account/billing">Subscription</a>
        <WorkspaceSwitch current="writer" />
      </aside>
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">WRITER DASHBOARD</p>
            <h1>Your stories, from draft to publication</h1>
            <p>
              Write useful guides. Review feedback. Follow your published work.
            </p>
          </div>
          <a className="btn dark" href="/write">
            Write a story
          </a>
        </div>
        {guest ? (
          <a className="btn dark" href="/login?next=/writer">
            Log in to view your stories
          </a>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p role="status">Loading your stories…</p>
        ) : (
          <>
            <div className="writer-stats">
              <span>
                <b>{data.analytics?.drafts || 0}</b> drafts
              </span>
              <span>
                <b>{data.analytics?.inReview || 0}</b> in review
              </span>
              <span>
                <b>{data.analytics?.published || 0}</b> published
              </span>
              <span>
                <b>{data.analytics?.approximateGuideOpens || 0}</b> approximate
                guide opens
              </span>
            </div>
            <label>
              Show stories
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All stories</option>
                <option value="draft">Drafts</option>
                <option value="submitted">In review</option>
                <option value="changes_requested">Changes requested</option>
                <option value="published">Published</option>
              </select>
            </label>
            <div className="writer-story-list">
              {stories.map((s: any) => (
                <article key={s.id}>
                  <div>
                    <h2>
                      <a href={`/write?draft=${s.id}`}>{s.title}</a>
                    </h2>
                    <p>{s.summary}</p>
                    <small>
                      {s.status.replaceAll("_", " ")} ·{" "}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                  <a
                    className="btn light"
                    href={
                      s.status === "published"
                        ? `/guides/${s.slug}`
                        : `/write?draft=${s.id}`
                    }
                  >
                    {s.status === "published"
                      ? "Read published guide"
                      : "Open draft"}
                  </a>
                </article>
              ))}
              {!stories.length && (
                <div className="card">
                  <h2>
                    {filter === "all"
                      ? "Your first story starts here"
                      : "No stories in this view"}
                  </h2>
                  <p>
                    Your drafts are private until editorial review is complete.
                  </p>
                  <a href="/write">Start writing</a>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
