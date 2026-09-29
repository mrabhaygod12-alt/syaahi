"use client";
import { useEffect, useState } from "react";

type Engagement = { upvotes: number; bookmarks: number; tippedCredits: number; viewer: { upvoted: boolean; bookmarked: boolean; tippedCredits: number } | null };
export default function PublicationActions({ slug }: { slug: string }) {
  const [data, setData] = useState<Engagement | null>(null), [busy, setBusy] = useState(""), [message, setMessage] = useState("");
  const load = () => fetch(`/api/publications/${encodeURIComponent(slug)}/engagement`).then(async r => { const value = await r.json(); if (!r.ok) throw new Error(value.error); setData(value); }).catch(() => {});
  useEffect(() => { void load(); }, [slug]);
  async function act(action: "upvote" | "bookmark" | "tip", value?: boolean) {
    setBusy(action); setMessage("");
    try {
      const response = await fetch(`/api/publications/${encodeURIComponent(slug)}/engagement`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "tip" ? { action, credits: 1 } : { action, value }) });
      const result = await response.json();
      if (response.status === 401) { window.location.assign(`/login?next=${encodeURIComponent(`/guides/${slug}`)}`); return; }
      if (!response.ok) throw new Error(result.error || "Could not update this guide.");
      setData(result); if (action === "tip") setMessage("Sent 1 study credit to the creator.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update this guide."); }
    finally { setBusy(""); }
  }
  return <section className="publication-actions" aria-label="Guide engagement"><p className="small">{data ? `${data.upvotes} upvotes · ${data.bookmarks} bookmarks · ${data.tippedCredits} creator credits` : "Loading guide activity…"}</p><div><button className="btn light" disabled={!!busy} onClick={() => void act("upvote", !data?.viewer?.upvoted)}>{data?.viewer?.upvoted ? "Upvoted" : "Upvote"}</button><button className="btn light" disabled={!!busy} onClick={() => void act("bookmark", !data?.viewer?.bookmarked)}>{data?.viewer?.bookmarked ? "Saved" : "Bookmark"}</button><button className="btn light" disabled={!!busy} onClick={() => void act("tip")}>Tip 1 credit</button></div><p className="small">Tips transfer existing study credits to the creator. They do not charge money and cannot be reversed automatically.</p>{message && <p role="status" className="small">{message}</p>}</section>;
}
