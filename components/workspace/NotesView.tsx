"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import NotePage from "@/components/NotePage";
// Load the server PDF download client only when requested.
const loadPdf = () => import("@/lib/pdf").then((m) => m.downloadPdfFromElement);
import { DEFAULT_STYLE } from "@/lib/handwriting/options";
import {
  PDF_TEMPLATES,
  NOTEBOOK_TEMPLATES,
  isPdfTemplate,
} from "@/lib/pdf/templates";
import { useLesson } from "./LessonProvider";

import { useToast } from "@/components/Toasts";
import { lessonTitle } from "./types";
import NoteHistory from "./NoteHistory";
import { useReader } from "./useReader";
import { renderReadingBody } from "@/lib/pdf/document";
import "katex/dist/katex.min.css";
import "./reading.css";
import { NOTEBOOK_CSS, NOTEBOOK_VERSION } from "@/lib/notes/notebook";
import ReportNote from "@/components/growth/ReportNote";
import FeedbackNudge from "@/components/growth/FeedbackNudge";
import { useAccount } from "@/components/WorkspaceProvider";
import { requestJson } from "@/lib/http-client";

export default function NotesView() {
  const { user } = useAccount();
  const reading = useReader(),
    { reader } = reading;
  const { job, refresh, openChat, markComplete } = useLesson();
  const [editing, setEditing] = useState<number | null>(null),
    [draft, setDraft] = useState(""),
    [saving, setSaving] = useState(false);
  const [editingRevision, setEditingRevision] = useState(0);
  const [proposal, setProposal] = useState(""),
    [goal, setGoal] = useState(
      "Make this clearer while preserving facts and useful diagrams.",
    ),
    [rewriting, setRewriting] = useState(false);
  const [font, setFont] = useState("Kalam"),
    [paper, setPaper] = useState<"ruled" | "plain" | "grid" | "cream">("cream");
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [tpl, setTpl] = useState(
    job?.pdfTemplate && isPdfTemplate(job.pdfTemplate)
      ? job.pdfTemplate
      : "sketchnote",
  );
  const [dlState, setDlState] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [appearanceSaving, setAppearanceSaving] = useState(false),
    [appearanceStatus, setAppearanceStatus] = useState("");
  const roomRef = useRef<HTMLDivElement>(null);
  const pages = job?.pages ?? [];
  const planned = job?.plannedTotal ?? job?.total ?? pages.length;
  useEffect(() => {
    const a = job?.notebookAppearance;
    if (a) {
      setFont(a.font);
      setPaper(a.paper);
      if (isPdfTemplate(a.template)) setTpl(a.template);
    } else if (job?.pdfTemplate && isPdfTemplate(job.pdfTemplate)) {
      setTpl(job.pdfTemplate);
    }
  }, [job?.id]);

  const footerBase = useMemo(
    () => `${pages.length} of ${planned} pages`,
    [pages.length, planned],
  );
  const languageLabel: Record<string, string> = {
    english: "English",
    hindi: "हिंदी",
    hinglish: "Hinglish",
    german: "Deutsch",
    french: "Français",
    spanish: "Español",
  };
  const citationAppendix = useMemo(() => {
    const references = job?.referenceLinks || [];
    const items = [
      job?.sourceUrl
        ? `- Original input: [${job.sourceName || job.sourceUrl}](${job.sourceUrl})`
        : "- Original input: learner-selected topic or supplied material.",
      ...references.map(
        (reference) =>
          `- ${reference.kind === "source" ? "Retrieved reference" : "Further reading"}: [${reference.title}](${reference.url})`,
      ),
    ];
    return {
      topic: "Sources & citation appendix",
      markdown: `# Sources & citation appendix\n\nThis appendix records the lesson inputs and links shown in the Source room. Verify important claims against the original material.\n\n${items.join("\n")}`,
      style: { font: "Kalam", paper: "plain" as const, size: 22 },
      template: "classic" as const,
      footer: "Syaahi · Sources & citation appendix",
    };
  }, [job?.referenceLinks, job?.sourceName, job?.sourceUrl]);

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
    <>
      <style>{NOTEBOOK_CSS}</style>
      <div
        ref={roomRef}
        className={`notes-room notebook-room ${reader.focus ? "reader-focus" : ""}`}
      >
        <header className="notebook-toolbar">
          <div>
            <span className="eyebrow">YOUR NOTEBOOK</span>
            <h1>{lessonTitle(job)}</h1>
            <small>
              {footerBase} ·{" "}
              {languageLabel[job.language || "english"] || "English"} · Saved to
              your account
            </small>
          </div>
          <div className="notebook-toolbar-actions">
            <button
              className="btn light"
              onClick={() =>
                openChat("Help me understand this notebook using its sources.")
              }
            >
              Ask AI
            </button>
            <button
              className="btn dark"
              disabled={!!dlState}
              onClick={async () => {
                if (!printRef.current) return;
                setDlState("Preparing PDF…");
                try {
                  const download = await loadPdf();
                  await download(
                    printRef.current,
                    `syaahi-${job.id}.pdf`,
                    (d, t) => setDlState(`Page ${d}/${t}…`),
                    citationAppendix,
                  );
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "PDF export failed.",
                    true,
                  );
                } finally {
                  setDlState(null);
                }
              }}
            >
              {dlState || "Download PDF"}
            </button>
          </div>
        </header>
        <div className="notebook-view-bar">
          <label>
            View{" "}
            <select
              aria-label="Notebook view"
              value={reader.mode}
              onChange={(e) =>
                reading.change({ mode: e.target.value as typeof reader.mode })
              }
            >
              <option value="notebook">Handwritten notebook</option>
              <option value="reading">Accessible text</option>
              <option value="print">Print preview</option>
            </select>
          </label>
          <button
            className="btn light"
            onClick={() => {
              const el = roomRef.current;
              if (document.fullscreenElement)
                void document
                  .exitFullscreen()
                  .catch(() => toast("Could not exit fullscreen.", true));
              else if (el?.requestFullscreen)
                void el
                  .requestFullscreen()
                  .catch(() =>
                    toast("Fullscreen is unavailable in this browser.", true),
                  );
            }}
          >
            Fullscreen
          </button>
          {reader.mode === "notebook" && (
            <label>
              Zoom{" "}
              <input
                aria-label="Notebook zoom"
                type="range"
                min="1"
                max="1.5"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
          )}
          <a href={`/lesson/${job.id}/quiz`}>Practise recall</a>
        </div>
        <details className="notebook-options">
          <summary>Notebook options</summary>
          <details className="notebook-customize">
            <summary>Notebook appearance</summary>
            <div className="notes-tools">
              <label>
                Handwriting{" "}
                <select
                  aria-label="Handwriting font"
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                >
                  {["Caveat", "Kalam", "Patrick Hand"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                Paper{" "}
                <select
                  aria-label="Paper style"
                  value={paper}
                  onChange={(e) => setPaper(e.target.value as typeof paper)}
                >
                  {["cream", "plain", "ruled", "grid"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Template{" "}
                <select
                  aria-label="PDF template"
                  value={tpl}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isPdfTemplate(v)) setTpl(v);
                  }}
                >
                  {PDF_TEMPLATES.filter(
                    (t) =>
                      NOTEBOOK_TEMPLATES.some((n) => n.id === t.id) ||
                      t.id === tpl,
                  ).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn dark"
                disabled={
                  appearanceSaving ||
                  job.accessRole === "viewer" ||
                  job.accessRole === "editor"
                }
                onClick={async () => {
                  setAppearanceSaving(true);
                  setAppearanceStatus("");
                  try {
                    const r = await requestJson(`/api/jobs/${job.id}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "notebook-appearance",
                        revision: job.revision || 0,
                        appearance: { font, paper, template: tpl },
                      }),
                    });
                    if (!r.response.ok) throw new Error(r.data.error);
                    await refresh();
                    setAppearanceStatus(
                      "Notebook appearance saved to your account.",
                    );
                  } catch (e) {
                    setAppearanceStatus(
                      e instanceof Error
                        ? e.message
                        : "Could not save appearance.",
                    );
                  } finally {
                    setAppearanceSaving(false);
                  }
                }}
              >
                {appearanceSaving ? "Saving…" : "Save notebook style"}
              </button>
            </div>
            <p role="status">{appearanceStatus}</p>
            <div
              className="note-template-picker"
              role="list"
              aria-label="PDF template previews"
            >
              {NOTEBOOK_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="listitem"
                  className={tpl === template.id ? "selected" : ""}
                  aria-pressed={tpl === template.id}
                  onClick={() => {
                    setTpl(template.id);
                  }}
                >
                  <span
                    className={`note-template-thumb template-${template.id}`}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{template.label}</b>
                  <small>{template.blurb}</small>
                </button>
              ))}
            </div>
          </details>
          <details className="reader-controls-panel">
            <summary>Reading & accessibility</summary>
            <fieldset
              className="reader-controls"
              disabled={!reading.loaded || reading.saving}
            >
              <legend>Reading preferences</legend>
              <label>
                View
                <select
                  aria-label="View"
                  value={reader.mode}
                  onChange={(e) =>
                    reading.change({
                      mode: e.target.value as typeof reader.mode,
                    })
                  }
                >
                  <option value="print">Print preview</option>
                  <option value="reading">Accessible text</option>
                  <option value="notebook">Handwritten notebook</option>
                </select>
              </label>
              <label>
                Text size
                <select
                  aria-label="Text size"
                  value={reader.size}
                  onChange={(e) =>
                    reading.change({
                      size: Number(e.target.value) as typeof reader.size,
                    })
                  }
                >
                  {[18, 20, 24, 28].map((n) => (
                    <option key={n} value={n}>
                      {n} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Line width
                <select
                  aria-label="Line width"
                  value={reader.width}
                  onChange={(e) =>
                    reading.change({
                      width: Number(e.target.value) as typeof reader.width,
                    })
                  }
                >
                  {[56, 68, 80].map((n) => (
                    <option key={n} value={n}>
                      {n} characters
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Line spacing
                <select
                  aria-label="Line spacing"
                  value={reader.lineHeight}
                  onChange={(e) =>
                    reading.change({
                      lineHeight: Number(
                        e.target.value,
                      ) as typeof reader.lineHeight,
                    })
                  }
                >
                  {[1.5, 1.7, 2].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Page colour
                <select
                  aria-label="Page colour"
                  value={reader.tone}
                  onChange={(e) =>
                    reading.change({
                      tone: e.target.value as typeof reader.tone,
                    })
                  }
                >
                  <option value="paper">Warm paper</option>
                  <option value="white">White</option>
                  <option value="night">Night</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={reader.focus}
                  onChange={(e) => reading.change({ focus: e.target.checked })}
                />{" "}
                Hide secondary tools
              </label>
              <button className="btn light" onClick={() => void reading.save()}>
                {reading.saving ? "Saving…" : "Save reading preferences"}
              </button>
            </fieldset>
            <p className="small" role="status">
              {reading.status}. Reading settings leave PDF styles unchanged.
            </p>
            <button
              className="btn light"
              onClick={() => void reading.load()}
              disabled={reading.saving}
            >
              Reload preferences
            </button>
          </details>
          {(job.status === "working" || job.status === "queued") && (
            <div className="card" role="status" style={{ marginBottom: 16 }}>
              <b>
                {job.status === "queued"
                  ? "Generation is queued"
                  : "Generating your lesson"}
              </b>
              <p className="small">
                Section {Math.min(pages.length + 1, planned)} of {planned} is
                next.
                {pages.at(-1)?.provider &&
                  ` Last completed section used ${pages.at(-1)?.provider}.`}
              </p>
            </div>
          )}
          {job.status === "error" && pages.length < planned && (
            <div className="card" role="alert" style={{ marginBottom: 16 }}>
              <b>
                Generation paused after section {pages.length} of {planned}.
              </b>
              <p className="small">
                Your completed sections are saved. Resume continues with section{" "}
                {pages.length + 1}; it does not recreate or charge completed
                work.
              </p>
              {job.error && (
                <p className="small">Last provider response: {job.error}</p>
              )}
              <button
                className="btn dark"
                disabled={resuming}
                onClick={async () => {
                  setResuming(true);
                  try {
                    const response = await fetch(`/api/jobs/${job.id}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "resume" }),
                    });
                    const data = await response.json();
                    if (!response.ok)
                      throw new Error(
                        data.error || "Could not resume generation.",
                      );
                    toast(`Continuing from section ${data.resumeFrom + 1}.`);
                    await refresh();
                  } catch (error) {
                    toast(
                      error instanceof Error
                        ? error.message
                        : "Could not resume generation.",
                      true,
                    );
                  } finally {
                    setResuming(false);
                  }
                }}
              >
                {resuming
                  ? "Resuming…"
                  : `Resume from section ${pages.length + 1}`}
              </button>
            </div>
          )}

          <details className="notebook-report">
            <summary>Report an issue</summary>
            <ReportNote lesson={job.id} />
          </details>
        </details>

        <div ref={printRef} className={`pages-col tpl-${tpl}`}>
          {pages.map((p, i) => (
            <div key={i} id={`page-${i + 1}`} className="note-anchor">
              <div className="section-heading" style={{ margin: "16px 0" }}>
                <label className="atlas-complete">
                  <input
                    type="checkbox"
                    checked={job.progress?.completed?.includes(i) || false}
                    onChange={(e) => markComplete(i, e.target.checked)}
                  />
                  Reviewed
                </label>
                <span className="small">
                  Section {i + 1} · {p.topic} · {p.provider}
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
              {job.sections?.[i]?.objective && (
                <p className="small">
                  Learning outcome: {job.sections[i].objective}
                </p>
              )}
              {job.sections?.[i]?.prerequisite && (
                <p className="small">
                  Assumed knowledge: {job.sections[i].prerequisite}
                </p>
              )}
              <details className="notebook-section-details">
                <summary>History & learning goals</summary>
                <NoteHistory
                  lesson={job.id}
                  section={i}
                  current={p.markdown}
                  onRestore={() => void refresh()}
                />
                <details className="atlas-recall">
                  <summary>
                    Active recall: explain {p.topic} without looking
                  </summary>
                  <p>
                    Close the notes and describe the core idea, one example and
                    a common mistake. Then compare your answer with the source
                    below.
                  </p>
                  <button
                    type="button"
                    className="btn light"
                    onClick={() =>
                      openChat(
                        `Ask me one source-grounded question about ${p.topic}. Wait for my answer before explaining it.`,
                      )
                    }
                  >
                    Practice with the study assistant
                  </button>
                </details>
              </details>
              {editing === i && (
                <div className="card">
                  {editingRevision !== (job.revision || 0) && (
                    <p role="alert">
                      This lesson changed while you were editing. Copy your
                      draft, cancel, and reopen the section before saving.
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
                  <button
                    className="btn light"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {reader.mode !== "print" ? (
                <article
                  aria-label={`Section ${i + 1}: ${p.topic}`}
                  data-paper={paper}
                  data-render-version={NOTEBOOK_VERSION}
                  className={
                    reader.mode === "notebook"
                      ? `notebook-page template-${tpl}`
                      : `reading-page ${reader.tone}`
                  }
                  style={
                    {
                      "--notebook-font": /[\u0900-\u097f]/.test(p.markdown)
                        ? "var(--font-kalam)"
                        : font === "Caveat"
                          ? "var(--font-caveat)"
                          : font === "Patrick Hand"
                            ? "var(--font-patrick-hand)"
                            : "var(--font-kalam)",
                      "--notebook-size": `${23 * zoom}px`,
                      "--reading-width": `${reader.width}ch`,
                      "--reading-size": `${reader.size}px`,
                      "--reading-line": reader.lineHeight,
                    } as React.CSSProperties
                  }
                  data-print-note={JSON.stringify({
                    markdown: p.markdown,
                    style: { ...DEFAULT_STYLE, font, paper, size: 24 },
                    template: tpl,
                    footer: `Section ${i + 1} · Syaahi`,
                  })}
                  dangerouslySetInnerHTML={{
                    __html:
                      reader.mode === "notebook"
                        ? `<div class="cornell-body">${renderReadingBody(p.markdown)}</div>`
                        : renderReadingBody(p.markdown),
                  }}
                />
              ) : (
                <NotePage
                  markdown={p.markdown}
                  style={{ ...DEFAULT_STYLE, font, paper, size: 24 }}
                  seedKey={`lesson-${job.id}-${i}`}
                  footer={`Page ${i + 1} of ${pages.length} · ${planned} planned · ${PDF_TEMPLATES.find((t) => t.id === tpl)?.label} · Syaahi`}
                  template={tpl}
                />
              )}
            </div>
          ))}
        </div>
        <div className="notes-dots" aria-label="Jump to page">
          {pages.map((_, i) => (
            <a
              key={i}
              href={`#page-${i + 1}`}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(`page-${i + 1}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              title={`Page ${i + 1}`}
            >
              •
            </a>
          ))}
        </div>
        {user && (
          <FeedbackNudge
            key={`${user.id}:${job.id}`}
            owner={user.id}
            lesson={job.id}
            ready={job.status === "done" && !!job.progress?.completed?.length}
          />
        )}
      </div>
    </>
  );
}
