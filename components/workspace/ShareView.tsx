"use client";
import { useEffect, useState } from "react";
import { useLesson } from "./LessonProvider";
export default function ShareView() {
  const { job } = useLesson();
  const [data, setData] = useState<any>(null),
    [role, setRole] = useState("viewer"),
    [url, setUrl] = useState(""),
    [comment, setComment] = useState(""),
    [section, setSection] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    if (!job) return;
    const r = await fetch(`/api/collaboration?lesson=${job.id}`);
    const d = await r.json();
    if (r.ok) setData(d);
    else setError(d.error);
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 10000);
    return () => clearInterval(timer);
  }, [job?.id]);
  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson: job?.id, ...body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.url) setUrl(location.origin + d.url);
      if (body.action === "comment") setComment("");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sharing could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!job) return null;
  return (
    <div className="quiz-room">
      <span className="eyebrow">LEARN TOGETHER</span>
      <h1>Share ideas. Keep control.</h1>
      <p className="small">
        Links share note content, not your original uploaded source. Anyone with
        an active link can read the notes. An editor link also lets a signed-in
        recipient join and edit. Changes refresh automatically; conflicting
        saves are rejected.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {data?.role === "owner" && (
        <section className="card">
          <h2>Invite someone to this lesson</h2>
          <label>
            Access level
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="viewer">Read notes and discuss</option>
              <option value="editor">Read, discuss, and edit notes</option>
            </select>
          </label>
          <button
            className="btn dark"
            disabled={busy}
            onClick={() => action({ action: "create", role })}
          >
            Create a share link
          </button>
          {url && (
            <div className="share-link">
              <input aria-label="New share link" readOnly value={url} />
              <button
                className="btn light"
                onClick={() =>
                  navigator.clipboard
                    .writeText(url)
                    .catch(() => setError("Copy the link from the field."))
                }
              >
                Copy link
              </button>
            </div>
          )}
          <h3>Active links</h3>
          {data.links.map((l: any) => (
            <p key={l.id} className="section-heading">
              <span>
                {l.role} · {new Date(l.created).toLocaleDateString()}
              </span>
              <button
                className="btn light"
                disabled={busy}
                onClick={() => action({ action: "revoke", link: l.id })}
              >
                Revoke access
              </button>
            </p>
          ))}
        </section>
      )}
      <section className="card" style={{ marginTop: 20 }}>
        <h2>Discuss a section</h2>
        <select
          aria-label="Comment section"
          value={section}
          onChange={(e) => setSection(Number(e.target.value))}
        >
          {job.pages.map((p, i) => (
            <option key={i} value={i}>
              {i + 1}. {p.topic}
            </option>
          ))}
        </select>
        <textarea
          aria-label="Your comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Ask a question or add a useful observation..."
        />
        <button
          className="btn dark"
          disabled={busy || !comment.trim()}
          onClick={() => action({ action: "comment", text: comment, section })}
        >
          Post comment
        </button>
        {data?.comments.map((c: any) => (
          <article className="discussion-comment" key={c.id}>
            <b>{c.name}</b>
            <span className="small">
              {" "}
              · Section {c.section + 1} · {new Date(c.at).toLocaleDateString()}
            </span>
            <p>{c.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
