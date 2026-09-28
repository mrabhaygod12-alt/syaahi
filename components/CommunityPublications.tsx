"use client";
import { useEffect, useState } from "react";

interface Publication {
  slug: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  authorName: string;
  creatorSlug: string;
  publishedAt: string;
}

export default function CommunityPublications() {
  const [items, setItems] = useState<Publication[]>([]);
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
  return <><div className="steps-grid">{items.map((item) => <article key={item.slug} className="interactive-panel"><p className="eyebrow">REVIEWED GUIDE</p><h2>{item.title}</h2><p>{item.summary}</p><p className="small">By <a href={`/creators/${item.creatorSlug}`}>{item.authorName}</a> · {new Date(item.publishedAt).toLocaleDateString()}</p><div className="about-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><a className="btn dark" href={`/guides/${item.slug}`}>Read guide →</a></article>)}</div>{!items.length && !error && <div className="card"><h2>Reviewed guides are coming soon.</h2><p>Creators can draft a guide in Writer Studio and submit it for editorial review.</p><a className="btn dark" href="/write">Open Writer Studio</a></div>}{error && <p className="inline-error">{error}</p>}</>;
}
