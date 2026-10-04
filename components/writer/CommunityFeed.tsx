"use client";
import { useEffect, useState } from "react";
import type { PublicGuide } from "@/lib/writing/public";
import { StoryRow } from "../WriterDashboard";
export default function CommunityFeed({ stories }: { stories: PublicGuide[] }) {
  const [query, setQuery] = useState("");
  useEffect(
    () => setQuery(new URLSearchParams(location.search).get("q") || ""),
    [],
  );
  const topics = [...new Set(stories.flatMap((s) => s.tags))].slice(0, 8);
  const filtered = stories.filter((s) =>
    `${s.title} ${s.authorName} ${s.summary} ${s.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="community-editorial-feed">
      <div className="community-feed-toolbar">
        <input
          type="search"
          aria-label="Search community stories"
          placeholder="Find a story, a topic, a perspective…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="community-topics">
          <button aria-pressed={!query} onClick={() => setQuery("")}>
            All stories
          </button>
          {topics.map((t) => (
            <button
              key={t}
              aria-pressed={query === t}
              onClick={() => setQuery(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {filtered.map((s) => (
        <StoryRow key={s.slug} story={s} publicFeed />
      ))}
      {!filtered.length && (
        <div className="writer-empty">
          <h2>
            {query ? "No matching stories yet." : "A new chapter is beginning."}
          </h2>
          <p>
            {query
              ? "Try another topic or clear your search."
              : "Thoughtful, reviewed writing will appear here."}
          </p>
          <a href="/writing">Explore writing on Syaahi ↗</a>
        </div>
      )}
    </section>
  );
}
