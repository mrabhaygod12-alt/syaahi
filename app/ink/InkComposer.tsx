"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  UploadCloud,
  FileText,
  ScanLine,
  Check,
  Plus,
  Link2,
  Quote,
  PenLine,
  ShieldCheck,
  LoaderCircle,
  FolderOpen,
} from "lucide-react";
import { requestJson } from "./client";
import { InkDialog, InkPaperArt } from "./InkUI";
import type { InkSummary } from "./types";
import { useInkSearch } from "./InkAccess";
interface DocumentOption {
  id: string;
  name: string;
}
export default function InkComposer() {
  const router = useRouter();
  const searchConfigured = useInkSearch();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [allowWeb, setAllowWeb] = useState(false);
  const [busy, setBusy] = useState<"import" | "scan" | null>(null);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  const [recent, setRecent] = useState<InkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestId = useRef("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const ready = text.trim().length >= 200 && text.length <= 120000 && !busy;
  useEffect(() => {
    let active = true;
    requestJson<{ reports: InkSummary[] }>("/api/ink")
      .then(({ data }) => {
        if (active) setRecent(data.reports.slice(0, 3));
      })
      .catch(() => {
        if (active) setListError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    requestJson<{ documents: DocumentOption[] }>("/api/documents")
      .then(({ data }) => {
        if (active) setDocuments(data.documents || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    requestId.current = "";
  }, [text, title, referenceText, allowWeb, attached]);
  async function run() {
    if (!ready) return;
    setBusy("scan");
    setError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const { data } = await requestJson<{ report: { id: string } }>(
        "/api/ink",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "analyse",
            title,
            text,
            referenceText,
            allowWeb,
            sourceIds: attached,
            requestId: requestId.current,
          }),
        },
      );
      router.push(`/ink/report/${data.report.id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Check failed. Your draft is unchanged.",
      );
      setBusy(null);
    }
  }
  async function importFile(file?: File, replace = false) {
    if (!file || busy) return;
    if (!/\.(pdf|docx|txt|md|tex)$/i.test(file.name)) {
      setError("Choose a PDF, DOCX, TXT, Markdown or LaTeX file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose a document under 10 MB.");
      return;
    }
    if (text.trim() && !replace) {
      setPending(file);
      return;
    }
    setPending(null);
    setBusy("import");
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const { data } = await requestJson<{ text: string; name: string }>(
        "/api/ink/import",
        { method: "POST", body },
        55000,
      );
      setText(data.text);
      setFilename(data.name);
      setTitle(data.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Import failed. Your existing draft is unchanged.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <main className="ink-page ink-page--wide">
      <div className="ink-lead ink-composer-lead" data-ink-reveal>
        <div>
          <p className="ink-kicker">
            <span /> DOCUMENT CHECK
          </p>
          <h1>
            Good ideas.
            <br />
            <span>Your words.</span>
          </h1>
          <p>Check your sources. Refine your writing. Submit with care.</p>
        </div>
        <div className="ink-process" aria-label="Workflow">
          <span className="is-current">
            <b>01</b> Upload
          </span>
          <i />
          <span>
            <b>02</b> Review
          </span>
          <i />
          <span>
            <b>03</b> Improve
          </span>
        </div>
      </div>
      <div className="ink-studio-grid" data-ink-reveal>
        <section className="ink-upload-card" aria-label="Submit a draft">
          <div className="ink-section-head">
            <span>
              <FileText size={18} /> Your document
            </span>
            <span className="ink-tag">PDF · DOCX · TEXT</span>
          </div>
          <input
            ref={fileInput}
            id="ink-file"
            className="ink-visually-hidden"
            type="file"
            aria-label="Import a paper or chapter"
            accept=".pdf,.docx,.txt,.md,.tex"
            disabled={!!busy}
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {!text ? (
            <div
              className={`ink-dropzone${dragging ? " is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void importFile(e.dataTransfer.files[0]);
              }}
            >
              <InkPaperArt scanning={busy === "import"} />
              <h2>
                {busy === "import"
                  ? "Reading your document…"
                  : "Drop your document here"}
              </h2>
              <p>Research paper, book chapter or a first draft.</p>
              <button
                className="ink-btn"
                disabled={!!busy}
                onClick={() => fileInput.current?.click()}
              >
                <UploadCloud size={18} /> Upload document
              </button>
              <span className="ink-file-limits">PDF or DOCX, up to 10 MB</span>
              <button
                className="ink-text-link"
                disabled={!!busy}
                onClick={() => setPasteOpen(true)}
              >
                Or paste your text <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="ink-loaded-document">
              <div className="ink-file-chip">
                <span className="ink-file-symbol">
                  <FileText size={21} />
                </span>
                <div>
                  <strong>{filename || "Pasted draft"}</strong>
                  <small>{words.toLocaleString()} words</small>
                </div>
                <button
                  className="ink-icon-btn"
                  disabled={!!busy}
                  aria-label="Replace document"
                  onClick={() => fileInput.current?.click()}
                >
                  <UploadCloud size={18} />
                </button>
              </div>
              <label htmlFor="ink-title">Title</label>
              <input
                id="ink-title"
                className="ink-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                disabled={!!busy}
                placeholder="Untitled research paper"
              />
              <label htmlFor="ink-text">Your text</label>
              <textarea
                id="ink-text"
                className="ink-textarea ink-document-editor"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!!busy}
                spellCheck
                aria-describedby="ink-text-help"
              />
              <div className="ink-editor-bottom">
                <span id="ink-text-help" className="ink-count">
                  {text.length.toLocaleString()} / 120,000 characters
                </span>
                <span className="ink-tag" data-tone="good">
                  <Check size={12} /> Draft ready
                </span>
              </div>
            </div>
          )}
          <div className="ink-upload-footer">
            <ShieldCheck size={15} />
            <span>Private report. No public document repository.</span>
          </div>
        </section>
        <aside className="ink-scan-settings">
          <div className="ink-settings-head">
            <span className="ink-icon-tile">
              <ScanLine size={22} />
            </span>
            <h2>Your check, in focus.</h2>
            <p>Three ways to strengthen your draft.</p>
          </div>
          <div className="ink-check-types">
            {[
              {
                Icon: Link2,
                label: "Source overlap",
                hint: "Passages that match your sources",
                tone: "coral",
              },
              {
                Icon: Quote,
                label: "Citation review",
                hint: "Claims that may need a reference",
                tone: "amber",
              },
              {
                Icon: PenLine,
                label: "Writing patterns",
                hint: "Clarity, repetition and phrasing",
                tone: "green",
              },
            ].map(({ Icon, label, hint, tone }) => (
              <div className="ink-check-type" key={label}>
                <span className={`ink-check-icon ${tone}`}>
                  <Icon size={17} />
                </span>
                <div>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </div>
                <Check size={15} />
              </div>
            ))}
          </div>
          <button
            className="ink-source-button"
            disabled={!!busy}
            onClick={() => setSourcesOpen(true)}
          >
            <Plus size={16} />
            <span>Add comparison sources</span>
            <span className="ink-source-count">
              {attached.length + (referenceText.trim() ? 1 : 0)}
            </span>
          </button>
          <label className="ink-web-toggle">
            <span>
              <strong>
                {searchConfigured ? "Search the web" : "Web search unavailable"}
              </strong>
              <small>
                {searchConfigured
                  ? "Send selected excerpts to search"
                  : "Compare with your added sources"}
              </small>
            </span>
            <input
              type="checkbox"
              checked={allowWeb}
              onChange={(e) => setAllowWeb(e.target.checked)}
              disabled={!!busy || !searchConfigured}
              aria-label="Allow selected excerpts to be sent to web search"
            />
          </label>
          <button
            className="ink-btn ink-btn--scan"
            disabled={!ready}
            onClick={run}
          >
            {busy ? (
              <LoaderCircle className="ink-spin" size={18} />
            ) : (
              <ScanLine size={18} />
            )}{" "}
            {busy === "scan"
              ? "Checking your draft…"
              : busy === "import"
                ? "Reading document…"
                : "Check this draft"}
            {!busy && <ArrowRight size={17} />}
          </button>
          <p className="ink-small-print">
            200–120,000 characters. Style checks aren’t AI-authorship detection.{" "}
            <Link href="/ink/how-it-works">See coverage</Link>
          </p>
          {text && !referenceText.trim() && !attached.length && !allowWeb && (
            <p className="ink-inline-notice">
              Add a source to compare overlap. Without one, only style and
              citation checks run.
            </p>
          )}
        </aside>
      </div>
      {error && (
        <div className="ink-banner" data-tone="bad" role="alert">
          {error}
        </div>
      )}
      <section className="ink-recent-section" data-ink-reveal>
        <div className="ink-section-title">
          <h2>Recent documents</h2>
          <Link href="/ink/reports">
            All reports <ArrowRight size={15} />
          </Link>
        </div>
        {loading ? (
          <p role="status" className="ink-note">
            Loading your reports…
          </p>
        ) : listError ? (
          <p className="ink-note">
            Reports couldn’t load.{" "}
            <Link href="/ink/reports">Try the library.</Link>
          </p>
        ) : recent.length ? (
          <div className="ink-recent-grid">
            {recent.map((r) => (
              <Link
                className="ink-recent-card"
                key={r.id}
                href={`/ink/report/${r.id}`}
              >
                <span className="ink-file-symbol">
                  <FileText size={21} />
                </span>
                <h3>{r.title}</h3>
                <span className="ink-count">
                  {r.words.toLocaleString()} words
                </span>
                <div>
                  <span className="ink-tag" data-tone="info">
                    {r.sources
                      ? `${r.matched}% matched`
                      : "No sources compared"}
                  </span>
                  <ArrowRight size={17} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="ink-recent-empty">
            <FolderOpen size={23} />
            <span>Your first report will appear here.</span>
            <span className="ink-count">A fresh start.</span>
          </div>
        )}
      </section>
      <InkDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Paste your draft"
        wide
      >
        <label htmlFor="ink-paste-title">Title</label>
        <input
          id="ink-paste-title"
          className="ink-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder="Research paper title"
        />
        <label htmlFor="ink-paste-text">Your text</label>
        <textarea
          id="ink-paste-text"
          className="ink-textarea"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFilename("");
          }}
          placeholder="Paste at least 200 characters…"
        />
        <div className="ink-dialog-actions">
          <span className="ink-count">{words.toLocaleString()} words</span>
          <button
            className="ink-btn"
            disabled={!text.trim()}
            onClick={() => setPasteOpen(false)}
          >
            Use this draft <ArrowRight size={16} />
          </button>
        </div>
      </InkDialog>
      <InkDialog
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        title="Comparison sources"
        wide
      >
        <p className="ink-note">
          Compare with a passage or your library documents.
        </p>
        <label htmlFor="ink-reference">
          Reference text to compare (optional)
        </label>
        <textarea
          id="ink-reference"
          className="ink-textarea"
          maxLength={60000}
          value={referenceText}
          onChange={(e) => setReferenceText(e.target.value)}
          placeholder="Paste the original source passage…"
        />
        {documents.length > 0 && (
          <>
            <h3 className="ink-h3">Library · {attached.length}/10 selected</h3>
            <div className="ink-library-options">
              {documents.map((d) => (
                <button
                  key={d.id}
                  aria-pressed={attached.includes(d.id)}
                  onClick={() =>
                    setAttached((v) =>
                      v.includes(d.id)
                        ? v.filter((x) => x !== d.id)
                        : v.length < 10
                          ? [...v, d.id]
                          : v,
                    )
                  }
                >
                  <FileText size={17} />
                  <span>{d.name}</span>
                  {attached.includes(d.id) ? (
                    <Check size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="ink-dialog-actions">
          <Link href="/library" className="ink-text-link">
            Open library
          </Link>
          <button className="ink-btn" onClick={() => setSourcesOpen(false)}>
            Done <Check size={16} />
          </button>
        </div>
      </InkDialog>
      <InkDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title="Replace your current draft?"
      >
        <p className="ink-note">
          The new document replaces this desk’s text. Saved reports stay in your
          library.
        </p>
        <div className="ink-dialog-actions">
          <button
            className="ink-btn ink-btn--ghost"
            onClick={() => setPending(null)}
          >
            Keep current draft
          </button>
          <button
            className="ink-btn"
            onClick={() => void importFile(pending || undefined, true)}
          >
            Replace draft
          </button>
        </div>
      </InkDialog>
      <InkDialog
        open={busy === "scan"}
        onClose={() => {}}
        dismissible={false}
        title="Checking your document"
      >
        <div className="ink-scanning-state">
          <InkPaperArt scanning />
          <h3>Looking a little closer.</h3>
          <p role="status">Comparing sources and reviewing writing patterns…</p>
          <span className="ink-progress-track">
            <i />
          </span>
          <small>Your report opens when the check finishes.</small>
        </div>
      </InkDialog>
    </main>
  );
}
