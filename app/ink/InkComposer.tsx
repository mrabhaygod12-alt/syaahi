"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/app/ink/client";
import type { InkSummary } from "./types";

interface DocumentOption {
  id: string;
  name: string;
  pageCount: number;
  createdAt: string;
}

const CHECKLIST = [
  {
    title: "Source overlap",
    body: "Compares your text against live web results and any sources you attach, using contiguous word runs rather than shared keywords.",
  },
  {
    title: "Uncited claims",
    body: "Finds sentences that report a figure, a study or a finding without naming where it came from.",
  },
  {
    title: "Writing style",
    body: "Measures patterns in prose — even sentence rhythm, stock phrasing, inflated vocabulary — and points at each passage.",
  },
];

export default function InkComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowWeb, setAllowWeb] = useState(false);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  const [recent, setRecent] = useState<InkSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const requestId = useRef<string>("");

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const ready = text.trim().length >= 200 && text.length <= 120000 && !busy;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await requestJson<{ reports: InkSummary[] }>(
          "/api/ink",
        );
        if (!cancelled) setRecent(data.reports.slice(0, 5));
      } catch {
        /* an empty history is not an error worth showing */
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await requestJson<{ documents: DocumentOption[] }>(
          "/api/documents",
        );
        if (!cancelled) setDocuments(data.documents || []);
      } catch {
        /* attaching is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    // A stable id per attempt means a network retry cannot create two reports.
    if (!requestId.current)
      requestId.current = `ink-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const { data } = await requestJson<{ report: { id: string } }>("/api/ink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyse",
          title: title.trim(),
          text,
          allowWeb,
          sourceIds: attached,
          referenceText,
          requestId: requestId.current,
        }),
      });
      router.push(`/ink/report/${data.report.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The check could not be completed.",
      );
      setBusy(false);
      requestId.current = "";
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const body = new FormData(); body.set("file", file);
      const {data} = await requestJson<{text: string; name: string}>("/api/ink/import", {method: "POST", body}, 55000);
      setText(data.text); if (!title) setTitle(data.name);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed."); }
    finally { setBusy(false); }
  }

  function toggle(id: string) {
    setAttached((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= 10
          ? current
          : [...current, id],
    );
  }

  return (
    <main className="ink-page ink-page--wide">
      <div className="ink-lead">
        <p className="ink-kicker">Integrity check</p>
        <h1>Read your draft the way an examiner will.</h1>
        <p>
          Paste a chapter, a paper or a paragraph. AI Ink highlights source overlap,
          flags claims that need a source, and shows you exactly which sentences
          read as padded — then helps you fix them in your own words.
        </p>
      </div>

      <div className="ink-desk-grid">
        <section className="ink-compose" aria-label="Submit a draft">
          <label htmlFor="ink-title">Title</label>
          <input
            id="ink-title"
            className="ink-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chapter 3 — literature review"
            maxLength={160}
            autoComplete="off"
          />

          <label htmlFor="ink-file">Import a paper or chapter</label>
          <input id="ink-file" type="file" accept=".pdf,.txt,.md,.tex" disabled={busy} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
          <p className="ink-note">Searchable PDF up to 10 MB, or UTF-8 TXT, Markdown and LaTeX up to 500 KB. Import replaces the text below; it does not upload to a public repository.</p>
          <label htmlFor="ink-text">Your text</label>
          <textarea
            id="ink-text"
            className="ink-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your draft here. Nothing is submitted anywhere — this compares your text against sources and reports what it finds."
            spellCheck
            aria-describedby="ink-text-help"
          />
          <p id="ink-text-help" className="ink-count" style={{ marginTop: 6 }}>
            {text.length > 120000
              ? "Over the 120,000 character limit — split the document by chapter."
              : "Up to 120,000 characters. Compare one chapter or section at a time for the most useful output."}
          </p>

          <label htmlFor="ink-reference" style={{ marginTop: 24 }}>Reference text to compare (optional)</label>
          <textarea id="ink-reference" className="ink-textarea" style={{ minHeight: 130 }} maxLength={60000} value={referenceText} onChange={e => setReferenceText(e.target.value)} placeholder="Paste the original source passage here, or attach sources from your library below." />
          {documents.length > 0 && (
            <details style={{ marginTop: 18 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 12.5,
                  color: "var(--ink-2)",
                  fontWeight: 500,
                }}
              >
                Attach your own sources ({attached.length}/10)
              </summary>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {documents.map((doc) => {
                  const on = attached.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className="ink-btn ink-btn--ghost"
                      style={{
                        fontSize: 11.5,
                        padding: "5px 10px",
                        ...(on
                          ? {
                              background: "var(--ink-blue-soft)",
                              borderColor: "var(--ink-blue)",
                            }
                          : {}),
                      }}
                      aria-pressed={on}
                      onClick={() => toggle(doc.id)}
                      title={doc.name}
                    >
                      {doc.name.length > 32
                        ? `${doc.name.slice(0, 30)}…`
                        : doc.name}
                    </button>
                  );
                })}
              </div>
            </details>
          )}

          <div className="ink-compose-foot">
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <span className="ink-count">
                {words.toLocaleString()} word{words === 1 ? "" : "s"}
              </span>
              <label className="ink-toggle">
                <input
                  type="checkbox"
                  checked={allowWeb}
                  onChange={(e) => setAllowWeb(e.target.checked)}
                />
                Allow selected excerpts to be sent to web search
              </label>
            </div>
            <button
              type="button"
              className="ink-btn"
              disabled={!ready}
              onClick={run}
            >
              {busy ? "Checking your draft…" : "Check this draft"}
            </button>
          </div>

          {error && (
            <div
              className="ink-banner"
              data-tone="bad"
              role="alert"
              style={{ marginTop: 16, marginBottom: 0 }}
            >
              {error}
            </div>
          )}
          {busy && (
            <div
              className="ink-banner"
              style={{ marginTop: 16, marginBottom: 0 }}
              role="status"
            >
              Comparing against sources and measuring style. This usually takes
              fifteen to forty seconds.
            </div>
          )}
        </section>

        <aside>
          <div className="ink-panel">
            <h2 className="ink-h3">Know what was compared</h2>
            <p className="ink-note">Attach your sources or paste a reference for a direct comparison. Optional web matching covers retrieved pages only, when search is configured. AI Ink has no access to Turnitin, iThenticate or closed journal databases. A style score is not an AI-authorship probability.</p>
          </div>
          <div className="ink-panel">
            <h2 className="ink-h3">What gets checked</h2>
            <dl style={{ margin: 0 }}>
              {CHECKLIST.map((item) => (
                <div key={item.title} style={{ marginBottom: 16 }}>
                  <dt
                    style={{
                      fontFamily: "var(--ink-serif)",
                      fontSize: 15,
                      fontWeight: 500,
                      marginBottom: 4,
                    }}
                  >
                    {item.title}
                  </dt>
                  <dd
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      color: "var(--ink-2)",
                    }}
                  >
                    {item.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="ink-panel">
            <h2 className="ink-h3">Recent checks</h2>
            {loadingList ? (
              <p className="ink-note">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="ink-note">
                Your reports will appear here once you run a check.
              </p>
            ) : (
              <ul className="ink-panel-list">
                {recent.map((report) => (
                  <li key={report.id}>
                    <a href={`/ink/report/${report.id}`}>
                      <strong>{report.title}</strong>
                      <small>
                        {report.words.toLocaleString()} words ·{" "}
                        {report.matched}% matched · {report.citations}% cited
                      </small>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
