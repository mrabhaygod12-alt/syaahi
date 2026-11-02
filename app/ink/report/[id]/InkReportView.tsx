"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Printer,
  SlidersHorizontal,
  ArrowLeft,
  ExternalLink,
  Trash2,
  ShieldCheck,
  FileSearch,
} from "lucide-react";
import type { InkReport } from "../../types";
import { InkDialog } from "../../InkUI";
import { requestJson } from "../../client";
import {
  filterMatches,
  DEFAULT_MATCH_FILTERS,
  type MatchFilters,
} from "@/lib/ink/filters";
import {
  reportFindings,
  matchGroups,
  GROUP_LABELS,
  SOURCE_COLORS,
} from "@/lib/ink/report-model";

type Tab = "proof" | "sources" | "citations" | "coverage";
const TABS: Array<[Tab, string]> = [
  ["proof", "Document"],
  ["sources", "Sources"],
  ["citations", "References"],
  ["coverage", "Coverage & integrity"],
];
const href = (url?: string) =>
  url && /^https?:\/\//i.test(url) ? url : undefined;
const stamp = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function InkReportView({ report }: { report: InkReport }) {
  const router = useRouter();
  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_MATCH_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false),
    [tab, setTab] = useState<Tab>("proof");
  const [selected, setSelected] = useState<string | null>(null),
    [evidenceOpen, setEvidenceOpen] = useState(false);
  const [error, setError] = useState(""),
    [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false),
    [deleting, setDeleting] = useState(false);
  const filtered = useMemo(
    () => filterMatches(report.text, report.match, filters),
    [report, filters],
  );
  const findings = useMemo(
    () => reportFindings(report.text, filtered.match),
    [report.text, filtered],
  );
  const groups = useMemo(
    () => matchGroups(report.text, filtered.match),
    [report.text, filtered],
  );
  const active = findings.find((f) => f.id === selected) || findings[0];
  const activeSource = filtered.match.sources.find(
    (s) => s.source.id === active?.sourceId,
  );
  const evidence = report.evidence || [];
  const body = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const f of [...findings].sort(
      (a, b) => a.start - b.start || b.end - a.end,
    )) {
      if (f.start < cursor) continue;
      nodes.push(report.text.slice(cursor, f.start));
      nodes.push(
        <mark
          key={f.id}
          id={`finding-${f.id}`}
          data-kind="plag"
          data-active={active?.id === f.id}
          style={{ borderBottomColor: f.color }}
          role="button"
          tabIndex={0}
          aria-label={`Source ${f.sourceNumber}: ${f.words} matching words`}
          onClick={() => setSelected(f.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelected(f.id);
            }
          }}
        >
          <sup style={{ background: f.color }}>{f.sourceNumber}</sup>
          {report.text.slice(f.start, f.end)}
        </mark>,
      );
      cursor = f.end;
    }
    nodes.push(report.text.slice(cursor));
    return nodes;
  }, [report.text, findings, active?.id]);
  async function downloadPdf() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/ink/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: report.id, filters }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw Error(
          data.error || "The PDF could not be generated. Please retry.",
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ai-ink-integrity-report.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed.");
    } finally {
      setExporting(false);
    }
  }
  function downloadJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...report,
            owner: undefined,
            view: {
              filters,
              excludedWords: filtered.excludedWords,
              match: filtered.match,
            },
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "ai-ink-report.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function remove() {
    setDeleting(true);
    try {
      await requestJson("/api/ink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: report.id }),
      });
      router.push("/ink/reports");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete report.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }
  const score = report.comparedSources
    ? `${Math.round(filtered.match.coverage * 100)}%`
    : "—";
  return (
    <main className="ink-page ink-page--wide ink-review">
      <div className="ink-review-actions">
        <Link className="ink-btn ink-btn--ghost" href="/ink/reports">
          <ArrowLeft size={15} /> My reports
        </Link>
        <div>
          <button
            className="ink-btn ink-btn--ghost"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={15} /> Similarity filters
          </button>
          <button
            className="ink-btn ink-btn--ghost"
            onClick={() => window.print()}
            aria-label="Print report"
          >
            <Printer size={15} />
          </button>
          <button
            className="ink-btn"
            onClick={downloadPdf}
            disabled={exporting}
          >
            <Download size={16} />
            {exporting ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="ink-banner" data-tone="bad">
          {error}
        </p>
      )}
      <header className="ink-review-cover">
        <div>
          <p className="ink-kicker">DOCUMENT INTEGRITY REPORT</p>
          <h1>{report.title}</h1>
          <p>Checked {stamp(report.createdAt)}</p>
          <code>{report.id}</code>
        </div>
        <div className="ink-report-seal">
          <ShieldCheck size={30} />
          <span>Private snapshot</span>
          <small>{report.methodVersion || "Legacy method"}</small>
        </div>
      </header>
      <section className="ink-review-overview" aria-label="Report overview">
        <div className="ink-score-card">
          <span>Text similarity</span>
          <strong>{score}</strong>
          <p>
            {report.comparedSources
              ? `${filtered.match.matchedWords.toLocaleString()} of ${filtered.eligibleWords.toLocaleString()} eligible words`
              : "Not measured: no comparison text was available."}
          </p>
          <small>
            Raw:{" "}
            {report.comparedSources
              ? `${Math.round(report.match.coverage * 100)}%`
              : "unmeasured"}{" "}
            · {filtered.excludedWords} words excluded
          </small>
        </div>
        <div className="ink-review-facts">
          <div>
            <strong>{report.words.toLocaleString()}</strong>
            <span>Document words</span>
          </div>
          <div>
            <strong>{report.comparedSources}</strong>
            <span>Sources compared</span>
          </div>
          <div>
            <strong>{filtered.match.sourceCount}</strong>
            <span>Matching sources</span>
          </div>
          <div>
            <strong>{report.integrity?.flags.length ?? "—"}</strong>
            <span>Text integrity flags</span>
          </div>
          <p>
            Similarity is evidence for review, not a plagiarism verdict. No
            AI-authorship score was calculated.
          </p>
        </div>
      </section>
      {(report.match.limited || report.phrasing?.limited) && (
        <p className="ink-banner" data-tone="warn">
          A comparison or evidence budget was reached. This report is a partial
          review.
        </p>
      )}
      <section className="ink-match-groups" aria-label="Match groups">
        {groups.map((g) => (
          <div key={g.id}>
            <strong>{g.count}</strong>
            <span>{g.label}</span>
          </div>
        ))}
      </section>
      <p className="ink-small-print">
        Groups count matched passages; the same passage may appear under several
        sources. A nearby marker does not verify that it credits the matched
        source.
      </p>
      {report.index && (
        <p className="ink-note">
          Private index: {report.index.indexed} indexed,{" "}
          {report.index.candidates} candidates, {report.index.compared} compared
          {report.index.limited ? " · limited" : ""}.
        </p>
      )}
      <div
        className="ink-review-tabs"
        role="tablist"
        aria-label="Report sections"
      >
        {TABS.map(([key, label], i) => (
          <button
            key={key}
            id={`tab-${key}`}
            role="tab"
            aria-controls={`panel-${key}`}
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(e) => {
              let next = i;
              if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
              else if (e.key === "ArrowLeft")
                next = (i + TABS.length - 1) % TABS.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = TABS.length - 1;
              else return;
              e.preventDefault();
              setTab(TABS[next][0]);
              document.getElementById(`tab-${TABS[next][0]}`)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="ink-review-panel"
      >
        {tab === "proof" && (
          <div className="ink-evidence-layout">
            <article className="ink-review-paper">
              <div className="ink-paper-heading">
                <FileSearch size={17} />
                <span>Extracted manuscript</span>
                <small>{findings.length} matching passages</small>
              </div>
              <p className="ink-small-print">
                Reflowed text. Highlight positions refer to extracted text, not
                original PDF pages.
              </p>
              <div className="ink-review-manuscript">{body}</div>
            </article>
            <aside className="ink-match-inspector">
              <h2>Source evidence</h2>
              {active && activeSource ? (
                <>
                  <div className="ink-source-title">
                    <b style={{ background: active.color }}>
                      {active.sourceNumber}
                    </b>
                    <h3>{activeSource.source.title}</h3>
                  </div>
                  <span className="ink-tag">{active.words} matching words</span>
                  <p>{GROUP_LABELS[active.group]}</p>
                  <blockquote>{active.sourceText}</blockquote>
                  <button
                    className="ink-btn ink-btn--ghost"
                    onClick={() => setEvidenceOpen(true)}
                  >
                    Compare source
                  </button>
                  {href(activeSource.source.url) && (
                    <a
                      className="ink-source-link"
                      href={href(activeSource.source.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open source <ExternalLink size={13} />
                    </a>
                  )}
                  <div className="ink-passage-list">
                    {findings.map((f) => (
                      <button
                        key={f.id}
                        aria-pressed={f.id === active.id}
                        onClick={() => {
                          setSelected(f.id);
                          document
                            .getElementById(`finding-${f.id}`)
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                        }}
                      >
                        <b style={{ color: f.color }}>{f.sourceNumber}</b>
                        <span>{f.text.slice(0, 95)}…</span>
                        <small>{f.words} words</small>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p>
                  No exact matching passages in the sources compared. This does
                  not establish originality.
                </p>
              )}
            </aside>
          </div>
        )}
        {tab === "sources" && (
          <>
            <h2>Matching sources</h2>
            <p className="ink-note">
              Numbered sources correspond to manuscript highlights. Source
              percentages can overlap; the overall score counts each matching
              word once.
            </p>
            {filtered.match.sources.map((s, i) => (
              <article className="ink-source-entry" key={s.source.id}>
                <b
                  className="ink-number"
                  style={{
                    background: SOURCE_COLORS[i % SOURCE_COLORS.length],
                  }}
                >
                  {i + 1}
                </b>
                <div>
                  <h3>{s.source.title}</h3>
                  <p>
                    {s.source.provider || s.source.kind} ·{" "}
                    {s.source.scope || "Supplied comparison text"}
                  </p>
                  {href(s.source.url) && (
                    <a
                      href={href(s.source.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.source.url}
                    </a>
                  )}
                  <small>
                    {s.matchedWords} matched words · {s.spans.length} passages
                  </small>
                  <button
                    className="ink-btn ink-btn--ghost"
                    onClick={() => {
                      setSelected(
                        findings.find((f) => f.sourceId === s.source.id)?.id ||
                          null,
                      );
                      setTab("proof");
                    }}
                  >
                    Inspect passages
                  </button>
                </div>
                <strong>{Math.round(s.coverage * 100)}%</strong>
              </article>
            ))}
            {!filtered.match.sources.length && (
              <p>No sources with exact matching runs under these filters.</p>
            )}
            <h2>Shared-phrasing review</h2>
            <p className="ink-note">
              Lexical candidates with some changed wording. These are outside
              the exact-match percentage and require human review.
            </p>
            {(report.phrasing?.candidates || [])
              .filter((c) => !filters.excludedSources.includes(c.source.id))
              .map((c, i) => (
                <details className="ink-reference-entry" key={i}>
                  <summary>{c.source.title}</summary>
                  <h3>Your passage</h3>
                  <p>{c.text}</p>
                  <h3>Source excerpt</h3>
                  <p>{c.source.text}</p>
                  <p>{c.reason}</p>
                </details>
              ))}
            <h2>Comparison ledger</h2>
            <p className="ink-note">
              Includes compared sources with no matching text. Fingerprints
              identify the retrieved comparison text, not a publisher
              certification.
            </p>
            {evidence.length ? (
              evidence.map((s) => (
                <details className="ink-reference-entry" key={s.id}>
                  <summary>
                    {s.title} · {s.matchedWords} matched words
                  </summary>
                  <p>
                    {s.provider} · {s.scope} · {s.characters.toLocaleString()}{" "}
                    characters{s.truncated ? " · truncated" : ""}
                  </p>
                  {s.retrievedAt && <p>Retrieved {stamp(s.retrievedAt)}</p>}
                  <code>SHA-256 {s.sha256}</code>
                  {href(s.url) && (
                    <p>
                      <a href={href(s.url)} target="_blank" rel="noreferrer">
                        {s.url}
                      </a>
                    </p>
                  )}
                </details>
              ))
            ) : (
              <p>
                This older snapshot does not contain a complete comparison
                ledger. Its saved match excerpts remain available.
              </p>
            )}
          </>
        )}
        {tab === "citations" && (
          <>
            <h2>Reference audit</h2>
            <p className="ink-note">
              Supported numbered and author–year references only. Metadata
              verification does not prove a citation supports your claim.
            </p>
            <h3>Reference-list issues</h3>
            {report.citations.issues?.length ? (
              report.citations.issues.map((x, i) => (
                <article key={i} className="ink-reference-entry">
                  <span className="ink-tag">{x.kind.replaceAll("-", " ")}</span>
                  <p>{x.text}</p>
                </article>
              ))
            ) : (
              <p>
                No supported reference-list issues were flagged. Complex
                citation formats still need review.
              </p>
            )}
            <h3>Claims to review</h3>
            {report.citations.uncited.map((c, i) => (
              <article className="ink-reference-entry" key={i}>
                <p>{c.text}</p>
                <small>{c.reason}</small>
              </article>
            ))}
            <h3>Recognized references</h3>
            {(report.citations.references || []).map((r) => (
              <p className="ink-reference-entry" key={r.id}>
                {r.text}
              </p>
            ))}
            <h3>DOI verification</h3>
            <p>
              {report.scholarly?.message || "No DOI verification was recorded."}
            </p>
            {report.scholarly?.records.map((r) => (
              <article className="ink-reference-entry" key={r.doi}>
                <a
                  href={`https://doi.org/${encodeURIComponent(r.doi)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.doi}
                </a>
                <p>{r.title || "Metadata not available"}</p>
                <small>
                  Crossref: {r.status} · Scopus: {r.scopus}
                </small>
              </article>
            ))}
          </>
        )}
        {tab === "coverage" && (
          <>
            <h2>Coverage & integrity</h2>
            <div className="ink-coverage-grid">
              <article>
                <span className="ink-tag">{report.search.status}</span>
                <h3>Web discovery</h3>
                <p>{report.search.message}</p>
                <small>
                  {report.search.results} comparison results · provider:{" "}
                  {report.search.provider}
                </small>
              </article>
              {report.coverage?.map((c) => (
                <article key={c.provider}>
                  <span
                    className="ink-tag"
                    data-tone={c.status === "compared" ? "good" : undefined}
                  >
                    {c.status.replaceAll("-", " ")}
                  </span>
                  <h3>{c.provider}</h3>
                  <p>{c.message}</p>
                  <small>
                    {c.discovered} records discovered · {c.compared} text
                    sources compared
                  </small>
                </article>
              ))}
            </div>
            {!report.coverage && (
              <p>
                This legacy snapshot predates the coverage ledger. No additional
                services have been queried when opening it.
              </p>
            )}
            <h3>Text integrity review</h3>
            <p>
              {report.integrity?.message ||
                "Text-integrity checks were not recorded in this older report."}
            </p>
            {report.integrity?.flags.length === 0 && (
              <p>
                No flags in the supported text checks. This is not an
                originality or authorship certificate.
              </p>
            )}
            {report.integrity?.flags.map((f) => (
              <article key={f.kind} className="ink-reference-entry">
                <strong>
                  {f.kind.replaceAll("-", " ")} · {f.count}
                </strong>
                <p>{f.message}</p>
              </article>
            ))}
            <h3>Continue your research</h3>
            <p className="ink-note">
              Manual lookups open external sites. These links are not evidence
              that those collections were automatically searched or
              text-compared.
            </p>
            <div className="ink-lookup-links">
              <a
                href={`https://scholar.google.com/scholar?q=${encodeURIComponent(report.title)}`}
                target="_blank"
                rel="noreferrer"
              >
                Google Scholar ↗
              </a>
              <a
                href={`https://www.sciencedirect.com/search?qs=${encodeURIComponent(report.title)}`}
                target="_blank"
                rel="noreferrer"
              >
                ScienceDirect ↗
              </a>
              <a
                href="https://www.scopus.com/"
                target="_blank"
                rel="noreferrer"
              >
                Scopus ↗
              </a>
            </div>
          </>
        )}
      </section>
      <footer className="ink-review-footer">
        <p>
          Private report · {report.methodVersion || "Legacy snapshot"}. Re-run
          to check newly available sources.
        </p>
        <div>
          <button className="ink-btn ink-btn--ghost" onClick={downloadJson}>
            Download report
          </button>
          <button
            className="ink-icon-btn"
            aria-label="Delete report"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </footer>
      <InkDialog
        title="Similarity filters"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      >
        <p>Recalculate this view without changing the original evidence.</p>
        <label className="ink-filter-row">
          <input
            type="checkbox"
            checked={filters.bibliography}
            onChange={(e) =>
              setFilters({ ...filters, bibliography: e.target.checked })
            }
          />
          Exclude bibliography
        </label>
        <label className="ink-filter-row">
          <input
            type="checkbox"
            checked={filters.quotes}
            onChange={(e) =>
              setFilters({ ...filters, quotes: e.target.checked })
            }
          />
          Exclude paired quotations
        </label>
        <label className="ink-label">
          Minimum matching words
          <input
            className="ink-input"
            type="number"
            min={12}
            max={100}
            value={filters.minWords}
            onChange={(e) =>
              setFilters({ ...filters, minWords: Number(e.target.value) })
            }
          />
        </label>
        <p>Exclude matching sources</p>
        {report.match.sources.map((s) => (
          <label className="ink-filter-row" key={s.source.id}>
            <input
              type="checkbox"
              checked={filters.excludedSources.includes(s.source.id)}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  excludedSources: e.target.checked
                    ? [...filters.excludedSources, s.source.id]
                    : filters.excludedSources.filter((x) => x !== s.source.id),
                })
              }
            />
            {s.source.title}
          </label>
        ))}
        <div className="ink-dialog-actions">
          <button
            className="ink-btn ink-btn--ghost"
            onClick={() => setFilters(DEFAULT_MATCH_FILTERS)}
          >
            Reset filters
          </button>
          <button className="ink-btn" onClick={() => setFiltersOpen(false)}>
            Done
          </button>
        </div>
      </InkDialog>
      <InkDialog
        title="Side-by-side evidence"
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        wide
      >
        {active && (
          <div className="ink-evidence-pair">
            <section>
              <h3>Your passage</h3>
              <p>{active.text}</p>
            </section>
            <section>
              <h3>Source {active.sourceNumber}</h3>
              <p>{active.sourceText}</p>
            </section>
          </div>
        )}
      </InkDialog>
      <InkDialog
        title="Delete this report?"
        open={confirmDelete}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        dismissible={!deleting}
      >
        <p>
          This permanently removes this private report. Your indexed sources
          remain available.
        </p>
        <div className="ink-dialog-actions">
          <button
            className="ink-btn ink-btn--ghost"
            disabled={deleting}
            onClick={() => setConfirmDelete(false)}
          >
            Keep report
          </button>
          <button className="ink-btn" disabled={deleting} onClick={remove}>
            {deleting ? "Deleting…" : "Delete report"}
          </button>
        </div>
      </InkDialog>
    </main>
  );
}
