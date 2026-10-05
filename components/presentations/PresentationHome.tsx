"use client";
import { useEffect, useState } from "react";
import {
  ArrowUp,
  Link2,
  Paperclip,
  Sparkles,
  Check,
  Plus,
  X,
  ArrowRight,
  Layers3,
} from "lucide-react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
import { TEMPLATE_CATALOG } from "@/lib/presentations/theme";
import { archetypeExample, ARCHETYPES } from "@/lib/presentations/archetypes";
import type { DeckSlide, DeckTemplate } from "@/lib/presentations/model";
import type { DeckSource } from "@/lib/presentations/drafts";
import type { Deck } from "@/lib/presentations/store";
import SlideCanvas from "./SlideCanvas";
import dynamic from "next/dynamic";
const LegacyWorkbench = dynamic(() => import("./PresentationWorkbench"));
export function templateSlide(index = 0): DeckSlide {
  const semantic = archetypeExample(ARCHETYPES[index % ARCHETYPES.length]);
  return {
    title: semantic.title,
    layout: "points",
    subtitle: semantic.eyebrow,
    bullets: [],
    columns: [],
    steps: [],
    table: [],
    chart: null,
    notes: "",
    citations: [],
    semantic,
  };
}
export function TemplateTile({
  id,
  index = 0,
  selected,
  onClick,
}: {
  id: DeckTemplate;
  index?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const item = TEMPLATE_CATALOG.find((t) => t.id === id)!;
  return (
    <button
      className={"pw-template" + (selected ? " selected" : "")}
      onClick={onClick}
      aria-pressed={!!selected}
    >
      <SlideCanvas slide={templateSlide(index)} template={id} />
      <span>
        <strong>{item.name}</strong>
        <small>{item.category}</small>
        {selected && <Check size={17} />}
      </span>
    </button>
  );
}
export default function PresentationHome({
  view = "create",
}: {
  view?: "create" | "library" | "templates";
}) {
  const { user, loading } = useAccount();
  const [prompt, setPrompt] = useState(""),
    [briefOwner, setBriefOwner] = useState(""),
    [legacy, setLegacy] = useState(false),
    [audience, setAudience] = useState("Students"),
    [count, setCount] = useState(6),
    [language, setLanguage] = useState("english"),
    [template, setTemplate] = useState<DeckTemplate>("studio"),
    [max, setMax] = useState(6),
    [format, setFormat] = useState("presenter"),
    [sources, setSources] = useState<DeckSource[]>([]),
    [url, setUrl] = useState(""),
    [text, setText] = useState(""),
    [sourceOpen, setSourceOpen] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [decks, setDecks] = useState<Deck[]>([]),
    [drafts, setDrafts] = useState<
      {
        id: string;
        title: string;
        count: number;
        updatedAt: string;
        designEngine: number;
      }[]
    >([]),
    [library, setLibrary] = useState<{ documents: any[]; lessons: any[] }>({
      documents: [],
      lessons: [],
    }),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All");
  useEffect(() => {
    let cancelled = false;
    setDecks([]);
    setDrafts([]);
    setSources([]);
    setLibrary({ documents: [], lessons: [] });
    if (!user) return;
    void requestJson("/api/presentations")
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error);
        if (cancelled) return;
        setDecks(data.decks || []);
        setDrafts(data.drafts || []);
        setMax(data.maxSlides || 6);
      })
      .catch((e) => setError(e.message));
    void requestJson("/api/presentations/sources")
      .then(({ response, data }) => {
        if (response.ok && !cancelled) setLibrary(data as any);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("template");
    if (TEMPLATE_CATALOG.some((item) => item.id === t))
      setTemplate(t as DeckTemplate);
    setLegacy(!!new URLSearchParams(location.search).get("draft"));
  }, []);
  useEffect(() => {
    if (!user?.id) {
      setPrompt("");
      setBriefOwner("");
      return;
    }
    let saved = "";
    try {
      saved =
        localStorage.getItem(`syaahi-presentation-brief:${user.id}`) || "";
    } catch {}
    setPrompt(saved);
    setBriefOwner(user.id);
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id || briefOwner !== user.id) return;
    try {
      if (prompt)
        localStorage.setItem(`syaahi-presentation-brief:${user.id}`, prompt);
      else localStorage.removeItem(`syaahi-presentation-brief:${user.id}`);
    } catch {}
  }, [prompt, user?.id, briefOwner]);
  async function addSource(ref: any) {
    setBusy("source");
    setError("");
    try {
      if (sources.length >= 6) throw new Error("Use up to six sources.");
      const { response, data } = await requestJson(
        "/api/presentations/sources",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designEngine: 2,
            sources: [
              {
                ...ref,
                ...(ref.kind === "text"
                  ? { id: `text-${crypto.randomUUID()}` }
                  : {}),
              },
            ],
          }),
        },
        60000,
      );
      if (!response.ok) throw new Error(data.error);
      setSources((old) => [
        ...old,
        ...data.sources.filter(
          (s: DeckSource) => !old.some((o) => o.id === s.id),
        ),
      ]);
      setUrl("");
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function upload(file: File) {
    setBusy("upload");
    setError("");
    try {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > 24000) throw new Error("Use a text file up to 24 KB.");
        await addSource({
          kind: "text",
          name: file.name,
          text: await file.text(),
        });
        return;
      }
      const form = new FormData();
      form.append("file", file);
      const { response, data } = await requestJson(
        "/api/documents",
        { method: "POST", body: form },
        60000,
      );
      if (!response.ok) throw new Error(data.error);
      await addSource({ kind: "document", id: data.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function plan(e: React.FormEvent) {
    e.preventDefault();
    setBusy("plan");
    setError("");
    try {
      const refs = sources.map((s) =>
        s.kind === "web"
          ? { kind: "web", url: s.locator }
          : s.kind === "text"
            ? { kind: "text", id: s.id, name: s.name, text: s.text }
            : { kind: s.kind, id: s.id.replace(/^(lesson|document)-/, "") },
      );
      const { response, data } = await requestJson(
        "/api/presentations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "outline",
            designEngine: 2,
            prompt,
            audience,
            count,
            language,
            template,
            format,
            sources: refs,
          }),
        },
        120000,
      );
      if (!response.ok) throw new Error(data.error);
      if (user?.id)
        localStorage.removeItem(`syaahi-presentation-brief:${user.id}`);
      location.assign(`/presentations/plan/${data.draft.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const filtered = decks.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()),
  );
  if (legacy && view === "create")
    return (
      <div className="presentation-page">
        <LegacyWorkbench />
      </div>
    );
  return (
    <div className="pw-content">
      {error && (
        <p role="alert" className="pw-alert">
          {error}
        </p>
      )}
      {view === "create" && (
        <>
          <section className="pw-create-hero">
            <div className="pw-orbit">
              <Sparkles size={36} />
            </div>
            <p className="pw-eyebrow">An idea is a beginning</p>
            <h1>What will you explain today?</h1>
            <p className="pw-subtitle">
              A thoughtful story. A presentation with room to breathe.
            </p>
            <form className="pw-composer" onSubmit={plan}>
              <label className="sr-only" htmlFor="presentation-brief">
                Presentation brief
              </label>
              <textarea
                id="presentation-brief"
                required
                minLength={20}
                maxLength={3000}
                rows={4}
                placeholder="Create a presentation about… Describe the audience and the main idea. Add a public article link to research it."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="pw-composer-bottom">
                <button
                  type="button"
                  className="pw-attach"
                  aria-label="Add research sources"
                  aria-expanded={sourceOpen}
                  onClick={() => setSourceOpen(!sourceOpen)}
                >
                  <Plus size={21} />
                </button>
                <span>
                  <Sparkles size={15} />
                  Plan first · free
                </span>
                {user ? (
                  <button
                    className="pw-send"
                    aria-label="Prepare storyboard"
                    disabled={!!busy || prompt.trim().length < 20}
                  >
                    {busy === "plan" ? (
                      <span className="pw-spinner" />
                    ) : (
                      <ArrowUp size={22} />
                    )}
                  </button>
                ) : (
                  <a
                    className="pw-small-button"
                    href="/login?workspace=student&next=%2Fpresentations"
                  >
                    {loading ? "Loading account…" : "Sign in to create"}
                  </a>
                )}
              </div>
            </form>
            <div className="pw-controls">
              <label>
                Slides
                <select
                  aria-label="Slides"
                  value={count}
                  onChange={(e) => setCount(+e.target.value)}
                >
                  {Array.from(
                    { length: Math.max(1, max - 3) },
                    (_, i) => i + 4,
                  ).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Language
                <select
                  aria-label="Language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {[
                    "english",
                    "hindi",
                    "hinglish",
                    "french",
                    "german",
                    "spanish",
                  ].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Audience
                <input
                  aria-label="Audience"
                  maxLength={120}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </label>
              <label>
                Format
                <select
                  aria-label="Format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="presenter">Presenter slides</option>
                  <option value="detailed">Detailed notes</option>
                </select>
              </label>
            </div>
            {!!busy && (
              <p role="status" className="pw-progress">
                <span className="pw-spinner" />
                {busy === "plan"
                  ? "Reading sources and shaping your narrative…"
                  : "Preparing your source…"}
              </p>
            )}
            {sources.length > 0 && (
              <div className="pw-source-chips">
                {sources.map((s) => (
                  <span key={s.id}>
                    {s.kind === "web" ? (
                      <Link2 size={14} />
                    ) : (
                      <Paperclip size={14} />
                    )}
                    <span>{s.name}</span>
                    <button
                      aria-label={`Remove ${s.name}`}
                      disabled={!!busy}
                      onClick={() =>
                        setSources((old) => old.filter((o) => o.id !== s.id))
                      }
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
          {sourceOpen && (
            <section className="pw-source-panel">
              <div>
                <h2>Give your story a foundation</h2>
                <p>
                  Public articles, owned lessons, PDFs or reference text. Up to
                  six sources and 48,000 imported characters. Relevant original
                  passages enter the AI steps.
                </p>
              </div>
              <div className="pw-source-inputs">
                <label>
                  Public article URL
                  <input
                    type="url"
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </label>
                <button
                  className="pw-button"
                  disabled={!!busy || !user || !url}
                  onClick={() => void addSource({ kind: "web", url })}
                >
                  <Link2 size={16} />
                  Research link
                </button>
                <label>
                  Reference text
                  <textarea
                    rows={3}
                    maxLength={24000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </label>
                <button
                  className="pw-button"
                  disabled={!!busy || !user || !text.trim()}
                  onClick={() =>
                    void addSource({
                      kind: "text",
                      text,
                      name: "Pasted reference",
                    })
                  }
                >
                  Add text
                </button>
                <label className="pw-file">
                  <Paperclip size={17} />
                  Upload PDF or text
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    disabled={!!busy || !user}
                    onChange={(e) => {
                      if (e.target.files?.[0]) void upload(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label>
                  From your library
                  <select
                    disabled={!!busy || !user}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const [kind, id] = e.target.value.split(":");
                        void addSource({ kind, id });
                      }
                    }}
                  >
                    <option value="">Choose an owned source</option>
                    {[
                      ...library.documents.map((d) => ({
                        ...d,
                        kind: "document",
                      })),
                      ...library.lessons.map((d) => ({ ...d, kind: "lesson" })),
                    ].map((d) => (
                      <option key={d.kind + d.id} value={`${d.kind}:${d.id}`}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}
        </>
      )}
      {view !== "library" && (
        <section className="pw-template-section">
          <div className="pw-section-heading">
            <div>
              <p className="pw-eyebrow">A considered look</p>
              <h2>
                {view === "templates"
                  ? "Choose your visual language"
                  : "Start with a direction"}
              </h2>
            </div>
            {view === "create" && (
              <a href="/presentations/templates">
                All templates <ArrowRight size={16} />
              </a>
            )}
          </div>
          {view === "templates" && (
            <div className="pw-filter">
              {["All", ...new Set(TEMPLATE_CATALOG.map((t) => t.category))].map(
                (c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
          )}
          <div className="pw-template-grid">
            {TEMPLATE_CATALOG.filter(
              (t) => category === "All" || t.category === category,
            )
              .slice(0, view === "create" ? 6 : 99)
              .map((t, i) => (
                <TemplateTile
                  key={t.id}
                  id={t.id}
                  index={i}
                  selected={template === t.id}
                  onClick={() => {
                    setTemplate(t.id);
                    if (view === "templates")
                      location.assign(`/presentations/new?template=${t.id}`);
                  }}
                />
              ))}
          </div>
          {view === "templates" && (
            <p className="pw-template-credit">
              Nine original themes, six reusable archetypes. Icons by Lucide
              under the ISC license. Theme selection controls palette; the
              narrative chooses the layout.
            </p>
          )}
        </section>
      )}
      {view !== "templates" && (
        <section className="pw-library">
          {!!drafts.length && (
            <div className="pw-draft-list">
              <h2>Plans in progress</h2>
              <p>Continue a saved storyboard before building your slides.</p>
              {drafts.map((d) => (
                <a
                  key={d.id}
                  href={
                    d.designEngine === 2
                      ? `/presentations/plan/${d.id}`
                      : `/presentations?draft=${d.id}`
                  }
                >
                  <span>
                    <strong>{d.title}</strong>
                    <small>
                      {d.count} slides ·{" "}
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </a>
              ))}
            </div>
          )}
          <div className="pw-section-heading">
            <div>
              <p className="pw-eyebrow">Keep creating</p>
              <h2>
                {view === "library" ? "Your presentations" : "Recent work"}
              </h2>
            </div>
            <label className="pw-search">
              <span className="sr-only">Search presentations</span>
              <input
                type="search"
                placeholder="Search your work"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {!filtered.length ? (
            <div className="pw-empty">
              <Layers3 size={30} />
              <h3>
                {search
                  ? "No matching presentations"
                  : "Your next idea belongs here"}
              </h3>
              <p>
                {user
                  ? "Your saved presentations appear here. Start with a brief above."
                  : "Sign in to keep your presentations in a private workspace."}
              </p>
              {view === "library" && (
                <a href="/presentations/new" className="pw-button">
                  Create a presentation
                </a>
              )}
            </div>
          ) : (
            <div className="pw-deck-grid">
              {filtered.slice(0, view === "create" ? 6 : 100).map((d) => (
                <a
                  href={`/presentations/${d.id}`}
                  key={d.id}
                  className="pw-deck-card"
                >
                  {d.slides[0] ? (
                    <SlideCanvas
                      slide={d.slides[0]}
                      template={d.template}
                      brand={d.brand}
                      language={d.language}
                    />
                  ) : (
                    <div className="pw-deck-placeholder">
                      <Layers3 size={32} />
                      <span>{d.stage || d.status}</span>
                    </div>
                  )}
                  <div>
                    <h3>{d.title}</h3>
                    <p>
                      {d.slides.length}/{d.count} slides · {d.status}
                      <span>{new Date(d.updatedAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
