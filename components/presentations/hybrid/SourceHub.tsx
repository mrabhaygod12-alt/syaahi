"use client";
import { useState, useRef, useEffect } from "react";
import {
  FilePlus2,
  Link2,
  FileText,
  Trash2,
  Upload,
  BookOpen,
  Search,
} from "lucide-react";
import { requestJson } from "@/lib/http-client";
export type SourceRef = {
  kind: "document" | "lesson" | "text" | "web";
  id?: string;
  name: string;
  text?: string;
  url?: string;
  preview?: string;
};
export default function SourceHub({
  sources,
  onChange,
  disabled = false,
  liveResearch,
  onResearchChange,
}: {
  sources: SourceRef[];
  onChange: (s: SourceRef[]) => void;
  disabled?: boolean;
  liveResearch: boolean;
  onResearchChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState(""),
    [url, setUrl] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [library, setLibrary] = useState<{ documents: any[]; lessons: any[] }>({
      documents: [],
      lessons: [],
    });
  const file = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const add = (source: SourceRef) => {
    if (!mounted.current) return;
    if (sources.length >= 6) throw new Error("Use up to six imported sources.");
    if (
      sources.some(
        (s) => (s.id && s.id === source.id) || (s.url && s.url === source.url),
      )
    )
      return;
    onChange([...sources, source]);
    setMode("");
  };
  async function upload(files: FileList | File[] | null) {
    if (!files?.length || disabled) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", files[0]);
      const { response, data } = await requestJson(
        "/api/presentations/import",
        { method: "POST", body },
        90000,
      );
      if (!response.ok) throw new Error(data.error);
      add({ ...data.source, preview: data.preview });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function importUrl() {
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(
        "/api/presentations/sources",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designEngine: 3,
            sources: [{ kind: "web", url }],
          }),
        },
        45000,
      );
      if (!response.ok) throw new Error(data.error);
      const s = data.sources[0];
      add({
        kind: "web",
        url: s.locator,
        name: s.name,
        preview: s.text.slice(0, 500),
      });
      setUrl("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openLibrary() {
    setMode("library");
    setError("");
    try {
      const { response, data } = await requestJson(
        "/api/presentations/sources",
      );
      if (!response.ok) throw new Error(data.error);
      setLibrary({
        documents: Array.isArray(data.documents) ? data.documents : [],
        lessons: Array.isArray(data.lessons) ? data.lessons : [],
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <aside className="cv-source-hub">
      <div className="cv-panel-heading">
        <div>
          <span className="cv-eyebrow">01 / KNOWLEDGE</span>
          <h2>
            Source hub <small>{sources.length}</small>
          </h2>
        </div>
        <FileText size={19} />
      </div>
      <p className="cv-panel-intro">
        A strong presentation begins with something worth knowing.
      </p>
      <input
        ref={file}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="cv-visually-hidden"
        aria-label="Upload presentation source"
        onChange={(e) => void upload(e.target.files)}
        disabled={disabled || busy}
      />
      <button
        className="cv-upload"
        disabled={disabled || busy}
        onClick={() => file.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
      >
        <Upload size={24} />
        <strong>{busy ? "Reading source…" : "Drop knowledge here"}</strong>
        <span>PDF, DOCX, TXT · up to 10 MB</span>
      </button>
      <div className="cv-source-actions">
        <button
          disabled={disabled || busy}
          onClick={() => setMode(mode === "url" ? "" : "url")}
        >
          <Link2 size={16} />
          Link
        </button>
        <button
          disabled={disabled || busy}
          onClick={() => setMode(mode === "text" ? "" : "text")}
        >
          <FilePlus2 size={16} />
          Paste
        </button>
        <button disabled={disabled || busy} onClick={() => void openLibrary()}>
          <BookOpen size={16} />
          Library
        </button>
      </div>
      {mode === "url" && (
        <form
          className="cv-source-form"
          onSubmit={(e) => {
            e.preventDefault();
            void importUrl();
          }}
        >
          <label>
            Public article URL
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              required
            />
          </label>
          <button className="cv-button" disabled={busy}>
            Read source
          </button>
        </form>
      )}
      {mode === "text" && (
        <form
          className="cv-source-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              if (text.trim().length < 100)
                throw new Error(
                  "Paste at least 100 characters of source material.",
                );
              add({
                id: `text-${crypto.randomUUID()}`,
                kind: "text",
                name: `Reference text ${sources.length + 1}`,
                text,
                preview: text.slice(0, 500),
              });
              setText("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Reference text
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={250000}
              rows={7}
              required
            />
          </label>
          <button className="cv-button">Add text</button>
        </form>
      )}
      {mode === "library" && (
        <div className="cv-source-library">
          {[
            ...library.documents.map((d) => ({ ...d, kind: "document" })),
            ...library.lessons.map((d) => ({ ...d, kind: "lesson" })),
          ].map((d) => (
            <button
              key={d.id}
              onClick={() => {
                try {
                  add({ kind: d.kind, id: d.id, name: d.name });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <FileText size={15} />
              {d.name}
            </button>
          ))}
          {!library.documents.length && !library.lessons.length && (
            <p>No saved sources yet. Upload a document or paste your notes.</p>
          )}
        </div>
      )}
      {error && (
        <p className="cv-error" role="alert">
          {error}
        </p>
      )}
      <div className="cv-source-list">
        {sources.map((s, i) => (
          <article key={s.id || s.url || i}>
            <FileText size={17} />
            <div>
              <strong>{s.name}</strong>
              <small>
                {s.kind === "web"
                  ? "Public web source"
                  : s.kind === "text"
                    ? "Your reference text"
                    : "Owned learning source"}
              </small>
              {s.preview && (
                <details>
                  <summary>Inspect passage</summary>
                  <p>{s.preview}</p>
                </details>
              )}
            </div>
            <button
              className="cv-icon-button"
              aria-label={`Remove ${s.name}`}
              disabled={disabled}
              onClick={() => onChange(sources.filter((_, n) => n !== i))}
            >
              <Trash2 size={14} />
            </button>
          </article>
        ))}
      </div>
      <label className="cv-research-switch">
        <span>
          <Search size={16} />
          <b>Live research</b>
        </span>
        <input
          type="checkbox"
          checked={liveResearch}
          onChange={(e) => onResearchChange(e.target.checked)}
          disabled={disabled}
        />
      </label>
      <p className="cv-fineprint">
        Bounded web discovery with visible query history. Source text is treated
        as evidence, never as executable instructions.
      </p>
      <div className="cv-source-principle">
        <span>NO SOURCE, NO CLAIM.</span>
        <p>Every statement keeps an exact passage you can inspect.</p>
      </div>
    </aside>
  );
}
