"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestJson } from "../../client";
import { wordOffsets } from "@/lib/ink/text";
import type { InkReport } from "../../types";

type Kind = "plag" | "style" | "cite";

interface Finding {
  key: string;
  kind: Kind;
  start: number;
  end: number;
  text: string;
  reason: string;
  source?: { title: string; url?: string; text: string };
  n: number;
}

const KIND_LABEL: Record<Kind, string> = {
  plag: "Overlap",
  style: "Style",
  cite: "Citation",
};

export default function InkReportView({ report }: { report: InkReport }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"proof" | "sources" | "style" | "citations">(
    "proof",
  );
  const [active, setActive] = useState<string | null>(null);

  const findings = useMemo<Finding[]>(() => {
    const text = report.text;
    const offsets = wordOffsets(text);
    const list: Finding[] = [];

    // Copied passages: convert word indices to character spans.
    for (const match of report.match.sources) {
      for (const span of match.spans) {
        const start = offsets[span.start];
        if (start === undefined) continue;
        const lastIndex = Math.min(span.end - 1, offsets.length - 1);
        const end =
          offsets[lastIndex] !== undefined
            ? offsets[lastIndex] + (text.slice(offsets[lastIndex]).match(/^[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d'\-]*/u)?.[0].length || 0)
            : text.length;
        list.push({
          key: `plag-${match.source.id}-${span.start}`,
          kind: "plag",
          start,
          end: Math.min(end, text.length),
          text: text.slice(start, Math.min(end, text.length)),
          reason: `${span.words} words in the same order as this source.`,
          source: {
            title: match.source.title,
            url: match.source.url,
            text: span.sourceText,
          },
          n: 0,
        });
      }
    }

    for (const span of report.style.spans) {
      list.push({
        key: `style-${span.start}`,
        kind: "style",
        start: span.start,
        end: span.end,
        text: span.text,
        reason: span.reason,
        n: 0,
      });
    }

    for (const span of report.citations.uncited) {
      list.push({
        key: `cite-${span.start}`,
        kind: "cite",
        start: span.start,
        end: span.end,
        text: span.text,
        reason: span.reason,
        n: 0,
      });
    }

    list.sort((a, b) => a.start - b.start || b.end - a.end);

    // Drop overlaps so a style mark never sits inside a copied-passage mark.
    const kept: Finding[] = [];
    for (const item of list) {
      const clash = kept.find(
        (k) => item.start < k.end && item.end > k.start && k.start <= item.start,
      );
      if (clash) {
        // Copied evidence outranks style commentary on the same words.
        if (item.kind === "plag" && clash.kind !== "plag") {
          kept.splice(kept.indexOf(clash), 1);
          kept.push(item);
        }
        continue;
      }
      kept.push(item);
    }
    kept.sort((a, b) => a.start - b.start);
    kept.forEach((item, i) => {
      item.n = i + 1;
    });
    return kept;
  }, [report]);

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { plag: 0, style: 0, cite: 0 };
    for (const f of findings) c[f.kind] += 1;
    return c;
  }, [findings]);

  /** Render the manuscript with inline marks, splitting text on finding bounds. */
  const body = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const f of findings) {
      if (f.start > cursor)
        nodes.push(report.text.slice(cursor, f.start));
      nodes.push(
        <mark
          key={f.key}
          id={`mark-${f.key}`}
          data-kind={f.kind}
          data-n={f.n}
          data-active={active === f.key}
          onClick={() => setActive(f.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActive(f.key);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`${KIND_LABEL[f.kind]} finding ${f.n}: ${f.reason}`}
        >
          {report.text.slice(f.start, f.end)}
        </mark>,
      );
      cursor = f.end;
    }
    if (cursor < report.text.length) nodes.push(report.text.slice(cursor));
    return nodes;
  }, [findings, report.text, active]);

  return (
    <main className="ink-page ink-page--wide">
      <div className="ink-banner">Compared {report.comparedSources || 0} sources. {report.search.message} This is source-overlap evidence, not an originality certificate or AI detector.</div>
      <div style={{display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24}}>
        <button className="ink-btn ink-btn--ghost" onClick={() => window.print()}>Print / save PDF</button>
        <button className="ink-btn ink-btn--ghost" onClick={() => {
          const blob = new Blob([JSON.stringify(report, null, 2)], {type: "application/json"});
          const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "ai-ink-report.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download report</button>
        <button className="ink-btn ink-btn--ghost" disabled={deleting} onClick={async () => {
          if (!confirmDelete) { setConfirmDelete(true); return; }
          setDeleting(true);
          try { await requestJson("/api/ink", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "delete", id: report.id})}); router.push("/ink/reports"); }
          catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); setDeleting(false); }
        }}>{deleting ? "Deleting…" : confirmDelete ? "Confirm permanent deletion" : "Delete private report"}</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="ink-report-head">
        <div>
          <Link
            href="/ink"
            className="ink-note"
            style={{ textDecoration: "none", fontSize: 12 }}
          >
            ← New check
          </Link>
          <h1>{report.title}</h1>
        </div>
        <div className="ink-report-meta">
          <div>
            {report.words.toLocaleString()} words · {report.style.sentences}{" "}
            sentences
          </div>
          <div>
            {new Date(report.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>
      </div>

      <dl className="ink-scores">
        <div
          className="ink-score"
          data-tone={
            report.match.coverage > 0.15
              ? "bad"
              : report.match.coverage > 0.05
                ? "warn"
                : "good"
          }
        >
          <dt>Matched text</dt>
          <dd className="ink-figure">
            {Math.round(report.match.coverage * 100)}
            <small>%</small>
          </dd>
          <p>
            {report.match.sourceCount === 0
              ? report.comparedSources ? "No matching runs in the compared sources." : "No reference sources compared. Add sources to check overlap."
              : `${report.match.matchedWords} words across ${report.match.sourceCount} source${report.match.sourceCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div
          className="ink-score"
          data-tone={
            report.citations.score >= 80
              ? "good"
              : report.citations.score >= 50
                ? "warn"
                : "bad"
          }
        >
          <dt>Claims cited</dt>
          <dd className="ink-figure">
            {report.citations.score}
            <small>%</small>
          </dd>
          <p>
            {report.citations.cited} of {report.citations.totalClaims} checkable
            claims name a source.
          </p>
        </div>
        <div
          className="ink-score"
          data-tone={
            report.style.band === "clear"
              ? "good"
              : report.style.band === "watch"
                ? "warn"
                : "bad"
          }
        >
          <dt>Style patterns</dt>
          <dd className="ink-figure">
            {report.style.footprint}
            <small>/100</small>
          </dd>
          <p>
            {report.style.band === "clear"
              ? "Few of these style patterns were flagged."
              : report.style.band === "watch"
                ? "Some passages read as generic."
                : "Several passages contain the measured style patterns."}
          </p>
        </div>
        <div className="ink-score">
          <dt>Findings</dt>
          <dd className="ink-figure">{findings.length}</dd>
          <p>
            {counts.plag} overlap · {counts.style} style · {counts.cite} citation
          </p>
        </div>
      </dl>

      <div className="ink-tabs" role="tablist" aria-label="Report sections">
        {(
          [
            ["proof", "Proof sheet", findings.length],
            ["sources", "Sources", report.match.sourceCount],
            ["style", "Style", report.style.signals.length],
            ["citations", "Citations", report.citations.uncited.length],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            className="ink-tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
            <em>{n}</em>
          </button>
        ))}
      </div>

      {tab === "proof" && (
        <>
          {report.search.status === "skipped" && (
            <div className="ink-banner" data-tone="warn">
              {report.search.message}
            </div>
          )}
          {report.search.status === "unavailable" && (
            <div className="ink-banner" data-tone="warn">
              {report.search.message}
            </div>
          )}
          <div className="ink-proof">
            <div className="ink-manuscript">
              <div className="ink-manuscript-body">{body}</div>
            </div>
            <div className="ink-margin" aria-label="Findings">
              {findings.length === 0 ? (
                <div className="ink-margin-empty">
                  <strong
                    style={{
                      display: "block",
                      fontFamily: "var(--ink-serif)",
                      fontSize: 17,
                      color: "var(--ink)",
                      marginBottom: 6,
                    }}
                  >
                    Nothing flagged
                  </strong>
                  No copied runs, generic phrasing or uncited claims were found
                  in this draft.
                </div>
              ) : (
                findings.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className="ink-card"
                    data-kind={f.kind}
                    data-active={active === f.key}
                    onClick={() => {
                      setActive(f.key);
                      document
                        .getElementById(`mark-${f.key}`)
                        ?.scrollIntoView({ block: "center" });
                    }}
                    aria-label={`Finding ${f.n}: ${f.reason}`}
                  >
                    <span className="ink-card-top">
                      <span className="ink-card-n">
                        {String(f.n).padStart(2, "0")}
                      </span>
                      <span className="ink-card-kind">
                        {KIND_LABEL[f.kind]}
                      </span>
                    </span>
                    <p className="ink-card-quote">{f.text}</p>
                    <p className="ink-card-why">{f.reason}</p>
                    {f.source && (
                      <span className="ink-card-src">
                        {f.source.url ? (
                          <a
                            href={f.source.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {f.source.title}
                          </a>
                        ) : (
                          f.source.title
                        )}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {tab === "sources" && (
        <section className="ink-panel">
          <h2 className="ink-h2">Where your text also appears</h2>
          <p className="ink-note" style={{ marginBottom: 20 }}>
            {report.search.message}
          </p>
          {report.match.sources.length === 0 ? (
            <div className="ink-empty">
              <strong>No matching sources</strong>
              No run of twelve or more words in this draft appears in any source
              that was checked.
            </div>
          ) : (
            <table className="ink-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Matched passage</th>
                  <th className="num">Words</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {report.match.sources.map((m) => (
                  <tr key={m.source.id}>
                    <td style={{ maxWidth: 220 }}>
                      {m.source.url ? (
                        <a
                          href={m.source.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                        >
                          {m.source.title}
                        </a>
                      ) : (
                        m.source.title
                      )}
                      <div style={{ marginTop: 4 }}>
                        <span
                          className="ink-tag"
                          data-tone={
                            m.source.kind === "upload" ? "info" : "muted"
                          }
                        >
                          {m.source.kind === "upload" ? "Your source" : "Web"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <em style={{ fontFamily: "var(--ink-serif)" }}>
                        “{m.spans[0]?.sourceText.slice(0, 220)}
                        {m.spans[0] && m.spans[0].sourceText.length > 220
                          ? "…"
                          : ""}
                        ”
                      </em>
                      {m.spans.length > 1 && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--ink-3)",
                            marginTop: 4,
                          }}
                        >
                          +{m.spans.length - 1} more passage
                          {m.spans.length - 1 === 1 ? "" : "s"}
                        </div>
                      )}
                    </td>
                    <td className="num">{m.matchedWords}</td>
                    <td className="num">
                      {Math.round(m.coverage * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "style" && (
        <div className="ink-grid-2">
          <section className="ink-panel">
            <h2 className="ink-h2">What the measurements say</h2>
            <p className="ink-note" style={{ marginBottom: 20 }}>
              These are properties of the writing, not a verdict on who wrote
              it. Each one names something you can change.
            </p>
            {report.style.signals.map((signal) => (
              <div key={signal.id} className="ink-signal">
                <div className="ink-signal-top">
                  <span className="ink-signal-name">{signal.label}</span>
                  <span className="ink-signal-val ink-figure">
                    {signal.value}
                  </span>
                </div>
                <div className="ink-meter">
                  <span
                    data-tone={
                      signal.value >= 62
                        ? "bad"
                        : signal.value >= 40
                          ? "warn"
                          : "good"
                    }
                    style={{ width: `${signal.value}%` }}
                  />
                </div>
                <p>{signal.reading}</p>
                <p>{signal.why}</p>
              </div>
            ))}
          </section>

          <section className="ink-panel">
            <h2 className="ink-h2">Measured detail</h2>
            <table className="ink-table" style={{ marginBottom: 24 }}>
              <tbody>
                <tr>
                  <td>Average sentence</td>
                  <td className="num">
                    {report.style.sentenceStats.mean} words
                  </td>
                </tr>
                <tr>
                  <td>Longest / shortest</td>
                  <td className="num">
                    {report.style.sentenceStats.max} /{" "}
                    {report.style.sentenceStats.min}
                  </td>
                </tr>
                <tr>
                  <td>Length spread</td>
                  <td className="num">{report.style.sentenceStats.stdDev}</td>
                </tr>
                <tr>
                  <td>Short sentences (&lt;8 words)</td>
                  <td className="num">
                    {Math.round(report.style.sentenceStats.shortRatio * 100)}%
                  </td>
                </tr>
                <tr>
                  <td>Long sentences (&gt;32 words)</td>
                  <td className="num">
                    {Math.round(report.style.sentenceStats.longRatio * 100)}%
                  </td>
                </tr>
                <tr>
                  <td>Words used once</td>
                  <td className="num">
                    {Math.round(report.style.vocabulary.uniqueRatio * 100)}%
                  </td>
                </tr>
                <tr>
                  <td>Average word length</td>
                  <td className="num">
                    {report.style.vocabulary.averageWordLength}
                  </td>
                </tr>
                <tr>
                  <td>Paragraphs</td>
                  <td className="num">{report.style.paragraphs}</td>
                </tr>
              </tbody>
            </table>
            <Link
              href={`/ink/rewrite?report=${report.id}`}
              className="ink-btn"
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              Open the rewrite desk
            </Link>
          </section>
        </div>
      )}

      {tab === "citations" && (
        <section className="ink-panel">
          <h2 className="ink-h2">Claims that need a source</h2>
          <p className="ink-note" style={{ marginBottom: 20 }}>
            These sentences report a finding, a figure or a date without saying
            where it came from. Not every one needs a citation — but each is a
            place an examiner will stop and ask.
          </p>
          {report.citations.uncited.length === 0 ? (
            <div className="ink-empty">
              <strong>Nothing outstanding</strong>
              Every claim this check recognised already names a source.
            </div>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {report.citations.uncited.map((item, i) => (
                <li
                  key={item.start}
                  style={{
                    borderTop: i ? "1px solid var(--ink-rule-soft)" : 0,
                    padding: "14px 0",
                  }}
                >
                  <div style={{ display: "flex", gap: 14 }}>
                    <span
                      className="ink-card-n ink-figure"
                      style={{ paddingTop: 3, minWidth: 20 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p
                        style={{
                          fontFamily: "var(--ink-serif)",
                          fontSize: 15,
                          lineHeight: 1.6,
                          margin: "0 0 6px",
                        }}
                      >
                        {item.text}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "var(--ink-2)",
                        }}
                      >
                        {item.reason}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div style={{ marginTop: 32 }}>
        <div className="ink-banner">
          AI Ink compares patterns and reports what it measured. It is not a
          substitute for your institution&apos;s own submission check, and a low
          score here is not a guarantee.
        </div>
      </div>
    </main>
  );
}
