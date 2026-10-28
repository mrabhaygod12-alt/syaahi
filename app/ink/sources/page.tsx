"use client";
import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  UploadCloud,
  Search,
  ShieldCheck,
} from "lucide-react";
import { InkDialog } from "../InkUI";
import { requestJson } from "../client";
interface Source {
  id: string;
  title: string;
  words: number;
  createdAt: string;
}
export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<Source | null>(null),
    [query, setQuery] = useState("");
  const file = useRef<HTMLInputElement>(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setSources(
        (await requestJson<{ sources: Source[] }>("/api/ink/sources")).data
          .sources,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sources.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function importFile(f?: File) {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", f);
      const { data } = await requestJson<{ text: string; name: string }>(
        "/api/ink/import",
        { method: "POST", body },
        55000,
      );
      if (data.text.length > 60000)
        throw Error("Split this source into sections under 60,000 characters.");
      setText(data.text);
      setTitle(data.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import source.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/ink/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", title, text }),
      });
      setOpen(false);
      setText("");
      setTitle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not index source.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="ink-page ink-page--wide">
      <div className="ink-lead ink-composer-lead" data-ink-reveal>
        <div>
          <p className="ink-kicker">PRIVATE SOURCE INDEX</p>
          <h1>
            Your research.
            <br />
            <span>Ready to compare.</span>
          </h1>
          <p>Keep papers and chapters as private comparison sources.</p>
        </div>
        <button
          className="ink-btn"
          onClick={() => {
            setOpen(true);
            setError("");
          }}
        >
          <Plus size={16} /> Add source
        </button>
      </div>
      <div className="ink-library-toolbar">
        <label className="ink-search-field">
          <Search size={16} />
          <input
            aria-label="Search indexed sources"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a source…"
          />
        </label>
        <span className="ink-count">{sources.length} / 20 sources</span>
      </div>
      {error && !open && !remove && (
        <p className="ink-banner" data-tone="bad" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading your private index…</p>
      ) : !sources.length ? (
        <div className="ink-empty">
          <ShieldCheck size={30} />
          <strong>A private comparison shelf.</strong>Add only material you have
          permission to use. Your sources aren’t shared with other accounts.
        </div>
      ) : !sources.some((s) =>
          s.title.toLowerCase().includes(query.toLowerCase()),
        ) ? (
        <div className="ink-empty">
          <Search size={26} />
          <strong>No sources found.</strong>Try another title.
        </div>
      ) : (
        <div className="ink-recent-grid">
          {sources
            .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
            .map((s) => (
              <article className="ink-recent-card" key={s.id}>
                <span className="ink-file-symbol">
                  <FileText size={21} />
                </span>
                <h3>{s.title}</h3>
                <span className="ink-count">
                  {s.words.toLocaleString()} words · Indexed
                </span>
                <div>
                  <span className="ink-tag" data-tone="good">
                    Private
                  </span>
                  <button
                    className="ink-icon-btn"
                    aria-label={`Remove ${s.title}`}
                    onClick={() => setRemove(s)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
      <p className="ink-small-print">
        Up to 20 sources, 60,000 characters and 12,000 words each. Scan reports
        show how many indexed candidates were compared. Removing a source
        doesn’t alter existing report snapshots.
      </p>
      <InkDialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Add a private source"
        wide
      >
        <button
          className="ink-btn ink-btn--ghost"
          disabled={busy}
          onClick={() => file.current?.click()}
        >
          <UploadCloud size={16} /> Import PDF / DOCX
        </button>
        <input
          ref={file}
          type="file"
          className="ink-visually-hidden"
          aria-label="Import index source"
          accept=".pdf,.docx,.txt,.md,.tex"
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          disabled={busy}
        />
        <label htmlFor="ink-index-title">Source title</label>
        <input
          id="ink-index-title"
          className="ink-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          disabled={busy}
        />
        <label htmlFor="ink-index-text">Source text</label>
        <textarea
          id="ink-index-text"
          className="ink-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={60000}
          disabled={busy}
          placeholder="Or paste a paper or chapter passage…"
        />
        {error && (
          <p role="alert" className="ink-banner" data-tone="bad">
            {error}
          </p>
        )}
        <div className="ink-dialog-actions">
          <span className="ink-count">
            {text.length.toLocaleString()} / 60,000 characters
          </span>
          <button
            className="ink-btn"
            disabled={busy || text.trim().length < 200 || !title.trim()}
            onClick={save}
          >
            {busy ? "Preparing source…" : "Index source"}
          </button>
        </div>
      </InkDialog>
      <InkDialog
        open={!!remove}
        onClose={() => {
          if (!busy) setRemove(null);
        }}
        title="Remove this indexed source?"
      >
        <p className="ink-note">
          The private source and its fingerprints will be deleted. Existing
          report excerpts stay with their reports.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="ink-dialog-actions">
          <button
            className="ink-btn ink-btn--ghost"
            onClick={() => setRemove(null)}
            disabled={busy}
          >
            Keep source
          </button>
          <button
            className="ink-btn ink-btn--danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await requestJson("/api/ink/sources", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "delete", id: remove?.id }),
                });
                setRemove(null);
                await load();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not remove source.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Removing…" : "Delete indexed source"}
          </button>
        </div>
      </InkDialog>
    </main>
  );
}
