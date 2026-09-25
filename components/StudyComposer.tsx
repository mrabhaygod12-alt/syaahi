"use client";
import { tokenLabel } from "@/lib/billing/packs";
import { useEffect, useRef, useState } from "react";
import LectureRecorder from "./LectureRecorder";
import { useRouter } from "next/navigation";
interface Plan {
  topics: string[];
  context: string;
  sources: Array<{ title: string; url: string }>;
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
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialTopic),
    [context, setContext] = useState(""),
    [source, setSource] = useState("");
  const [pages, setPages] = useState(0),
    [language, setLanguage] = useState("english"),
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
  async function prepare(pageOverride?: number) {
    const targetPages = typeof pageOverride === "number" ? pageOverride : pages;
    setBusy("Finding sources and planning...");
    setError("");
    setTimeout(() => {
      scrollToTarget(statusRef);
    }, 60);
    try {
      let material =
        context || (text.length > 500 ? text.slice(0, 100000) : "");
      if (
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
              : text,
          context: material,
          pages: targetPages || "auto",
          research,
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
          context: plan.context,
          sourceName: source || text.slice(0, 120),
          sourceUrl,
          sourceKind: sourceUrl ? "youtube" : source ? "upload" : "topic",
          style: detail,
          language,
          research: false,
          intelligentPlan: false,
          confirmedPlan: true,
          planNote: plan.reason,
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
        <label>
          Language
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="english">English</option>
            <option value="hindi">हिंदी</option>
            <option value="hinglish">Hinglish</option>
          </select>
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
              setSource("");
              setContext("");
              setPlan(null);
            }}
          >
            ×
          </button>
        </div>
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
            {plan.evidence === "retrieved"
              ? "Sources found"
              : plan.evidence === "supplied"
                ? "Grounded in your material"
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
