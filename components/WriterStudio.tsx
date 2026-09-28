"use client";

import { useEffect, useState } from "react";

interface Story {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  status: "draft" | "submitted" | "changes_requested" | "published";
  updatedAt: string;
  reviewNote?: string | null;
}

export default function WriterStudio() {
  const [stories, setStories] = useState<Story[]>([]);
  const [active, setActive] = useState<Story | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/stories")
      .then(async (response) => {
        if (response.status === 401) throw new Error("Sign in to create a story.");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load drafts.");
        setStories(data.stories || []);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load drafts."));
  }, []);

  function choose(story: Story | null) {
    setActive(story);
    setTitle(story?.title || "");
    setSummary(story?.summary || "");
    setBody(story?.body || "");
    setTags(story?.tags.join(", ") || "");
    setMessage("");
  }

  async function save(action: "save" | "submit") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: active?.id,
          title,
          summary,
          body,
          tags: tags.split(","),
          action,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save this draft.");
      const story = data.story as Story;
      setStories((old) => [story, ...old.filter((item) => item.id !== story.id)]);
      choose(story);
      setMessage(action === "submit" ? "Submitted for editorial review." : "Draft saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this draft.");
    } finally {
      setBusy(false);
    }
  }

  const locked = active?.status === "submitted" || active?.status === "published";
  return (
    <div className="steps-grid" style={{ alignItems: "start" }}>
      <aside className="interactive-panel">
        <div className="section-heading"><div><span className="eyebrow">WRITER STUDIO</span><h2>Your drafts</h2></div></div>
        <button className="btn dark" onClick={() => choose(null)}>New story</button>
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {stories.map((story) => (
            <button key={story.id} className="btn light" style={{ textAlign: "left" }} onClick={() => choose(story)}>
              <b>{story.title}</b><br /><small>{story.status === "submitted" ? "In editorial review" : story.status === "changes_requested" ? "Changes requested" : story.status === "published" ? "Published" : "Draft"} · {new Date(story.updatedAt).toLocaleDateString()}</small>
            </button>
          ))}
        </div>
        <p className="small" style={{ marginTop: 16 }}>Stories stay private until a Syaahi editor reviews and publishes them. This prevents spam and protects readers.</p>
      </aside>
      <section className="interactive-panel">
        <span className="eyebrow">{locked ? "SUBMITTED" : "WRITE"}</span>
        <label>Title<input disabled={locked || busy} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="A clear promise to the reader" /></label>
        <label>Short summary<input disabled={locked || busy} value={summary} maxLength={320} onChange={(e) => setSummary(e.target.value)} placeholder="What will a student learn?" /></label>
        <label>Tags (up to five, comma separated)<input disabled={locked || busy} value={tags} maxLength={180} onChange={(e) => setTags(e.target.value)} placeholder="study skills, chemistry" /></label>
        <label>Story (Markdown supported)<textarea disabled={locked || busy} rows={18} value={body} maxLength={50000} onChange={(e) => setBody(e.target.value)} placeholder="# Your idea\n\nWrite a useful, original guide…" /></label>
        {message && <p className={message.includes("saved") || message.includes("Submitted") ? "small" : "inline-error"} role="status">{message}</p>}
        {active?.reviewNote && <p className="card"><b>Editorial note</b><br />{active.reviewNote}</p>}
        {!locked && <div className="hero-actions"><button className="btn light" disabled={busy} onClick={() => void save("save")}>{busy ? "Saving…" : "Save draft"}</button><button className="btn dark" disabled={busy} onClick={() => void save("submit")}>Submit for review</button></div>}
        {locked && <p className="small">This story is locked while editorial review is pending. An editor can request changes before anything becomes public.</p>}
      </section>
    </div>
  );
}
