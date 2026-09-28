"use client";
import { useEffect, useState } from "react";
interface Story { id: string; title: string; summary: string; authorName: string; body: string; tags: string[]; submittedAt: string; }
export default function PublicationReview() {
  const [stories, setStories] = useState<Story[]>([]), [note, setNote] = useState<Record<string, string>>({}), [message, setMessage] = useState("");
  const load = () => fetch("/api/admin/stories").then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load review queue."); setStories(d.stories || []); }).catch(e => setMessage(e instanceof Error ? e.message : "Could not load review queue."));
  useEffect(() => {
    void load();
  }, []);
  async function decide(id: string, action: "publish" | "changes") { setMessage(""); const r = await fetch("/api/admin/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, note: note[id] || "" }) }); const d = await r.json(); if (!r.ok) return setMessage(d.error || "Review failed."); setStories(old => old.filter(s => s.id !== id)); }
  return <main className="wrap feature-section"><h1>Publication review</h1>{message && <p className="inline-error">{message}</p>}{stories.map(s => <article className="interactive-panel" key={s.id}><p className="eyebrow">SUBMITTED · {s.authorName}</p><h2>{s.title}</h2><p>{s.summary}</p><pre style={{ whiteSpace: "pre-wrap", font: "inherit", maxHeight: 280, overflow: "auto" }}>{s.body}</pre><input value={note[s.id] || ""} maxLength={1000} placeholder="Optional editorial note" onChange={e => setNote(n => ({ ...n, [s.id]: e.target.value }))}/><div className="hero-actions"><button className="btn dark" onClick={() => void decide(s.id, "publish")}>Publish reviewed guide</button><button className="btn light" onClick={() => void decide(s.id, "changes")}>Request changes</button></div></article>)}{!stories.length && <p className="card">No submitted guides in the review queue.</p>}</main>;
}
