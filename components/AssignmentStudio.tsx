"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  LoaderCircle,
  Maximize2,
  Minimize2,
  MessageCircle,
  NotebookPen,
  Plus,
  Paperclip,
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

type SetupScreen = "prompt" | "details" | "research";

const promptExamples = [
  "Compare digital evidence acquisition methods and explain when each is appropriate.",
  "Analyse how chain of custody affects the reliability of digital evidence.",
  "Review emerging cloud-forensics challenges using recent scholarly sources.",
];

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
  const [screen, setScreen] = useState<SetupScreen>("prompt");
  const [prompt, setPrompt] = useState("");
  const [briefText, setBriefText] = useState("");
  const [briefName, setBriefName] = useState("");
  const [briefBusy, setBriefBusy] = useState(false);
  const briefInput = useRef<HTMLInputElement>(null);
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
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

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

  function continueFromPrompt() {
    const cleanedPrompt = prompt.trim();
    if (cleanedPrompt.length < 20 && !briefText.trim()) {
      setError(
        "Add a short assignment prompt, or attach a text-based PDF or DOCX brief.",
      );
      return;
    }
    const focus =
      cleanedPrompt ||
      "Use the uploaded assignment brief as the source of instructions.";
    const firstLine =
      (briefText || focus)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 8) || focus;
    const title = firstLine
      .replace(/^#+\s*/, "")
      .slice(0, 116)
      .trim();
    const briefForModel = [
      `Student's request: ${focus}`,
      briefText
        ? `Uploaded assignment brief:\n${briefText.slice(0, 6500)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    setForm((old) => ({
      ...old,
      title: old.title || title,
      topic: old.topic || cleanedPrompt.slice(0, 800) || title,
      instructions: old.instructions || briefForModel.slice(0, 7000),
    }));
    setScreen("details");
    setError("");
    setNotice(
      briefName
        ? `${briefName} is ready. Review the extracted brief before continuing.`
        : "Your prompt is ready. Add course or rubric details if you have them.",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueToResearch() {
    if (form.title.trim().length < 4) {
      setError("Add an assignment title with at least four characters.");
      return;
    }
    if (form.topic.trim().length < 4) {
      setError("Add a topic or research question before continuing.");
      return;
    }
    if (form.instructions.trim().length < 20) {
      setError(
        "Add the task instructions or rubric so the outline can follow them.",
      );
      return;
    }
    setError("");
    setScreen("research");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadBrief(file?: File) {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Assignment brief upload supports PDF or DOCX files.");
      return;
    }
    const data = new FormData();
    data.append("file", file);
    setBriefBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/assignments/brief", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: data,
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(
          `/login?next=${encodeURIComponent("/assignment")}`,
        );
        return;
      }
      if (!response.ok)
        throw new Error(result.error || "Could not read this document.");
      setBriefText(result.text || "");
      setBriefName(result.fileName || file.name);
      setForm((old) => ({
        ...old,
        title:
          old.title ||
          String(result.text || file.name)
            .split(/\r?\n/)
            .map((line: string) => line.trim())
            .find((line: string) => line.length > 8)
            ?.slice(0, 116) ||
          "Assignment brief",
        topic: old.topic || prompt.trim().slice(0, 800),
        instructions: String(result.text || "").slice(0, 6500),
      }));
      setNotice(
        `${result.pageCount ? `Read ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}.` : "Extracted the document text."} The file is only used to prepare this brief and is not stored.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not read this document.",
      );
    } finally {
      setBriefBusy(false);
      if (briefInput.current) briefInput.current.value = "";
    }
  }

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
    setScreen("prompt");
    setPrompt("");
    setBriefText("");
    setBriefName("");
    setOutline([]);
    setNotice("");
    setError("");
    setSources([]);
    setSelectedDois([]);
    setForm(initialForm);
    setAssistantOpen(false);
    setPreviewIndex(0);
    setPreviewFullscreen(false);
    window.history.replaceState({}, "", "/assignment");
  }

  const viewMode = assignment
    ? assignment.status === "ready"
      ? "preview"
      : assignment.status === "outline"
        ? "outline"
        : assignment.status === "queued" || assignment.status === "working"
          ? "building"
          : "error"
    : screen;
  const currentStep = assignment
    ? assignment.status === "ready" || assignment.phase === "draft"
      ? 3
      : assignment.status === "error"
        ? 2
        : 2
    : screen === "prompt"
      ? 0
      : screen === "details"
        ? 1
        : 2;

  return (
    <div className="assignment-studio" data-view={viewMode}>
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
      <main
        className={`assignment-main${previewFullscreen ? " is-preview-fullscreen" : ""}`}
      >
        <div className="assignment-heading assignment-screen-enter">
          <div>
            <p className="assignment-kicker">
              {viewMode === "prompt"
                ? "YOUR ASSIGNMENT, YOUR WAY"
                : viewMode === "details"
                  ? "STEP 02 · SHAPE THE BRIEF"
                  : viewMode === "research"
                    ? "STEP 03 · GATHER AND DESIGN"
                    : viewMode === "outline"
                      ? "SHAPE THE STRUCTURE"
                      : viewMode === "building"
                        ? "YOUR DRAFT IS TAKING SHAPE"
                        : viewMode === "preview"
                          ? "YOUR DRAFT, PAGE BY PAGE"
                          : viewMode === "error"
                            ? "PICK UP WHERE YOU LEFT OFF"
                            : "ASSIGNMENT STUDIO"}
            </p>
            <h1>
              {viewMode === "prompt"
                ? "What assignment are you working on?"
                : viewMode === "details"
                  ? "Let’s make the brief clear."
                  : viewMode === "research"
                    ? "Choose your research and page style."
                    : viewMode === "outline"
                      ? "Review the plan before drafting."
                      : viewMode === "building"
                        ? "Your assignment is taking shape."
                        : viewMode === "preview"
                          ? "Review every page before you export."
                          : viewMode === "error"
                            ? "Let’s recover your assignment draft."
                            : "Build an assignment with sources in view."}
            </h1>
            <p>
              {viewMode === "prompt"
                ? "Describe the task in your own words. Add the instructor brief if you have it; we’ll turn it into a plan you can review."
                : viewMode === "details"
                  ? "Check the topic, course, format, and requirements before research begins."
                  : viewMode === "research"
                    ? "Select sources you have checked, set the paper, then review the outline before drafting."
                    : viewMode === "outline"
                      ? "Change the section order or wording, then approve the outline to begin drafting."
                      : viewMode === "building"
                        ? "Your outline and pages are saved as they finish, so you can return to this draft at any time."
                        : viewMode === "preview"
                          ? "Move through the pages, check the research trail, and download the format you need."
                          : viewMode === "error"
                            ? "Review the message below and start a fresh draft if needed."
                            : "Your outline, research, and page-by-page draft stay together in one workspace."}
            </p>
          </div>
          <div className="assignment-process" aria-label="Assignment workflow">
            {["Prompt", "Brief", "Research", "Draft"].map((label, index) => (
              <span
                key={label}
                className={
                  index === currentStep
                    ? "is-active"
                    : index < currentStep
                      ? "is-done"
                      : ""
                }
              >
                <b>{String(index + 1).padStart(2, "0")}</b> {label}
              </span>
            ))}
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
                  <div className="assignment-build-screen assignment-screen-enter">
                    <div className="assignment-build-art" aria-hidden="true">
                      <span className="assignment-build-sheet assignment-build-sheet-back" />
                      <span className="assignment-build-sheet assignment-build-sheet-mid" />
                      <span className="assignment-build-sheet assignment-build-sheet-front">
                        <i />
                        <i />
                        <i />
                        <b>
                          <LoaderCircle className="is-spinning" size={20} />
                        </b>
                      </span>
                      <span className="assignment-build-orbit assignment-build-orbit-one" />
                      <span className="assignment-build-orbit assignment-build-orbit-two" />
                    </div>
                    <p className="assignment-kicker">A PAGE-BY-PAGE WORKFLOW</p>
                    <h2>{phaseLabel(assignment)}</h2>
                    <p className="assignment-build-description">
                      {assignment.phase === "outline"
                        ? "Reading the confirmed brief and preparing a structure for you to review."
                        : "Pages are saved as they finish. You can return to this draft if you leave the workspace."}
                    </p>
                    <div
                      className="assignment-build-track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        assignment.phase === "outline"
                          ? 12
                          : assignment.progress
                      }
                    >
                      <span
                        style={{
                          width: `${assignment.phase === "outline" ? 12 : Math.max(8, assignment.progress)}%`,
                        }}
                      />
                    </div>
                    <div className="assignment-build-count">
                      <strong>
                        {assignment.phase === "outline"
                          ? "Planning your outline"
                          : `Page ${Math.min(assignment.sections.length + 1, assignment.pageCount)} of ${assignment.pageCount}`}
                      </strong>
                      <span>
                        {assignment.phase === "outline"
                          ? "Research is attached after you review the outline."
                          : `${assignment.progress}% complete`}
                      </span>
                    </div>
                    <div className="assignment-build-steps">
                      {[
                        { label: "Brief confirmed", done: true },
                        {
                          label: "Outline",
                          done: assignment.phase === "draft",
                          active: assignment.phase === "outline",
                        },
                        {
                          label: "Handwritten-style pages",
                          done: false,
                          active: assignment.phase === "draft",
                        },
                        { label: "Review and export", done: false },
                      ].map((step, index) => (
                        <div
                          key={step.label}
                          className={
                            step.done
                              ? "is-done"
                              : step.active
                                ? "is-active"
                                : ""
                          }
                        >
                          <span>
                            {step.done ? (
                              <Check size={14} />
                            ) : (
                              String(index + 1).padStart(2, "0")
                            )}
                          </span>
                          <small>{step.label}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {assignment.status === "outline" && (
                  <div className="assignment-outline assignment-outline-screen assignment-screen-enter">
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
                    <div className="assignment-editor-toolbar">
                      <div>
                        <span className="assignment-kicker">PAGE PREVIEW</span>
                        <strong>
                          {String(previewIndex + 1).padStart(2, "0")} <i>/</i>{" "}
                          {String(assignment.sections.length).padStart(2, "0")}
                        </strong>
                      </div>
                      <div className="assignment-editor-toolbar-actions">
                        <button
                          type="button"
                          className="assignment-secondary"
                          onClick={() =>
                            setPreviewFullscreen((value) => !value)
                          }
                          aria-label={
                            previewFullscreen
                              ? "Exit full screen preview"
                              : "Enter full screen preview"
                          }
                          aria-pressed={previewFullscreen}
                        >
                          {previewFullscreen ? (
                            <Minimize2 size={15} />
                          ) : (
                            <Maximize2 size={15} />
                          )}
                          {previewFullscreen ? "Exit focus" : "Full screen"}
                        </button>
                        <button
                          type="button"
                          className="assignment-secondary"
                          onClick={() =>
                            setPreviewIndex((index) => Math.max(0, index - 1))
                          }
                          disabled={previewIndex === 0}
                          aria-label="Previous page"
                        >
                          <ArrowLeft size={15} /> Previous
                        </button>
                        <button
                          type="button"
                          className="assignment-secondary"
                          onClick={() =>
                            setPreviewIndex((index) =>
                              Math.min(
                                assignment.sections.length - 1,
                                index + 1,
                              ),
                            )
                          }
                          disabled={
                            previewIndex >= assignment.sections.length - 1
                          }
                          aria-label="Next page"
                        >
                          Next <ArrowRight size={15} />
                        </button>
                        <button
                          className="assignment-secondary"
                          disabled={!!downloadBusy}
                          onClick={() => void download("pdf")}
                        >
                          {downloadBusy === "pdf" ? (
                            <LoaderCircle className="is-spinning" size={15} />
                          ) : (
                            <ArrowDownToLine size={15} />
                          )}{" "}
                          PDF
                        </button>
                        <button
                          className="assignment-secondary"
                          disabled={!!downloadBusy}
                          onClick={() => void download("docx")}
                        >
                          {downloadBusy === "docx" ? (
                            <LoaderCircle className="is-spinning" size={15} />
                          ) : (
                            <FileText size={15} />
                          )}{" "}
                          DOCX
                        </button>
                      </div>
                    </div>
                    <div className="assignment-editor-grid">
                      <nav
                        className="assignment-page-rail"
                        aria-label="Assignment pages"
                      >
                        <div className="assignment-page-rail-title">
                          <span>YOUR PAGES</span>
                          <b>{assignment.sections.length}</b>
                        </div>
                        {assignment.sections.map((section, index) => (
                          <button
                            key={`${assignment.id}-page-${index}`}
                            type="button"
                            className={
                              index === previewIndex ? "is-current" : ""
                            }
                            onClick={() => setPreviewIndex(index)}
                            aria-current={
                              index === previewIndex ? "page" : undefined
                            }
                          >
                            <span className="assignment-page-thumb">
                              <i />
                              <i />
                              <i />
                              <b>{String(index + 1).padStart(2, "0")}</b>
                            </span>
                            <span>
                              <b>{section.heading}</b>
                              <small>Page {index + 1}</small>
                            </span>
                          </button>
                        ))}
                      </nav>
                      <div className="assignment-preview-column">
                        <div className="assignment-preview-label">
                          <span>
                            <NotebookPen size={15} /> FULL PAGE PREVIEW
                          </span>
                          <small>
                            A4 ·{" "}
                            {assignment.paper === "ruled" ? "Ruled" : "Plain"}
                          </small>
                        </div>
                        <div className="assignment-paper-stack">
                          {assignment.sections
                            .slice(previewIndex, previewIndex + 1)
                            .map((section) => (
                              <article
                                className="assignment-paper"
                                key={`${assignment.id}-${previewIndex}`}
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
                                    {String(previewIndex + 1).padStart(2, "0")}{" "}
                                    /{" "}
                                    {String(assignment.pageCount).padStart(
                                      2,
                                      "0",
                                    )}
                                  </span>
                                </div>
                                <h3>{section.heading}</h3>
                                {section.markdown
                                  .split("\n")
                                  .filter(
                                    (line) =>
                                      line.trim() && !line.startsWith("#"),
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
                                            <span key={stepIndex}>
                                              {step.trim()}
                                            </span>
                                          ))}
                                      </div>
                                    ) : line.startsWith("Illustration:") ? (
                                      <div
                                        className="assignment-map"
                                        key={lineIndex}
                                      >
                                        {line
                                          .replace(/^Illustration:\s*/i, "")
                                          .split("|")
                                          .map((step, stepIndex) => (
                                            <span key={stepIndex}>
                                              {step.trim()}
                                            </span>
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
                      </div>
                      <aside className="assignment-editor-inspector">
                        <div className="assignment-inspector-card">
                          <p className="assignment-kicker">DRAFT CHECK</p>
                          <h3>Read, question, revise.</h3>
                          <p>
                            Use the page list to move through your draft. Check
                            every claim and adapt the analysis to your course.
                          </p>
                          <button
                            type="button"
                            className="assignment-primary"
                            onClick={() => setAssistantOpen((open) => !open)}
                          >
                            <MessageCircle size={15} /> Ask about this page
                          </button>
                        </div>
                        {assignment.sources.length > 0 && (
                          <section className="assignment-reference-list">
                            <h3>Research trail</h3>
                            <p>
                              Metadata verified from Crossref or OpenAlex. Open
                              each DOI and check the original source.
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
                      </aside>
                    </div>
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
            ) : screen === "prompt" ? (
              <section className="assignment-prompt-screen assignment-screen-enter">
                <div className="assignment-compose-grid">
                  <div className="assignment-prompt-story">
                    <div className="assignment-prompt-mark" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <i>
                        <NotebookPen size={22} />
                      </i>
                    </div>
                    <p className="assignment-kicker">START WITH ONE PROMPT</p>
                    <h2>Tell the studio what you need to understand.</h2>
                    <p>
                      We’ll help shape the brief, find research records, and
                      prepare a reviewable page-by-page draft.
                    </p>
                    <div className="assignment-prompt-examples">
                      <span>Try a starting point</span>
                      {promptExamples.map((example, index) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setPrompt(example)}
                        >
                          <b>0{index + 1}</b>
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                  <form
                    className="assignment-prompt-composer"
                    onSubmit={(event) => {
                      event.preventDefault();
                      continueFromPrompt();
                    }}
                  >
                    <div className="assignment-composer-topline">
                      <span>
                        <Sparkles size={15} /> ASSIGNMENT PROMPT
                      </span>
                      <small>UG + PG</small>
                    </div>
                    <label
                      className="assignment-prompt-label"
                      htmlFor="assignment-prompt"
                    >
                      What did your instructor ask you to do?
                    </label>
                    <textarea
                      id="assignment-prompt"
                      aria-label="Assignment prompt"
                      value={prompt}
                      onChange={(event) =>
                        setPrompt(event.target.value.slice(0, 4000))
                      }
                      maxLength={4000}
                      placeholder="For example: Compare digital evidence acquisition methods, explain chain of custody, and assess how cyber law affects admissibility."
                      rows={7}
                    />
                    <div className="assignment-composer-footer">
                      <div className="assignment-brief-actions">
                        <input
                          ref={briefInput}
                          type="file"
                          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
                          hidden
                          aria-label="Upload assignment brief PDF"
                          onChange={(event) =>
                            void uploadBrief(event.target.files?.[0])
                          }
                        />
                        <button
                          type="button"
                          className="assignment-attach-button"
                          onClick={() => briefInput.current?.click()}
                          disabled={briefBusy}
                        >
                          {briefBusy ? (
                            <LoaderCircle className="is-spinning" size={15} />
                          ) : briefName ? (
                            <Check size={15} />
                          ) : (
                            <Paperclip size={15} />
                          )}
                          {briefBusy
                            ? "Reading PDF…"
                            : briefName || "Add brief PDF"}
                        </button>
                        <span>PDF or DOCX · up to 10 MB</span>
                      </div>
                      <span className="assignment-prompt-count">
                        {prompt.length.toLocaleString()} / 4,000
                      </span>
                    </div>
                    {briefName && (
                      <p className="assignment-private-file">
                        <Check size={14} /> {briefName} extracted for this
                        session; the file itself is not stored.
                      </p>
                    )}
                    <div className="assignment-prompt-submit">
                      <span>
                        <b>8 credits when you create the research plan</b>
                        <small>
                          Prompt and brief setup are free. Outline review,
                          edits, and exports are included.
                        </small>
                      </span>
                      <button
                        type="submit"
                        className="assignment-primary"
                        disabled={
                          briefBusy || (prompt.trim().length < 20 && !briefText)
                        }
                      >
                        Continue <ArrowRight size={16} />
                      </button>
                    </div>
                  </form>
                </div>
                <div className="assignment-prompt-footnote">
                  <BookOpen size={15} />
                  <span>
                    Your brief stays private. You’ll review the extracted
                    requirements before any draft is created.
                  </span>
                </div>
              </section>
            ) : (
              <form
                className="assignment-form assignment-screen-enter"
                onSubmit={createAssignment}
              >
                <div className="assignment-section-heading">
                  <div>
                    <span className="assignment-number">
                      0{screen === "details" ? "2" : "3"}
                    </span>
                    <div>
                      <h2>
                        {screen === "details"
                          ? "Review the assignment details."
                          : "Choose sources and page style."}
                      </h2>
                      <p>
                        {screen === "details"
                          ? "Correct anything the prompt or uploaded brief did not make clear."
                          : "Every setting is editable before the research plan is created."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="assignment-quiet-button"
                    onClick={() =>
                      setScreen(screen === "details" ? "prompt" : "details")
                    }
                  >
                    <ArrowLeft size={14} />{" "}
                    {screen === "details" ? "Prompt" : "Brief"}
                  </button>
                </div>
                {screen === "details" && (
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
                      <ChevronDown
                        className="assignment-select-icon"
                        size={15}
                      />
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
                )}
                {screen === "details" ? (
                  <>
                    {briefName && (
                      <div className="assignment-brief-review">
                        <div>
                          <span>
                            <Check size={15} />
                          </span>
                          <div>
                            <b>Brief extracted from {briefName}</b>
                            <small>
                              Review the extracted text and correct any mistakes
                              above.
                            </small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="assignment-quiet-button"
                          onClick={() =>
                            setForm((old) => ({
                              ...old,
                              instructions: briefText.slice(0, 7000),
                            }))
                          }
                        >
                          Restore extracted text
                        </button>
                      </div>
                    )}
                    <div className="assignment-integrity-note">
                      <BookOpen size={17} />
                      <p>
                        Your instructions stay attached to this assignment. The
                        outline will show how each section responds to them.
                      </p>
                    </div>
                    <div className="assignment-step-actions">
                      <span>
                        STEP 02 OF 04{" "}
                        <small>Prompt · details · research · draft</small>
                      </span>
                      <button
                        type="button"
                        className="assignment-primary"
                        onClick={continueToResearch}
                      >
                        Continue to research <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="assignment-research-brief">
                      <div>
                        <span className="assignment-number">
                          <Check size={15} />
                        </span>
                        <div>
                          <small>CONFIRMED BRIEF</small>
                          <strong>{form.title}</strong>
                          <p>{form.topic}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="assignment-quiet-button"
                        onClick={() => setScreen("details")}
                      >
                        <FileText size={14} /> Edit brief
                      </button>
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
                              Search scholarly records and choose sources you
                              have checked.
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
                        Searches Crossref and OpenAlex metadata. It does not
                        fetch paywalled full text. Check every result before
                        citing it.
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
                          onChange={(e) =>
                            update("citationStyle", e.target.value)
                          }
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
                        Create research plan <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                )}
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
