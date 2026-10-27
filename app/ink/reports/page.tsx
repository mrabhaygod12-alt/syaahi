"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, FolderOpen, Plus, Search } from "lucide-react";
import { requestJson } from "../client";
import type { InkSummary } from "../types";
export default function InkReportsPage() {
  const [reports, setReports] = useState<InkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  useEffect(() => {
    let active = true;
    requestJson<{ reports: InkSummary[] }>("/api/ink")
      .then(({ data }) => {
        if (active) setReports(data.reports);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const visible = reports
    .filter((r) =>
      r.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "matched"
        ? b.matched - a.matched
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  return (
    <main className="ink-page ink-page--wide">
      <div className="ink-lead ink-composer-lead" data-ink-reveal>
        <div>
          <p className="ink-kicker">MY REPORTS</p>
          <h1>
            Your work.
            <br />
            <span>A little clearer.</span>
          </h1>
          <p>Every saved check, in one place.</p>
        </div>
        <Link className="ink-btn" href="/ink">
          <Plus size={16} /> New check
        </Link>
      </div>
      <div className="ink-library-toolbar">
        <label className="ink-search-field">
          <Search size={17} />
          <input
            aria-label="Search reports"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a document…"
          />
        </label>
        <div
          className="ink-sort-buttons"
          role="group"
          aria-label="Sort reports"
        >
          <button
            aria-pressed={sort === "recent"}
            onClick={() => setSort("recent")}
          >
            Newest
          </button>
          <button
            aria-pressed={sort === "matched"}
            onClick={() => setSort("matched")}
          >
            Most matched
          </button>
        </div>
      </div>
      {error && (
        <div className="ink-banner" data-tone="bad" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="ink-empty" role="status">
          Loading your reports…
        </div>
      ) : !visible.length ? (
        <div className="ink-empty">
          <FolderOpen size={32} />
          <strong>{query ? "No documents found" : "A fresh page."}</strong>
          {query
            ? "Try another title."
            : "Your first document report belongs here."}
          <div style={{ marginTop: 24 }}>
            <Link className="ink-btn" href="/ink">
              Check a document <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="ink-recent-grid">
          {visible.map((r) => (
            <Link
              className="ink-recent-card"
              href={`/ink/report/${r.id}`}
              key={r.id}
            >
              <span className="ink-file-symbol">
                <FileText size={22} />
              </span>
              <h3>{r.title}</h3>
              <span className="ink-count">
                {r.words.toLocaleString()} words ·{" "}
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <div>
                <span
                  className="ink-tag"
                  data-tone={r.matched > 15 ? "warn" : "info"}
                >
                  {r.sources ? `${r.matched}% matched` : "No matching sources"}
                </span>
                <ArrowRight size={17} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
