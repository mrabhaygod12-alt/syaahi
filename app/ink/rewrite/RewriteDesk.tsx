"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "@/app/ink/client";

type Mode = "tighten" | "academic" | "plain" | "ownvoice" | "structure";

const MODES: Array<{ id: Mode; label: string; help: string }> = [
  {
    id: "tighten",
    label: "Tighten",
    help: "Cuts stock phrasing and filler. Same claims, fewer words, more specifics.",
  },
  {
    id: "academic",
    label: "Academic register",
    help: "Formal scholarly voice with precise, hedged claims — without padding to sound learned.",
  },
  {
    id: "plain",
    label: "Plain language",
    help: "Short sentences and ordinary words, so the argument is easy to follow.",
  },
  {
    id: "ownvoice",
    label: "Your own voice",
    help: "Rewrites in the cadence of a sample you wrote, keeping the same meaning.",
  },
  {
    id: "structure",
    label: "Restructure",
    help: "Reorders for argument flow and varies paragraph shape without changing claims.",
  },
];

interface RewriteResult {
  text: string;
  provider: string;
  model: string;
  before: number;
  after: number;
}

export default function RewriteDesk({
  initialText,
  reportId,
}: {
  initialText: string;
  reportId?: string;
}) {
  const [text, setText] = useState(initialText);
  const [mode, setMode] = useState<Mode>("tighten");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [sample, setSample] = useState("");
  const [sampleOpen, setSampleOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const active = MODES.find((m) => m.id === mode)!;

  useEffect(() => {
    if (mode === "ownvoice") setSampleOpen(true);
  }, [mode]);

  useEffect(() => {
    if (!reportId) return;
    let active = true;
    requestJson<{report: {text: string}}>(`/api/ink?id=${encodeURIComponent(reportId)}`).then(({data}) => { if (active) setText(data.report.text); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [reportId]);

  async function run() {
    if (!text.trim() || busy) return;
    if (text.length > 6000) { setError("Select one passage up to 6,000 characters. Your full report remains saved."); return; }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await requestJson<{ result: RewriteResult }>(
        "/api/ink/rewrite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rewrite",
            text,
            mode,
            voiceSample: mode === "ownvoice" ? sample : undefined,
          }),
        },
        90000,
      );
      setResult(data.result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The rewrite could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSample() {
    try {
      await requestJson("/api/ink/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "voice", sample }),
      });
      setSampleOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the sample.");
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <main className="ink-page">
      <div className="ink-lead">
        <p className="ink-kicker">Rewrite desk</p>
        <h1>Make it sound like you, only clearer.</h1>
        <p>
          Paste a passage and choose what you want it to do. The editor aims to preserve your meaning. Numbers, citations, quotations, code and equations are checked before an output is accepted; review the wording and claims yourself. Work on one section up to 6,000 characters.
        </p>
      </div>

      <div className="ink-desk-grid">
        <section className="ink-compose" aria-label="Passage to rewrite">
          <label htmlFor="ink-rewrite-text">Passage</label>
          <textarea
            id="ink-rewrite-text"
            className="ink-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the paragraph or section you want to strengthen."
            style={{ minHeight: 260 }}
          />
          <div className="ink-count" style={{ marginTop: 6 }}>
            {words.toLocaleString()} words · {text.length.toLocaleString()}{" "}
            characters
          </div>

          <div style={{ marginTop: 22 }}>
            <h2 className="ink-h3">Mode</h2>
            <div className="ink-modes" role="group" aria-label="Rewrite mode">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="ink-mode"
                  aria-pressed={mode === m.id}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="ink-mode-help">{active.help}</p>
          </div>

          {mode === "ownvoice" && (
            <div style={{ marginBottom: 18 }}>
              {!sampleOpen ? (
                <button
                  type="button"
                  className="ink-btn ink-btn--quiet"
                  onClick={() => setSampleOpen(true)}
                >
                  Edit your writing sample
                </button>
              ) : (
                <>
                  <label htmlFor="ink-sample">
                    A sample of your own writing
                  </label>
                  <textarea
                    id="ink-sample"
                    className="ink-textarea"
                    value={sample}
                    onChange={(e) => setSample(e.target.value)}
                    placeholder="Paste a paragraph you wrote yourself, in the voice you want to keep."
                    style={{
                      minHeight: 110,
                      fontFamily: "var(--ink-sans)",
                      fontSize: 13,
                    }}
                  />
                  <button
                    type="button"
                    className="ink-btn ink-btn--ghost"
                    style={{ marginTop: 8, fontSize: 12 }}
                    onClick={saveSample}
                  >
                    Save this sample
                  </button>
                </>
              )}
            </div>
          )}

          <div className="ink-compose-foot">
            <span className="ink-count">
              {reportId ? (
                <Link
                  href={`/ink/report/${reportId}`}
                  style={{ color: "var(--ink-blue)" }}
                >
                  ← Back to the report
                </Link>
              ) : (
                "Nothing is saved to your account from this page."
              )}
            </span>
            <button
              type="button"
              className="ink-btn"
              disabled={busy || !text.trim()}
              onClick={run}
            >
              {busy ? "Rewriting…" : "Rewrite this passage"}
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
        </section>

        <aside>
          {result ? (
            <div className="ink-panel">
              <h2 className="ink-h3">Result</h2>
              <div
                className="ink-diff-body"
                style={{ maxHeight: "46vh", marginBottom: 14 }}
              >
                {result.text}
              </div>
              <div className="ink-diff-figures">
                <span>
                  {result.before} → {result.after} words
                </span>
                <span>
                  {result.after < result.before
                    ? `${Math.round((1 - result.after / result.before) * 100)}% shorter`
                    : `${Math.round((result.after / result.before - 1) * 100)}% longer`}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" className="ink-btn" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  className="ink-btn ink-btn--ghost"
                  onClick={() => {
                    setText(result.text);
                    setResult(null);
                  }}
                >
                  Use as new draft
                </button>
              </div>
            </div>
          ) : (
            <div className="ink-panel">
              <h2 className="ink-h3">Before and after</h2>
              <p className="ink-note">
                Your rewrite appears here beside the word count change, so you
                can tell tightening apart from losing content. Protected fragments and large length changes are checked automatically. Read both versions before accepting the edit.
              </p>
            </div>
          )}

          <div className="ink-panel">
            <h2 className="ink-h3">Review before using</h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12.5,
                lineHeight: 1.7,
                color: "var(--ink-2)",
              }}
            >
              <li>Check each claim against your original sources.</li>
              <li>Keep attribution when paraphrasing a source.</li>
              <li>Confirm the conclusion still expresses your argument.</li>
              <li>Submit anywhere — you paste the result back yourself.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
