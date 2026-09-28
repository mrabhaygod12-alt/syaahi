"use client";
import { useEffect, useState } from "react";

interface Publication {
  slug: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  authorName: string;
  publishedAt: string;
}

export default function CommunityPublications() {
  const [items, setItems] = useState<Publication[]>([]);
  const [selected, setSelected] = useState<Publication | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/publications")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load publications.");
        setItems(data.stories || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load publications."));
  }, []);
  if (selected)
    return <article className="interactive-panel" style={{ maxWidth: 800 }}><button className="btn light" onClick={() => setSelected(null)}>← All publications</button><p className="eyebrow" style={{ marginTop: 18 }}>REVIEWED STUDY GUIDE</p><h1>{selected.title}</h1><p className="small">By {selected.authorName} · {new Date(selected.publishedAt).toLocaleDateString()}</p><p style={{ fontSize: 18 }}>{selected.summary}</p><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>{selected.body}</div></article>;
  return <><div className="steps-grid">{items.map((item) => <article key={item.slug} className="interactive-panel"><p className="eyebrow">REVIEWED GUIDE</p><h2>{item.title}</h2><p>{item.summary}</p><p className="small">By {item.authorName} · {new Date(item.publishedAt).toLocaleDateString()}</p><div className="about-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button className="btn dark" onClick={() => setSelected(item)}>Read guide →</button></article>)}</div>{!items.length && !error && <div className="card"><h2>Reviewed guides are coming soon.</h2><p>Creators can draft a guide in Writer Studio and submit it for editorial review.</p><a className="btn dark" href="/write">Open Writer Studio</a></div>}{error && <p className="inline-error">{error}</p>}</>;
}
