"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  LoaderCircle,
  MessageCircle,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import type {
  Assignment,
  AssignmentSource,
  CitationStyle,
  AssignmentFormat,
} from "@/lib/assignments/types";
import {
  ASSIGNMENT_CREDITS,
  ASSIGNMENT_FORMATS,
  MAX_ASSIGNMENT_PAGES,
} from "@/lib/assignments/types";
import "./assignment-studio.css";

type FormState = {
  title: string;
  course: string;
  topic: string;
  instructions: string;
  format: AssignmentFormat;
  pageCount: number;
  paper: "ruled" | "plain";
  font: "Kalam" | "Caveat" | "Patrick Hand";
  citationStyle: CitationStyle;
};

const initialForm: FormState = {
  title: "",
  course: "",
  topic: "",
  instructions: "",
  format: "Research paper",
  pageCount: 4,
  paper: "ruled",
  font: "Kalam",
  citationStyle: "APA 7",
};

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(init?.headers || {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign(`/login?next=${encodeURIComponent("/assignment")}`);
    throw new Error("Sign in to continue.");
  }
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data;
}

function phaseLabel(assignment: Assignment) {
  if (assignment.status === "error") return "Needs attention";
  if (assignment.status === "ready") return "Ready to review";
  if (assignment.status === "outline") return "Outline ready";
  if (assignment.phase === "outline")
    return assignment.status === "working"
      ? "Reading your brief"
      : "Building your outline";
  if (assignment.status === "working")
    return `Writing page ${Math.min(assignment.sections.length + 1, assignment.pageCount)} of ${assignment.pageCount}`;
  return "In the writing queue";
}

function sourceName(source: AssignmentSource) {
  return source.authors[0]
    ? `${source.authors[0]}${source.year ? ` · ${source.year}` : ""}`
    : source.year
      ? String(source.year)
      : "Author details unavailable";
}

export default function AssignmentStudio() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [sources, setSources] = useState<AssignmentSource[]>([]);
  const [selectedDois, setSelectedDois] = useState<string[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState("");
  const [revisionSection, setRevisionSection] = useState(0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState("");
  const [outline, setOutline] = useState<string[]>([]);

  const load = useCallback(
    async (selectedId?: string) => {
      const data = await jsonRequest("/api/assignments");
      setAssignments(data.assignments || []);
      setBalance(data.balance ?? null);
      const id = selectedId || assignment?.id;
      if (id) {
        const current = await jsonRequest(
          `/api/assignments/${encodeURIComponent(id)}`,
        );
        setAssignment(current.assignment);
        setOutline(current.assignment.outline || []);
      }
    },
    [assignment?.id],
  );

  useEffect(() => {
    let alive = true;
    jsonRequest("/api/assignments")
      .then((data) => {
        if (!alive) return;
        setAssignments(data.assignments || []);
        setBalance(data.balance ?? null);
        const requested = new URLSearchParams(location.search).get("id");
        const active = requested
          ? (data.assignments || []).find(
              (item: Assignment) => item.id === requested,
            )
          : (data.assignments || []).find((item: Assignment) =>
              ["queued", "working", "outline"].includes(item.status),
            );
        if (active)
          void jsonRequest(
            `/api/assignments/${encodeURIComponent(active.id)}`,
          ).then((current) => {
            if (!alive) return;
            setAssignment(current.assignment);
            setOutline(current.assignment.outline || []);
          });
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!assignment || !["queued", "working"].includes(assignment.status))
      return;
    const timer = window.setInterval(() => {
      void jsonRequest(`/api/assignments/${encodeURIComponent(assignment.id)}`)
        .then((data) => {
          setAssignment(data.assignment);
          setOutline(data.assignment.outline || []);
          if (data.assignment.status === "ready") {
            setNotice("Your assignment draft is ready for review.");
            void load(data.assignment.id);
          }
        })
        .catch((e) => setError(e.message));
    }, 4500);
    return () => window.clearInterval(timer);
  }, [assignment?.id, assignment?.status, load]);

  const update = (key: keyof FormState, value: string | number) =>
    setForm((old) => ({ ...old, [key]: value }) as FormState);
  const wordEstimate = useMemo(() => form.pageCount * 190, [form.pageCount]);

  async function findSources() {
    const query = sourceQuery.trim() || form.topic.trim();
    if (query.length < 4) {
      setError("Enter a topic before searching for sources.");
      return;
    }
    setSourceBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await jsonRequest("/api/assignments/research", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      setSources(data.sources || []);
      setNotice(
        data.sources?.length
          ? `${data.sources.length} scholarly records found. Select only the sources you have checked.`
          : "No matching records came back. Try a more specific title or phrase.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research search failed.");
    } finally {
      setSourceBusy(false);
    }
  }

  async function suggestPages() {
    setSuggestBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await jsonRequest("/api/assignments/suggest", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          topic: form.topic,
          instructions: form.instructions,
          format: form.format,
        }),
      });
      update("pageCount", data.pages);
      setNotice(
        `AI suggests ${data.pages} content page${data.pages === 1 ? "" : "s"}. ${data.reason}`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not suggest a page count.",
      );
    } finally {
      setSuggestBusy(false);
    }
  }

  async function createAssignment(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const id = crypto.randomUUID();
      const data = await jsonRequest("/api/assignments", {
        method: "POST",
        body: JSON.stringify({ ...form, id, dois: selectedDois }),
      });
      setAssignment(data.assignment);
      setOutline(data.assignment.outline || []);
      setBalance(data.balance);
      setNotice(
        "Your outline is being prepared. The 8-credit charge covers this assignment, revisions, and exports.",
      );
      window.history.replaceState(
        {},
        "",
        `/assignment?id=${encodeURIComponent(data.assignment.id)}`,
      );
      await load(data.assignment.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not start the assignment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveOutline(approve = false) {
    if (!assignment) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!approve) {
        const data = await jsonRequest(
          `/api/assignments/${encodeURIComponent(assignment.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ action: "outline", outline }),
          },
        );
        setAssignment(data.assignment);
        setNotice("Outline saved.");
      } else {
        const saved = await jsonRequest(
          `/api/assignments/${encodeURIComponent(assignment.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ action: "outline", outline }),
          },
        );
        const data = await jsonRequest(
          `/api/assignments/${encodeURIComponent(assignment.id)}`,
          { method: "PATCH", body: JSON.stringify({ action: "approve" }) },
        );
        setAssignment(data.assignment);
        setOutline(saved.assignment.outline || outline);
        setNotice("Outline approved. Page drafting has started.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the outline.");
    } finally {
      setBusy(false);
    }
  }

  async function reviseSection(event: React.FormEvent) {
    event.preventDefault();
    if (!assignment) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await jsonRequest(
        `/api/assignments/${encodeURIComponent(assignment.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action: "revise",
            sectionIndex: revisionSection,
            prompt: revision,
          }),
        },
      );
      setAssignment(data.assignment);
      setRevision("");
      setNotice(
        "The selected page has been revised. Check its sources and course requirements.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revise that page.");
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "pdf" | "docx") {
    if (!assignment) return;
    setDownloadBusy(format);
    setError("");
    try {
      const response = await fetch(
        `/api/assignments/${encodeURIComponent(assignment.id)}/export?format=${format}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (response.status === 401) {
        window.location.assign(
          `/login?next=${encodeURIComponent("/assignment")}`,
        );
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "The file could not be prepared.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${
        assignment.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "assignment"
      }.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setNotice(`${format.toUpperCase()} download started.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloadBusy("");
    }
  }

  async function openAssignment(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await jsonRequest(
        `/api/assignments/${encodeURIComponent(id)}`,
      );
      setAssignment(data.assignment);
      setOutline(data.assignment.outline || []);
      setRevisionSection(0);
      window.history.replaceState(
        {},
        "",
        `/assignment?id=${encodeURIComponent(id)}`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not open that assignment.",
      );
    } finally {
      setBusy(false);
    }
  }

  function newAssignment() {
    setAssignment(null);
    setOutline([]);
    setNotice("");
    setError("");
    setSources([]);
    setSelectedDois([]);
    setForm(initialForm);
    setAssistantOpen(false);
    window.history.replaceState({}, "", "/assignment");
  }

  return (
    <div className="assignment-studio">
      <header className="assignment-topbar">
        <a href="/dashboard" className="assignment-back">
          <ArrowLeft size={17} /> Study workspace
        </a>
        <div className="assignment-brand">
          <span>
            <NotebookPen size={18} />
          </span>
          <strong>Assignment Studio</strong>
          <i>UG + PG</i>
        </div>
        <div className="assignment-balance">
          <span>{balance ?? "…"}</span> credits
        </div>
      </header>
      <main className="assignment-main">
        <div className="assignment-heading">
          <div>
            <p className="assignment-kicker">A thoughtful first draft</p>
            <h1>Build an assignment with sources in view.</h1>
            <p>
              Shape the structure, check the evidence, then work through a
              handwritten-style draft one page at a time.
            </p>
          </div>
          <div className="assignment-process" aria-label="Assignment workflow">
            <span className={!assignment ? "is-active" : "is-done"}>
              <b>01</b> Brief
            </span>
            <i />
            <span
              className={
                assignment?.status === "outline"
                  ? "is-active"
                  : assignment && assignment.status !== "queued"
                    ? "is-done"
                    : ""
              }
            >
              <b>02</b> Outline
            </span>
            <i />
            <span className={assignment?.status === "ready" ? "is-active" : ""}>
              <b>03</b> Draft
            </span>
          </div>
        </div>

        {(error || notice) && (
          <div
            className={`assignment-alert ${error ? "is-error" : "is-notice"}`}
            role={error ? "alert" : "status"}
          >
            {error || notice}
            <button
              type="button"
              onClick={() => {
                setError("");
                setNotice("");
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <div className="assignment-layout">
          <section className="assignment-workbench">
            {assignment ? (
              <>
                <div className="assignment-card-head">
                  <div>
                    <p className="assignment-kicker">
                      {phaseLabel(assignment)}
                    </p>
                    <h2>{assignment.title}</h2>
                    <p>
                      {assignment.course || "University assignment"} ·{" "}
                      {assignment.format} · {assignment.pageCount} content pages
                    </p>
                  </div>
                  <button
                    className="assignment-quiet-button"
                    onClick={newAssignment}
                  >
                    <Plus size={16} /> New
                  </button>
                </div>
                {assignment.status === "queued" ||
                assignment.status === "working" ? (
                  <div className="assignment-progress-card">
                    <div className="assignment-progress-icon">
                      <LoaderCircle className="is-spinning" size={22} />
                    </div>
                    <div>
                      <strong>{phaseLabel(assignment)}</strong>
                      <p>
                        {assignment.phase === "outline"
                          ? "Matching the structure to your brief and course format."
                          : "Each page is saved as it finishes, so you can return without losing progress."}
                      </p>
                    </div>
                    <div className="assignment-progress-track">
                      <span
                        style={{
                          width: `${assignment.phase === "outline" ? 9 : Math.max(8, assignment.progress)}%`,
                        }}
                      />
                    </div>
                    <small>
                      {assignment.phase === "outline"
                        ? "Outline pass"
                        : `${assignment.progress}% · ${assignment.sections.length} of ${assignment.pageCount} pages`}
                    </small>
                  </div>
                ) : null}
                {assignment.status === "outline" && (
                  <div className="assignment-outline">
                    <div className="assignment-section-heading">
                      <div>
                        <span className="assignment-number">02</span>
                        <div>
                          <h3>Review the outline</h3>
                          <p>Edit a heading before the draft begins.</p>
                        </div>
                      </div>
                      <span>{outline.length} sections</span>
                    </div>
                    <div className="assignment-outline-list">
                      {outline.map((heading, index) => (
                        <label key={`${assignment.id}-${index}`}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <input
                            value={heading}
                            maxLength={100}
                            onChange={(event) =>
                              setOutline((old) =>
                                old.map((item, i) =>
                                  i === index ? event.target.value : item,
                                ),
                              )
                            }
                            aria-label={`Outline heading ${index + 1}`}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="assignment-actions">
                      <button
                        className="assignment-secondary"
                        disabled={busy}
                        onClick={() => void saveOutline(false)}
                      >
                        Save outline
                      </button>
                      <button
                        className="assignment-primary"
                        disabled={busy}
                        onClick={() => void saveOutline(true)}
                      >
                        Approve and draft <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
                {assignment.status === "ready" && (
                  <>
                    <div className="assignment-ready-banner">
                      <Check size={17} />
                      <div>
                        <strong>
                          Draft complete · {assignment.sections.length} pages
                        </strong>
                        <span>
                          AI-assisted study draft. Verify claims, citations, and
                          your course’s AI policy before submitting.
                        </span>
                      </div>
                    </div>
                    <div className="assignment-paper-stack">
                      {assignment.sections.map((section, index) => (
                        <article
                          className="assignment-paper"
                          key={`${assignment.id}-${index}`}
                          data-paper={assignment.paper}
                          style={{
                            fontFamily: `var(--font-${assignment.font.toLowerCase().replaceAll(" ", "-")}), cursive`,
                          }}
                        >
                          <div className="assignment-paper-meta">
                            <span>
                              {assignment.course || "UNIVERSITY NOTES"}
                            </span>
                            <span>
                              {String(index + 1).padStart(2, "0")} /{" "}
                              {String(assignment.pageCount).padStart(2, "0")}
                            </span>
                          </div>
                          <h3>{section.heading}</h3>
                          {section.markdown
                            .split("\n")
                            .filter(
                              (line) => line.trim() && !line.startsWith("#"),
                            )
                            .map((line, lineIndex) =>
                              line.startsWith("Diagram:") ? (
                                <div
                                  className="assignment-diagram"
                                  key={lineIndex}
                                >
                                  {line
                                    .replace(/^Diagram:\s*/i, "")
                                    .split("|")
                                    .map((step, stepIndex) => (
                                      <span key={stepIndex}>{step.trim()}</span>
                                    ))}
                                </div>
                              ) : line.startsWith("Illustration:") ? (
                                <div className="assignment-map" key={lineIndex}>
                                  {line
                                    .replace(/^Illustration:\s*/i, "")
                                    .split("|")
                                    .map((step, stepIndex) => (
                                      <span key={stepIndex}>{step.trim()}</span>
                                    ))}
                                </div>
                              ) : line.startsWith("-") ? (
                                <p
                                  className="assignment-paper-bullet"
                                  key={lineIndex}
                                >
                                  {line.slice(1).trim()}
                                </p>
                              ) : line.startsWith("|") ? (
                                <p
                                  className="assignment-paper-table"
                                  key={lineIndex}
                                >
                                  {line
                                    .replaceAll("|", "  ·  ")
                                    .replaceAll("---", "")}
                                </p>
                              ) : (
                                <p key={lineIndex}>
                                  {line.replace(/\*\*/g, "")}
                                </p>
                              ),
                            )}
                        </article>
                      ))}
                    </div>
                    {assignment.sources.length > 0 && (
                      <section className="assignment-reference-list">
                        <h3>Research trail</h3>
                        <p>
                          Metadata verified from Crossref or OpenAlex. Open each
                          DOI and check the original source.
                        </p>
                        {assignment.sources.map((source, index) => (
                          <a
                            key={source.doi}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span>R{index + 1}</span>
                            <b>{source.title}</b>
                            <small>
                              {sourceName(source)} ·{" "}
                              {source.indexedBy.join(" + ")}
                            </small>
                          </a>
                        ))}
                      </section>
                    )}
                    <button
                      className="assignment-ai-float"
                      onClick={() => setAssistantOpen((open) => !open)}
                    >
                      <span>
                        <MessageCircle size={17} />
                      </span>
                      <b>Ask Assignment AI</b>
                      <small>{assignment.revisionCount}/10 edits</small>
                    </button>
                    {assistantOpen && (
                      <form
                        className="assignment-revision assignment-chat-drawer"
                        onSubmit={reviseSection}
                      >
                        <div className="assignment-section-heading">
                          <div>
                            <span className="assignment-number">
                              <MessageCircle size={16} />
                            </span>
                            <div>
                              <h3>Ask Assignment AI</h3>
                              <p>Revise a numbered page. Edits are included.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="assignment-chat-close"
                            onClick={() => setAssistantOpen(false)}
                            aria-label="Close Assignment AI"
                          >
                            <X size={17} />
                          </button>
                        </div>
                        <label>
                          Page to revise
                          <select
                            value={revisionSection}
                            onChange={(event) =>
                              setRevisionSection(Number(event.target.value))
                            }
                          >
                            {assignment.sections.map((section, index) => (
                              <option key={index} value={index}>
                                {index + 1}. {section.heading}
                              </option>
                            ))}
                          </select>
                        </label>
                        <textarea
                          value={revision}
                          onChange={(event) => setRevision(event.target.value)}
                          maxLength={900}
                          minLength={8}
                          placeholder="For example: add a balanced comparison table and explain the limitations…"
                          required
                        />
                        <button
                          className="assignment-primary"
                          disabled={busy || !revision.trim()}
                        >
                          {busy ? (
                            <LoaderCircle className="is-spinning" size={16} />
                          ) : (
                            <WandSparkles size={16} />
                          )}{" "}
                          Revise this page
                        </button>
                      </form>
                    )}
                    <div className="assignment-export-row">
                      <div>
                        <strong>Take your draft with you</strong>
                        <span>
                          A4 ·{" "}
                          {assignment.paper === "ruled" ? "Ruled" : "Plain"} ·
                          PDF embeds the font; Word uses it when installed.
                        </span>
                      </div>
                      <button
                        className="assignment-secondary"
                        disabled={!!downloadBusy}
                        onClick={() => void download("pdf")}
                      >
                        {downloadBusy === "pdf" ? (
                          <LoaderCircle className="is-spinning" size={16} />
                        ) : (
                          <ArrowDownToLine size={16} />
                        )}{" "}
                        PDF
                      </button>
                      <button
                        className="assignment-secondary"
                        disabled={!!downloadBusy}
                        onClick={() => void download("docx")}
                      >
                        {downloadBusy === "docx" ? (
                          <LoaderCircle className="is-spinning" size={16} />
                        ) : (
                          <FileText size={16} />
                        )}{" "}
                        DOCX
                      </button>
                    </div>
                  </>
                )}
                {assignment.status === "error" && (
                  <div className="assignment-error-card">
                    <strong>We couldn’t finish this draft.</strong>
                    <p>
                      {assignment.error} Any charged credits are returned
                      automatically.
                    </p>
                    <button
                      className="assignment-secondary"
                      onClick={newAssignment}
                    >
                      Start a fresh assignment
                    </button>
                  </div>
                )}
              </>
            ) : (
              <form className="assignment-form" onSubmit={createAssignment}>
                <div className="assignment-section-heading">
                  <div>
                    <span className="assignment-number">01</span>
                    <div>
                      <h2>Tell us what the brief asks for.</h2>
                      <p>
                        Start with your own prompt, rubric, or instructor notes.
                      </p>
                    </div>
                  </div>
                  <span>A4 · UG + PG</span>
                </div>
                <div className="assignment-form-grid">
                  <label className="assignment-field assignment-field-wide">
                    Assignment title
                    <input
                      value={form.title}
                      onChange={(e) => update("title", e.target.value)}
                      maxLength={160}
                      placeholder="e.g. Privacy risks in large language models"
                      required
                      minLength={4}
                    />
                  </label>
                  <label className="assignment-field">
                    Course or department
                    <input
                      value={form.course}
                      onChange={(e) => update("course", e.target.value)}
                      maxLength={140}
                      placeholder="e.g. MSc Computer Science"
                    />
                  </label>
                  <label className="assignment-field">
                    Assignment format
                    <select
                      value={form.format}
                      onChange={(e) => update("format", e.target.value)}
                    >
                      {ASSIGNMENT_FORMATS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                    <ChevronDown className="assignment-select-icon" size={15} />
                  </label>
                  <label className="assignment-field assignment-field-wide">
                    Topic or research question
                    <textarea
                      value={form.topic}
                      onChange={(e) => update("topic", e.target.value)}
                      maxLength={800}
                      placeholder="What question should this assignment answer?"
                      required
                      minLength={4}
                    />
                  </label>
                  <label className="assignment-field assignment-field-wide">
                    Instructions and rubric
                    <textarea
                      value={form.instructions}
                      onChange={(e) => update("instructions", e.target.value)}
                      maxLength={7000}
                      required
                      minLength={20}
                      placeholder="Paste the task requirements, learning outcomes, marking criteria, and any required sections."
                    />
                  </label>
                </div>

                <section className="assignment-research-box">
                  <div className="assignment-section-heading">
                    <div>
                      <span className="assignment-number">
                        <Search size={16} />
                      </span>
                      <div>
                        <h3>Find research references</h3>
                        <p>
                          Search scholarly records and choose sources you have
                          checked.
                        </p>
                      </div>
                    </div>
                    <span>Optional</span>
                  </div>
                  <div className="assignment-research-search">
                    <input
                      value={sourceQuery}
                      onChange={(e) => setSourceQuery(e.target.value)}
                      maxLength={180}
                      placeholder={
                        form.topic ||
                        "Search article titles or a research topic"
                      }
                    />
                    <button
                      type="button"
                      className="assignment-secondary"
                      disabled={sourceBusy}
                      onClick={() => void findSources()}
                    >
                      {sourceBusy ? (
                        <LoaderCircle className="is-spinning" size={16} />
                      ) : (
                        <Search size={16} />
                      )}{" "}
                      Find sources
                    </button>
                  </div>
                  <p className="assignment-source-note">
                    Searches Crossref and OpenAlex metadata. It does not fetch
                    paywalled full text. Check every result before citing it.
                  </p>
                  {sources.length > 0 && (
                    <div className="assignment-source-results">
                      {sources.map((source, index) => (
                        <label
                          key={source.doi}
                          className={
                            selectedDois.includes(source.doi)
                              ? "is-selected"
                              : ""
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selectedDois.includes(source.doi)}
                            onChange={(e) =>
                              setSelectedDois((old) =>
                                e.target.checked
                                  ? [...old, source.doi].slice(0, 8)
                                  : old.filter((doi) => doi !== source.doi),
                              )
                            }
                          />
                          <span className="assignment-source-index">
                            R{index + 1}
                          </span>
                          <span>
                            <b>{source.title}</b>
                            <small>
                              {sourceName(source)} ·{" "}
                              {source.venue || source.indexedBy.join(" + ")}
                            </small>
                          </span>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Open DOI for ${source.title}`}
                          >
                            DOI ↗
                          </a>
                        </label>
                      ))}
                    </div>
                  )}
                </section>

                <div className="assignment-section-heading assignment-output-heading">
                  <div>
                    <span className="assignment-number">
                      <NotebookPen size={16} />
                    </span>
                    <div>
                      <h3>Set the page and citation style</h3>
                      <p>
                        Use a target number of content pages. A references
                        appendix may add pages.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="assignment-options">
                  <label>
                    Content pages
                    <div className="assignment-page-input">
                      <input
                        type="number"
                        min={1}
                        max={MAX_ASSIGNMENT_PAGES}
                        value={form.pageCount}
                        onChange={(e) =>
                          update(
                            "pageCount",
                            Math.max(
                              1,
                              Math.min(
                                MAX_ASSIGNMENT_PAGES,
                                Number(e.target.value) || 1,
                              ),
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => void suggestPages()}
                        disabled={
                          suggestBusy ||
                          form.title.length < 4 ||
                          form.topic.length < 4 ||
                          form.instructions.length < 20
                        }
                      >
                        {suggestBusy ? (
                          <LoaderCircle className="is-spinning" size={14} />
                        ) : (
                          <Sparkles size={14} />
                        )}{" "}
                        Suggest
                      </button>
                    </div>
                    <small>
                      {wordEstimate.toLocaleString()} words · approx.
                    </small>
                  </label>
                  <label>
                    A4 paper
                    <select
                      value={form.paper}
                      onChange={(e) => update("paper", e.target.value)}
                    >
                      <option value="ruled">Ruled notebook</option>
                      <option value="plain">Plain sheet</option>
                    </select>
                  </label>
                  <label>
                    Handwriting style
                    <select
                      value={form.font}
                      onChange={(e) => update("font", e.target.value)}
                    >
                      <option>Kalam</option>
                      <option>Caveat</option>
                      <option>Patrick Hand</option>
                    </select>
                  </label>
                  <label>
                    Citation style
                    <select
                      value={form.citationStyle}
                      onChange={(e) => update("citationStyle", e.target.value)}
                    >
                      <option>APA 7</option>
                      <option>IEEE</option>
                      <option>MLA 9</option>
                      <option>Harvard</option>
                    </select>
                  </label>
                </div>
                <div className="assignment-integrity-note">
                  <BookOpen size={17} />
                  <p>
                    This creates an AI-assisted study draft. Review the
                    evidence, add your own analysis, and follow your
                    university’s AI-use policy.
                  </p>
                </div>
                <div className="assignment-submit">
                  <span>
                    <b>{ASSIGNMENT_CREDITS} credits</b>
                    <small>
                      once per assignment · includes edits and downloads
                    </small>
                  </span>
                  <button
                    type="submit"
                    className="assignment-primary"
                    disabled={busy}
                  >
                    {busy ? (
                      <LoaderCircle className="is-spinning" size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}{" "}
                    Build assignment outline <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}
          </section>

          <aside className="assignment-aside">
            <div className="assignment-aside-card assignment-sample-card">
              <div className="assignment-aside-top">
                <span>THE PAGE FEEL</span>
                <span>
                  <NotebookPen size={16} />
                </span>
              </div>
              <article
                className="assignment-mini-paper"
                data-paper={form.paper}
              >
                <small>COURSE NOTES · PAGE 01</small>
                <h3>
                  {assignment?.sections[0]?.heading ||
                    form.title ||
                    "A page with a point of view"}
                </h3>
                <p>
                  {assignment?.sections[0]?.markdown
                    .replace(/^#+.*$/gm, "")
                    .trim()
                    .slice(0, 205) ||
                    "Clear section headings, readable handwritten type, source markers, and space for ideas to breathe."}
                </p>
                <div className="assignment-mini-diagram">
                  <span>Question</span>
                  <i />
                  <span>Evidence</span>
                  <i />
                  <span>Finding</span>
                </div>
                <small className="assignment-mini-footer">
                  AI-assisted study draft · check before use
                </small>
              </article>
              <div
                className="assignment-style-tabs"
                aria-label="Paper preview style"
              >
                <button
                  type="button"
                  aria-pressed={form.paper === "ruled"}
                  onClick={() => update("paper", "ruled")}
                >
                  Ruled
                </button>
                <button
                  type="button"
                  aria-pressed={form.paper === "plain"}
                  onClick={() => update("paper", "plain")}
                >
                  Plain
                </button>
              </div>
            </div>
            <div className="assignment-aside-card assignment-format-card">
              <p className="assignment-kicker">FORMAT THAT FITS THE TASK</p>
              <h3>Start from a real academic structure.</h3>
              <div className="assignment-format-list">
                <span>
                  <i>01</i> Essay <small>Thesis · argument · synthesis</small>
                </span>
                <span>
                  <i>02</i> Case study{" "}
                  <small>Context · findings · recommendation</small>
                </span>
                <span>
                  <i>03</i> Lab report{" "}
                  <small>Method · results · limitations</small>
                </span>
                <span>
                  <i>04</i> Literature review{" "}
                  <small>Themes · debate · research gaps</small>
                </span>
              </div>
              <a
                href="https://learninglab.rmit.edu.au/assessments/getting-started-with-assignments/understanding-your-assignment/"
                target="_blank"
                rel="noreferrer"
              >
                Assignment structure guide <ArrowRight size={14} />
              </a>
            </div>
            <div className="assignment-aside-card assignment-history">
              <div className="assignment-aside-top">
                <span>YOUR RECENT DRAFTS</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  aria-label="Refresh assignments"
                >
                  <LoaderCircle size={15} />
                </button>
              </div>
              {assignments.length ? (
                assignments.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    className={assignment?.id === item.id ? "is-current" : ""}
                    onClick={() => void openAssignment(item.id)}
                  >
                    <span className="assignment-history-icon">
                      <FileText size={15} />
                    </span>
                    <span>
                      <b>{item.title}</b>
                      <small>
                        {phaseLabel(item)} · {item.format}
                      </small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))
              ) : (
                <p>Your saved assignment drafts will appear here.</p>
              )}
              {assignment && (
                <button
                  className="assignment-history-new"
                  onClick={newAssignment}
                >
                  <Plus size={14} /> Start a new assignment
                </button>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
