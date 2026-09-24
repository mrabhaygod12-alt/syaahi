"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import NotePage from "@/components/NotePage";
// Load the server PDF download client only when requested.
const loadPdf = () => import("@/lib/pdf").then((m) => m.downloadPdfFromElement);
import { DEFAULT_STYLE } from "@/lib/handwriting/options";
import { PDF_TEMPLATES, isPdfTemplate } from "@/lib/pdf/templates";
import { useLesson } from "./LessonProvider";

import { useToast } from "@/components/Toasts";
import { lessonTitle } from "./types";

export default function NotesView() {
  const { job, setTemplate, refresh, openChat } = useLesson();
  const [editing, setEditing] = useState<number | null>(null),
    [draft, setDraft] = useState(""),
    [saving, setSaving] = useState(false);
  const [editingRevision, setEditingRevision] = useState(0);
  const [proposal, setProposal] = useState(""),
    [goal, setGoal] = useState(
      "Make this clearer while preserving facts and useful diagrams.",
    ),
    [rewriting, setRewriting] = useState(false);
  const [font, setFont] = useState("Caveat"),
    [paper, setPaper] = useState<"ruled" | "plain" | "grid" | "cream">("cream");
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [tpl, setTpl] = useState(
    job?.pdfTemplate && isPdfTemplate(job.pdfTemplate)
      ? job.pdfTemplate
      : "classic",
  );
  const [dlState, setDlState] = useState<string | null>(null);
  const pages = job?.pages ?? [];
  const planned = job?.plannedTotal ?? job?.total ?? pages.length;

  const footerBase = useMemo(
    () => `${pages.length} of ${planned} pages`,
    [pages.length, planned],
  );

  // Deep-link from chat citations: /notes#page-3 scrolls to that page.
  useEffect(() => {
    const m = window.location.hash.match(/#page-(\d+)/);
    if (!m) return;
    const el = document.getElementById(`page-${m[1]}`);
    if (el)
      setTimeout(
        () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
        350,
      );
  }, [pages.length]);

  if (!job) return null;

  return (
    <div className="notes-room">
      <div className="notes-toolbar">
        <div>
          <b>{lessonTitle(job)}</b>
          <span className="small">
            {" "}
            · {footerBase} generated ·{" "}
            {job.language === "hindi"
              ? "हिंदी"
              : job.language === "hinglish"
                ? "Hinglish"
                : "English"}
          </span>
        </div>
        <div className="notes-tools">
          <select
            aria-label="Handwriting font"
            value={font}
            onChange={(e) => setFont(e.target.value)}
          >
            {["Caveat", "Kalam", "Patrick Hand"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select
            aria-label="Paper style"
            value={paper}
            onChange={(e) => setPaper(e.target.value as typeof paper)}
          >
            {["cream", "plain", "ruled", "grid"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            value={tpl}
            onChange={(e) => {
              const v = e.target.value;
              setTpl(isPdfTemplate(v) ? v : "classic");
              setTemplate(v);
            }}
          >
            {PDF_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            className="btn dark"
            disabled={!!dlState && dlState !== "error"}
            onClick={async () => {
              if (!printRef.current) return;
              setDlState("Starting…");
              try {
                const downloadPdfFromElement = await loadPdf();
                await downloadPdfFromElement(
                  printRef.current,
                  `syaahi-${job.id}.pdf`,
                  (d, t) => setDlState(`Page ${d}/${t}…`),
                );
                setDlState(null);
              } catch (e: any) {
                setDlState("error");
                toast(e?.message ?? "PDF export failed.", true);
                setDlState(null);
              }
            }}
          >
            {dlState ?? "Download PDF"}
          </button>
        </div>
      </div>
      <p className="small notes-tpl-blurb">
        {PDF_TEMPLATES.find((t) => t.id === tpl)?.blurb} · Long sections
        continue onto extra sheets.
      </p>

      <div ref={printRef} className={`pages-col tpl-${tpl}`}>
        {pages.map((p, i) => (
          <div key={i} id={`page-${i}`} className="note-anchor">
            <div className="section-heading" style={{ margin: "16px 0" }}>
              <span className="small">
                Section {i + 1} · {p.topic}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn light"
                  onClick={() =>
                    openChat(`Explain ${p.topic} using these notes.`)
                  }
                >
                  Ask AI
                </button>
                <button
                  className="btn light"
                  disabled={
                    job.status === "working" ||
                    job.status === "queued" ||
                    job.accessRole === "viewer"
                  }
                  onClick={() => {
                    setEditing(i);
                    setEditingRevision(job.revision || 0);
                    setDraft(p.markdown);
                    setProposal("");
                  }}
                >
                  Edit notes
                </button>
              </div>
            </div>
            {editing === i && (
              <div className="card">
                {editingRevision !== (job.revision || 0) && (
                  <p role="alert">
                    This lesson changed while you were editing. Copy your draft,
                    cancel, and reopen the section before saving.
                  </p>
                )}
                <label className="small">
                  Ask the writing assistant
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    maxLength={500}
                  />
                </label>
                <button
                  className="btn light"
                  disabled={rewriting}
                  onClick={async () => {
                    setRewriting(true);
                    try {
                      const r = await fetch("/api/lesson-tools", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "rewrite",
                          lesson: job.id,
                          index: i,
                          instruction: goal,
                        }),
                      });
                      const d = await r.json();
                      if (!r.ok) throw new Error(d.error);
                      setProposal(d.proposal);
                    } catch (e) {
                      toast(
                        e instanceof Error
                          ? e.message
                          : "Suggestion unavailable.",
                        true,
                      );
                    } finally {
                      setRewriting(false);
                    }
                  }}
                >
                  {rewriting
                    ? "Preparing a suggestion..."
                    : "Suggest an improvement"}
                </button>
                {proposal && (
                  <details open className="rewrite-proposal">
                    <summary>Review the proposed rewrite</summary>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        fontSize: 13,
                      }}
                    >
                      {proposal}
                    </pre>
                    <button
                      className="btn light"
                      onClick={() => {
                        setDraft(proposal);
                        setProposal("");
                      }}
                    >
                      Use in editor (not saved yet)
                    </button>{" "}
                    <button
                      className="btn light"
                      onClick={() => setProposal("")}
                    >
                      Discard suggestion
                    </button>
                  </details>
                )}
                <textarea
                  aria-label="Edit section Markdown"
                  rows={14}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  className="btn dark"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const r = await fetch(`/api/jobs/${job.id}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "edit-page",
                          index: i,
                          revision: editingRevision,
                          markdown: draft,
                        }),
                      });
                      const data = await r.json();
                      if (!r.ok) throw new Error(data.error);
                      await refresh();
                      setEditing(null);
                      toast(
                        "Notes saved. Generate new practice after editing.",
                      );
                    } catch (e) {
                      toast(
                        e instanceof Error ? e.message : "Save failed.",
                        true,
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>{" "}
                <button className="btn light" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            )}
            <NotePage
              markdown={p.markdown}
              style={{ ...DEFAULT_STYLE, font, paper, size: 24 }}
              seedKey={`lesson-${job.id}-${i}`}
              footer={`Page ${i + 1} of ${pages.length} · ${planned} planned · ${PDF_TEMPLATES.find((t) => t.id === tpl)?.label} · Syaahi`}
              template={tpl}
            />
          </div>
        ))}
      </div>
      <div className="notes-dots" aria-label="Jump to page">
        {pages.map((_, i) => (
          <a
            key={i}
            href={`#page-${i}`}
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById(`page-${i}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            title={`Page ${i + 1}`}
          >
            •
          </a>
        ))}
      </div>
    </div>
  );
}
