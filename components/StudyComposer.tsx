"use client";
import { tokenLabel } from "@/lib/billing/packs";
import { useEffect, useRef, useState } from "react";
import LectureRecorder from "./LectureRecorder";
import { useRouter } from "next/navigation";
import { COURSE_PACKS } from "@/lib/course-packs";
interface Plan {
  topics: string[];
  context: string;
  sources: Array<{ title: string; url: string }>;
  readingLinks: Array<{
    title: string;
    url: string;
    kind: "source" | "search";
  }>;
  evidence: string;
  reason: string;
  note: string;
}
export default function StudyComposer({
  initialTopic = "",
  onCreated,
}: {
  initialTopic?: string;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [document, setDocument] = useState<{
    id: string;
    name: string;
    pageCount: number;
  } | null>(null);
  const [documentRange, setDocumentRange] = useState({ from: 1, to: 1 });
  const [savedDocuments, setSavedDocuments] = useState<
    Array<{ id: string; name: string; pageCount: number }>
  >([]);
  async function loadDocuments() {
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not load textbooks.");
      setSavedDocuments(data.documents);
    } catch {
      setError(
        "Could not load saved textbooks. Open this section again to retry.",
      );
    }
  }
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialTopic),
    [context, setContext] = useState(""),
    [source, setSource] = useState("");
  const [learningGoal, setLearningGoal] = useState("Understand the basics");
  const [sourceNotice, setSourceNotice] = useState("");
  const [pages, setPages] = useState(0),
    [language, setLanguage] = useState(() => {
      if (typeof window === "undefined") return "english";
      const saved = localStorage.getItem("syaahi-note-language");
      if (
        [
          "english",
          "hindi",
          "hinglish",
          "german",
          "french",
          "spanish",
        ].includes(saved || "")
      )
        return saved!;
      const browserLanguage = navigator.language.toLowerCase();
      if (browserLanguage.startsWith("hi")) return "hindi";
      if (browserLanguage.startsWith("de")) return "german";
      if (browserLanguage.startsWith("fr")) return "french";
      if (browserLanguage.startsWith("es")) return "spanish";
      return "english";
    }),
    [detail, setDetail] = useState("detailed");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [plan, setPlan] = useState<Plan | null>(null),
    [outline, setOutline] = useState("");
  const [research, setResearch] = useState(true),
    [sourceUrl, setSourceUrl] = useState("");
  const planSectionRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initialTopic) setText(initialTopic);
  }, [initialTopic]);
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get(
      "coursePack",
    );
    const pack = COURSE_PACKS.find((item) => item.slug === selected);
    if (!pack) return;
    setText(`${pack.institution} · ${pack.programme}: ${pack.title}`);
    setContext(
      pack.topics
        .map((topic, index) => `Unit ${index + 1}: ${topic}`)
        .join("\n"),
    );
    setSource(`${pack.institution} course-pack starter`);
    setPlan(null);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("syaahi-note-language", language);
    } catch {
      /* Browser storage can be unavailable in private contexts. */
    }
    // A missing session is harmless here: signed-in users get a durable
    // preference and guests still retain the browser choice for this device.
    fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: language }),
    }).catch(() => {});
  }, [language]);

  const scrollToTarget = (ref: React.RefObject<HTMLElement | null>) => {
    if (!ref.current) return;
    const y = ref.current.getBoundingClientRect().top + window.pageYOffset - 36;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  };

  useEffect(() => {
    if (plan && planSectionRef.current) {
      const timer = setTimeout(() => {
        scrollToTarget(planSectionRef);
      }, 100);
      return () => clearTimeout(timer);
    } else if (busy && statusRef.current) {
      const timer = setTimeout(() => {
        scrollToTarget(statusRef);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [plan, busy]);
  async function upload(file: File) {
    setDocument(null);
    setBusy("Reading your material...");
    setError("");
    setPlan(null);
    try {
      const endpoint = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("audio/") ||
            /\.(mp3|m4a|wav|webm)$/i.test(file.name)
          ? "transcribe"
          : "syllabus";
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/${endpoint}`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not read this file.");
      setContext(data.text || data.context || data.transcript || "");
      setSource(file.name);
      setSourceUrl("");
      if (!text.trim())
        setText(`Help me understand ${file.name.replace(/\.[^.]+$/, "")}`);
      if (data.warning) setError(data.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy("");
    }
  }
  async function uploadTextbook(file: File) {
    setBusy("Indexing textbook pages…");
    setError("");
    setPlan(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Textbook could not be indexed.");
      setDocument(data);
      setDocumentRange({ from: 1, to: data.pageCount });
      setSavedDocuments((items) => [
        data,
        ...items.filter((item) => item.id !== data.id),
      ]);
      setContext("");
      setSource(data.name);
      setSourceUrl("");
      setSourceNotice(
        "Enter a chapter topic and select its physical PDF page range. Notes will cite matching passages.",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy("");
    }
  }
  async function prepare(pageOverride?: number) {
    const targetPages = typeof pageOverride === "number" ? pageOverride : pages;
    setBusy("Finding sources and planning...");
    setError("");
    setTimeout(() => {
      scrollToTarget(statusRef);
    }, 60);
    try {
      let studyTitle = text;
      let selectedDocument = document;
      let material =
        context || (text.length > 500 ? text.slice(0, 100000) : "");
      if (
        sourceUrl !== text.trim() &&
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(text.trim())
      ) {
        const response = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: text.trim() }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not read this lecture.");
        material = data.transcript;
        selectedDocument = null;
        setDocument(null);
        studyTitle = data.title || "Study the supplied video";
        setSourceNotice(data.warning || data.assessment?.reason || "");
        setContext(material);
        setSource(data.title || "YouTube lecture");
        setSourceUrl(text.trim());
      }
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic:
            text.length > 500
              ? "Create a study guide from the supplied notes"
              : studyTitle,
          context: material,
          pages: targetPages || "auto",
          learningGoal,
          research,
          documentId: selectedDocument?.id,
          documentRange,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Planning failed.");
      setPlan(data);
      setOutline(data.topics.join("\n"));
      setTimeout(() => {
        scrollToTarget(planSectionRef);
      }, 120);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy("");
    }
  }
  async function generate() {
    if (!plan) return;
    setBusy("Starting your study workspace...");
    setError("");
    const topics = outline
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 24);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics,
          documentId: document?.id,
          documentRange,
          context: plan.context,
          sourceName: source || text.slice(0, 120),
          sourceUrl,
          sourceKind: sourceUrl ? "youtube" : source ? "upload" : "topic",
          style: detail,
          brief: `Learning goal: ${learningGoal}`,
          language,
          research: false,
          intelligentPlan: false,
          confirmedPlan: true,
          planNote: plan.reason,
          references: plan.sources.map(({ title, url }) => ({ title, url })),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Generation could not start.");
      onCreated?.();
      router.push(`/lesson/${data.jobId}/notes`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="composer-area">
      <div className="study-composer">
        <label className="sr-only" htmlFor="study-request">
          What would you like to understand?
        </label>
        <textarea
          id="study-request"
          rows={3}
          maxLength={100000}
          placeholder="Ask about a topic, paste your notes, or add a YouTube lecture..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPlan(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && text.trim()) {
              if (
                !text.includes("\n") ||
                /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(
                  text.trim(),
                )
              ) {
                e.preventDefault();
                if (!busy) void prepare();
              }
            }
          }}
        />
        <div className="composer-actions">
          <div className="attachment-actions">
            <button
              onClick={() => input.current?.click()}
              disabled={!!busy}
              className="attach-btn"
            >
              <span aria-hidden>＋</span> Add material
            </button>
            <LectureRecorder
              onFile={(file) => void upload(file)}
              disabled={!!busy}
            />
            <span className="attachment-help">Documents, images, audio</span>
            <input
              ref={input}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.webm"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) void upload(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          <button
            className="send-btn"
            aria-label="Plan my notes"
            disabled={!!busy || !text.trim()}
            onClick={() => void prepare()}
          >
            ↗
          </button>
        </div>
      </div>
      <fieldset className="study-goal-cards">
        <legend>What would help you most?</legend>
        {[
          "Understand the basics",
          "Prepare for an exam",
          "Apply it to a problem",
        ].map((g) => (
          <button
            type="button"
            key={g}
            aria-pressed={learningGoal === g}
            onClick={() => {
              setLearningGoal(g);
              setPlan(null);
            }}
          >
            {g}
          </button>
        ))}
      </fieldset>
      <details
        className="source-review"
        onToggle={(event) => {
          if (event.currentTarget.open) void loadDocuments();
        }}
      >
        <summary>Study a textbook chapter with page citations</summary>
        <p className="small">
          Upload a text PDF up to 10 MB, 500 pages, and 3 million extracted
          characters. Scanned books need OCR first. Extracted pages are stored
          privately for retrieval.
        </p>
        <input
          type="file"
          accept=".pdf"
          aria-label="Upload textbook PDF"
          disabled={!!busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadTextbook(file);
            e.target.value = "";
          }}
        />
        <label>
          Saved textbook
          <select
            disabled={!!busy}
            value={document?.id || ""}
            onChange={(event) => {
              const selected =
                savedDocuments.find((item) => item.id === event.target.value) ||
                null;
              setDocument(selected);
              setDocumentRange({ from: 1, to: selected?.pageCount || 1 });
              setPlan(null);
              setContext("");
              setSource(selected?.name || "");
              setSourceUrl("");
            }}
          >
            <option value="">Select a private textbook</option>
            {savedDocuments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.pageCount} pages)
              </option>
            ))}
          </select>
        </label>
        {document && (
          <div>
            <p>
              {document.name} · {document.pageCount} pages
            </p>
            <label>
              First PDF page{" "}
              <input
                type="number"
                min={1}
                max={document.pageCount}
                value={documentRange.from}
                onChange={(e) => {
                  setDocumentRange((r) => ({
                    ...r,
                    from: Number(e.target.value),
                  }));
                  setPlan(null);
                }}
              />
            </label>
            <label>
              Last PDF page{" "}
              <input
                type="number"
                min={documentRange.from}
                max={document.pageCount}
                value={documentRange.to}
                onChange={(e) => {
                  setDocumentRange((r) => ({
                    ...r,
                    to: Number(e.target.value),
                  }));
                  setPlan(null);
                }}
              />
            </label>
            <button
              className="btn light"
              disabled={!!busy}
              onClick={async () => {
                setBusy("Deleting textbook…");
                try {
                  const response = await fetch(
                    `/api/documents/${document.id}`,
                    { method: "DELETE" },
                  );
                  if (response.ok) {
                    setSavedDocuments((items) =>
                      items.filter((item) => item.id !== document.id),
                    );
                    setDocument(null);
                    setSource("");
                    setPlan(null);
                    setSourceNotice("");
                  } else
                    setError("Could not delete this textbook. Please retry.");
                } catch {
                  setError(
                    "Could not reach the service. Please retry deleting this textbook.",
                  );
                } finally {
                  setBusy("");
                }
              }}
            >
              Delete stored textbook
            </button>
          </div>
        )}
      </details>
      <details className="source-review course-pack-picker">
        <summary>Start from a university course-pack outline</summary>
        <p className="small">
          These starters are not official syllabi. Confirm the current
          university outline before generating.
        </p>
        <div className="course-pack-options">
          {COURSE_PACKS.map((pack) => (
            <button
              key={pack.slug}
              type="button"
              onClick={() => {
                setText(
                  `${pack.institution} · ${pack.programme}: ${pack.title}`,
                );
                setContext(
                  pack.topics
                    .map((topic, index) => `Unit ${index + 1}: ${topic}`)
                    .join("\n"),
                );
                setSource(`${pack.institution} course-pack starter`);
                setSourceUrl("");
                setDocument(null);
                setPlan(null);
              }}
            >
              <b>{pack.title}</b>
              <br />
              <span>
                {pack.institution} · {pack.term}
              </span>
            </button>
          ))}
        </div>
        <a className="small" href="/course-packs">
          Browse all course-pack starters →
        </a>
      </details>
      <div className="composer-options">
        <label>
          Target pages
          <select
            value={pages}
            onChange={(e) => {
              const val = Number(e.target.value);
              setPages(val);
              if (text.trim()) {
                void prepare(val);
              } else {
                setPlan(null);
              }
            }}
          >
            <option value={0}>Auto · match my topic</option>
            {[1, 2, 3, 5, 8, 12, 16, 24].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "page" : "pages"}
              </option>
            ))}
          </select>
        </label>
        <label className="generation-language-control">
          Note language
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="english">English</option>
            <option value="hindi">हिंदी</option>
            <option value="hinglish">Hinglish</option>
            <option value="german">Deutsch</option>
            <option value="french">Français</option>
            <option value="spanish">Español</option>
          </select>
          <small>Applies to this lesson and future note creation.</small>
        </label>
        <label>
          Depth
          <select value={detail} onChange={(e) => setDetail(e.target.value)}>
            <option value="detailed">Explain & apply</option>
            <option value="concise">Quick revision</option>
          </select>
        </label>
        <label className="research-toggle">
          <input
            type="checkbox"
            checked={research}
            onChange={(e) => {
              setResearch(e.target.checked);
              setPlan(null);
            }}
          />{" "}
          Find sources
        </label>
      </div>
      {source && (
        <div className="source-chip">
          ▤ {source}
          <button
            aria-label="Remove attachment"
            onClick={() => {
              setSourceNotice("");
              setDocument(null);
              setSourceUrl("");
              setSource("");
              setContext("");
              setPlan(null);
            }}
          >
            ×
          </button>
        </div>
      )}
      {sourceNotice && (
        <p className="source-notice" role="status">
          {sourceNotice}
        </p>
      )}
      {context && (
        <details className="source-review">
          <summary>Review extracted text before generation</summary>
          <textarea
            aria-label="Extracted source text"
            rows={8}
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              setPlan(null);
            }}
          />
        </details>
      )}
      {busy && (
        <div ref={statusRef} role="status" className="composer-status">
          <span className="status-dot" />
          {busy}
        </div>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {plan && (
        <section ref={planSectionRef} className="plan-review">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR STUDY PLAN</span>
              <h3>A little structure. A clearer mind.</h3>
            </div>
            <span className="badge">
              {tokenLabel(outline.split("\n").filter((t) => t.trim()).length)}
            </span>
          </div>
          <p>{plan.reason}</p>
          <textarea
            aria-label="Edit your note pages, one per line"
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            rows={Math.min(8, plan.topics.length + 1)}
          />
          <div className="evidence-label">
            {plan.evidence === "mixed"
              ? "Web references plus your supplied material"
              : plan.evidence === "retrieved"
                ? "Wikipedia references retrieved"
                : plan.evidence === "supplied"
                  ? "Grounded in your supplied material"
                  : "General knowledge · no external sources retrieved"}
          </div>
          {plan.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="source-link"
            >
              {s.title} ↗
            </a>
          ))}
          {plan.readingLinks.length > 0 && (
            <div className="reading-links">
              <span className="small">More technical reading</span>
              {plan.readingLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  {link.title} ↗
                </a>
              ))}
              <span className="small">
                GeeksforGeeks and W3Schools links open an external search. Their
                article text is not fetched or used to generate these notes.
              </span>
            </div>
          )}
          <p className="small">
            {plan.note} 1 token covers 3 pages. Each page uses ⅓ token;
            continuation sheets are free. Check the outline before starting.
          </p>
          <button
            className="btn dark"
            disabled={!!busy || !outline.trim()}
            onClick={generate}
          >
            Create my study workspace <span>→</span>
          </button>
        </section>
      )}
    </div>
  );
}
