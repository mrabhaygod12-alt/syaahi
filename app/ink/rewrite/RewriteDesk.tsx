"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  LoaderCircle,
  PenLine,
  Sparkles,
  Check,
} from "lucide-react";
import { requestJson } from "../client";
import { InkDialog } from "../InkUI";
type Mode = "tighten" | "academic" | "plain" | "ownvoice" | "structure";
const MODES: { id: Mode; label: string; help: string }[] = [
  { id: "tighten", label: "Tighten", help: "Less filler. A sharper argument." },
  { id: "academic", label: "Academic", help: "A precise, formal register." },
  { id: "plain", label: "Simplify", help: "Clear sentences. Familiar words." },
  {
    id: "ownvoice",
    label: "My voice",
    help: "Use your own writing sample as a guide.",
  },
  {
    id: "structure",
    label: "Restructure",
    help: "Give your argument a clearer flow.",
  },
];
interface Result {
  text: string;
  before: number;
  after: number;
  provider: string;
  model: string;
}
export default function RewriteDesk({
  initialText,
  reportId,
  start,
  end,
}: {
  initialText: string;
  reportId?: string;
  start?: number;
  end?: number;
}) {
  const [text, setText] = useState(initialText);
  const [mode, setMode] = useState<Mode>("tighten");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!reportId);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [sample, setSample] = useState("");
  const [sampleOpen, setSampleOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  useEffect(() => {
    if (!reportId) return;
    let active = true;
    requestJson<{ report: { text: string } }>(
      `/api/ink?id=${encodeURIComponent(reportId)}`,
    )
      .then(({ data }) => {
        if (active) {
          const valid =
            Number.isSafeInteger(start) &&
            Number.isSafeInteger(end) &&
            start! >= 0 &&
            end! > start! &&
            end! <= data.report.text.length;
          setText(
            valid ? data.report.text.slice(start, end) : data.report.text,
          );
        }
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
  }, [reportId, start, end]);
  async function run() {
    if (busy || text.trim().length < 40 || text.length > 6000) return;
    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const { data } = await requestJson<{ result: Result }>(
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
        e instanceof Error
          ? e.message
          : "Rewrite unavailable. Your draft is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveSample() {
    setSaving(true);
    setError("");
    try {
      await requestJson("/api/ink/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "voice", sample }),
      });
      setSampleOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sample could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      setError(
        "Clipboard access was blocked. Select and copy the revised text.",
      );
    }
  }
  return (
    <main className="ink-page ink-page--wide">
      <div className="ink-lead" data-ink-reveal>
        <p className="ink-kicker">IMPROVE WRITING</p>
        <h1>
          A stronger draft.
          <br />
          Still your argument.
        </h1>
        <p>Choose a direction. Compare the edit. Keep what works.</p>
      </div>
      <div className="ink-rewrite-settings" data-ink-reveal>
        <div>
          <div className="ink-modes" role="group" aria-label="Rewrite mode">
            {MODES.map((m) => (
              <button
                className="ink-mode"
                aria-pressed={m.id === mode}
                key={m.id}
                disabled={busy}
                onClick={() => {
                  setMode(m.id);
                  setResult(null);
                  if (m.id === "ownvoice") setSampleOpen(true);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="ink-mode-help">
            {MODES.find((m) => m.id === mode)?.help}
          </p>
        </div>
        {mode === "ownvoice" && (
          <button
            className="ink-btn ink-btn--ghost"
            onClick={() => setSampleOpen(true)}
          >
            Writing sample
          </button>
        )}
      </div>
      {error && (
        <div className="ink-banner" data-tone="bad" role="alert">
          {error}
        </div>
      )}
      {text.length > 6000 && (
        <div className="ink-banner" data-tone="warn">
          Select a section up to 6,000 characters. Your complete report stays
          saved.
        </div>
      )}
      <div className="ink-rewrite-grid" data-ink-reveal>
        <section className="ink-compose" aria-label="Passage to rewrite">
          <div className="ink-section-title">
            <h2>Original</h2>
            <span className="ink-tag">YOUR DRAFT</span>
          </div>
          <label htmlFor="ink-rewrite-text">Passage</label>
          <textarea
            id="ink-rewrite-text"
            className="ink-textarea"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
              setCopied(false);
            }}
            disabled={busy || loading}
            placeholder="Paste a paragraph to improve…"
            style={{ minHeight: 340 }}
          />
          <div className="ink-compose-foot">
            <span className="ink-count">
              {loading
                ? "Loading passage…"
                : `${words.toLocaleString()} words · ${text.length.toLocaleString()} / 6,000 characters`}
            </span>
            <button
              className="ink-btn"
              disabled={
                busy || loading || text.trim().length < 40 || text.length > 6000
              }
              onClick={run}
            >
              {busy ? (
                <LoaderCircle size={16} className="ink-spin" />
              ) : (
                <PenLine size={16} />
              )}{" "}
              {busy ? "Rewriting…" : "Rewrite passage"}
            </button>
          </div>
        </section>
        <section className="ink-panel" aria-label="Revised passage">
          <div className="ink-section-title">
            <h2>Revised</h2>
            <span className="ink-tag" data-tone="good">
              {result ? "READY TO REVIEW" : "PREVIEW"}
            </span>
          </div>
          {result ? (
            <>
              <div
                className="ink-diff-body"
                style={{ minHeight: 340, maxHeight: 550 }}
              >
                {result.text}
              </div>
              <div className="ink-diff-figures">
                <span>
                  {result.before} → {result.after} words
                </span>
                <span>Review claims and citations</span>
              </div>
              <div className="ink-dialog-actions">
                <button className="ink-btn ink-btn--ghost" onClick={copy}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button className="ink-btn" onClick={() => setAcceptOpen(true)}>
                  Use as new draft <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <div className="ink-result-empty">
              {busy ? (
                <LoaderCircle size={32} className="ink-spin" />
              ) : (
                <Sparkles size={32} />
              )}
              <h2>
                {busy ? "Finding a clearer way…" : "Your next version, here."}
              </h2>
              <p>
                {busy
                  ? "Your original stays untouched while the provider works."
                  : "A side-by-side edit, ready for your review."}
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="ink-dialog-actions">
        {reportId ? (
          <Link className="ink-text-link" href={`/ink/report/${reportId}`}>
            <ArrowLeft size={14} /> Back to report
          </Link>
        ) : (
          <Link className="ink-text-link" href="/ink">
            <ArrowLeft size={14} /> Document check
          </Link>
        )}
        <p className="ink-small-print">
          Numbers and common citations are checked. Verify meaning and
          attribution before using an edit.
        </p>
      </div>
      <InkDialog
        open={sampleOpen}
        onClose={() => {
          if (!saving) setSampleOpen(false);
        }}
        title="Your writing, as a guide"
        wide
      >
        <p className="ink-note">
          Use a paragraph you wrote. It is sent with your rewrite to the
          configured AI provider.
        </p>
        <label htmlFor="ink-sample">A sample of your own writing</label>
        <textarea
          id="ink-sample"
          className="ink-textarea"
          maxLength={4000}
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          placeholder="Paste your own writing sample…"
        />
        <div className="ink-dialog-actions">
          <span className="ink-count">
            Clear and save to remove a saved sample.
          </span>
          <button className="ink-btn" disabled={saving} onClick={saveSample}>
            {saving ? "Saving…" : "Save this sample"}
          </button>
        </div>
      </InkDialog>
      <InkDialog
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        title="Use this revision?"
      >
        <p className="ink-note">
          This replaces the passage in the editing desk. Your original saved
          report is unchanged.
        </p>
        <div className="ink-dialog-actions">
          <button
            className="ink-btn ink-btn--ghost"
            onClick={() => setAcceptOpen(false)}
          >
            Keep comparing
          </button>
          <button
            className="ink-btn"
            onClick={() => {
              if (result) setText(result.text);
              setResult(null);
              setCopied(false);
              setAcceptOpen(false);
            }}
          >
            Use revision
          </button>
        </div>
      </InkDialog>
    </main>
  );
}
