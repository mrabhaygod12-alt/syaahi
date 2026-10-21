"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../client";
import type { InkSummary } from "../types";
export default function InkReportsPage() {
  const [summaries, setSummaries] = useState<InkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    requestJson<{ reports: InkSummary[] }>("/api/ink").then(({data}) => { if (active) setSummaries(data.reports); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <main className="ink-page">
      <div className="ink-lead">
        <p className="ink-kicker">History</p>
        <h1>Every check you have run.</h1>
        <p>
          Reports are a record of what was found at the moment you ran them.
          Re-checking the same text after you revise it creates a new report, so
          you can see whether the changes worked.
        </p>
      </div>

      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading your reports…</p> : summaries.length === 0 ? (
        <div className="ink-empty">
          <strong>No checks yet</strong>
          Run your first integrity check and it will appear here.
          <div style={{ marginTop: 18 }}>
            <Link
              href="/ink"
              className="ink-btn"
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              Check a draft
            </Link>
          </div>
        </div>
      ) : (
        <div className="ink-table-scroll"><table className="ink-table">
          <thead>
            <tr>
              <th>Draft</th>
              <th className="num">Words</th>
              <th className="num">Matched</th>
              <th className="num">Cited</th>
              <th className="num">Style</th>
              <th>Checked</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((report) => (
              <tr key={report.id}>
                <td>
                  <Link
                    href={`/ink/report/${report.id}`}
                    style={{
                      fontFamily: "var(--ink-serif)",
                      fontSize: 15,
                      textDecoration: "none",
                      color: "var(--ink)",
                    }}
                  >
                    {report.title}
                  </Link>
                </td>
                <td className="num">{report.words.toLocaleString()}</td>
                <td className="num">{report.matched}%</td>
                <td className="num">{report.citations}%</td>
                <td className="num">
                  <span
                    className="ink-tag"
                    data-tone={
                      report.band === "clear"
                        ? "good"
                        : report.band === "watch"
                          ? "warn"
                          : "muted"
                    }
                    style={
                      report.band === "elevated"
                        ? { color: "var(--ink-red)" }
                        : undefined
                    }
                  >
                    {report.footprint}
                  </span>
                </td>
                <td
                  style={{
                    fontSize: 12,
                    color: "var(--ink-3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(report.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </main>
  );
}
