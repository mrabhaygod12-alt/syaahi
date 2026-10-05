"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Check,
  Palette,
} from "lucide-react";
import { requestJson } from "@/lib/http-client";
import {
  ARCHETYPES,
  words,
  type Storyboard,
  type StoryBeat,
} from "@/lib/presentations/archetypes";
import { TEMPLATE_CATALOG } from "@/lib/presentations/theme";
import type { DeckTemplate } from "@/lib/presentations/model";
import type { DeckDraft } from "@/lib/presentations/drafts";
import { TemplateTile } from "./PresentationHome";
export default function PresentationPlan({ id }: { id: string }) {
  const [draft, setDraft] = useState<DeckDraft | null>(null),
    [story, setStory] = useState<Storyboard | null>(null),
    [template, setTemplate] = useState<DeckTemplate>("studio"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [themes, setThemes] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    void requestJson(`/api/presentations/drafts/${id}`)
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error);
        setDraft(data.draft);
        setStory(data.draft.storyboard);
        setTemplate(data.draft.template);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(index: number, patch: Partial<StoryBeat>) {
    if (!story) return;
    setStory({
      ...story,
      beats: story.beats.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    });
    setDirty(true);
    setConfirmed(false);
  }
  function move(index: number, by: number) {
    if (!story || index + by <= 0 || index + by >= story.beats.length - 1)
      return;
    const beats = [...story.beats];
    [beats[index], beats[index + by]] = [beats[index + by], beats[index]];
    setStory({ ...story, beats });
    setDirty(true);
    setConfirmed(false);
  }
  async function save(): Promise<DeckDraft | null> {
    if (!draft || !story) return null;
    const { response, data } = await requestJson(
      `/api/presentations/drafts/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: draft.revision,
          outline: story.beats.map((b) => b.title),
          storyboard: story,
          template,
        }),
      },
    );
    if (!response.ok) throw new Error(data.error);
    setDraft(data.draft);
    setStory(data.draft.storyboard);
    setDirty(false);
    setMessage("Plan saved to your account.");
    return data.draft;
  }
  async function action(generate: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await save();
      if (generate && saved) {
        if (!confirmed) throw new Error("Approve the five-credit cost.");
        const { response, data } = await requestJson(
          "/api/presentations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              draftId: saved.id,
              revision: saved.revision,
              outline: saved.outline,
              confirmCredits: true,
            }),
          },
          60000,
        );
        if (!response.ok) throw new Error(data.error);
        location.assign(`/presentations/${data.deck.id}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!draft || !story)
    return (
      <section className="pw-content">
        <p role={error ? "alert" : "status"}>
          {error || "Opening your saved storyboard…"}
        </p>
        <a href="/presentations">Back to studio</a>
      </section>
    );
  return (
    <div className="pw-plan">
      <aside className="pw-plan-brief">
        <a href="/presentations/new">
          <ArrowLeft size={16} />
          Creation studio
        </a>
        <p className="pw-eyebrow">Your brief</p>
        <div className="pw-chat-bubble">{draft.prompt}</div>
        <div className="pw-assistant-note">
          <Sparkles size={18} />
          <p>{story.thesis}</p>
          <small>
            Audience: {draft.audience}
            <br />
            {draft.language} · {draft.count} slides
          </small>
        </div>
        <h3>
          <BookOpen size={16} />
          Research sources
        </h3>
        {draft.sources.length ? (
          draft.sources.map((s) => (
            <details key={s.id}>
              <summary>{s.name}</summary>
              <p>{s.text.slice(0, 1200)}</p>
              {s.locator && (
                <a href={s.locator} target="_blank" rel="noopener noreferrer">
                  Open source ↗
                </a>
              )}
              {s.truncated && (
                <small>Source text was bounded for model context.</small>
              )}
            </details>
          ))
        ) : (
          <p>
            No sources supplied. Review the explanation; the system will not
            invent numerical evidence or quotations.
          </p>
        )}
      </aside>
      <section className="pw-plan-main">
        <header>
          <p className="pw-eyebrow">Make the story yours</p>
          <h1>Review the plan</h1>
          <p>
            Each card has one purpose and a visual layout. Refine the outline
            before generating.
          </p>
        </header>
        {error && (
          <p className="pw-alert" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="pw-saved" role="status">
            <Check size={16} />
            {message}
          </p>
        )}
        <ol className="pw-beats">
          {story.beats.map((b, i) => (
            <li key={i}>
              <span className="pw-beat-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <label>
                  <span className="sr-only">Slide {i + 1} title</span>
                  <input
                    aria-label={`Slide ${i + 1} title`}
                    maxLength={100}
                    value={b.title}
                    onChange={(e) => edit(i, { title: e.target.value })}
                  />
                </label>
                <label>
                  <span className="sr-only">Slide {i + 1} purpose</span>
                  <textarea
                    aria-label={`Slide ${i + 1} purpose`}
                    rows={2}
                    maxLength={180}
                    value={b.purpose}
                    onChange={(e) => edit(i, { purpose: e.target.value })}
                  />
                </label>
                <div className="pw-beat-meta">
                  <span>{b.role}</span>
                  <label>
                    <span className="sr-only">Slide {i + 1} archetype</span>
                    <select
                      aria-label={`Slide ${i + 1} archetype`}
                      value={b.archetype}
                      onChange={(e) =>
                        edit(i, {
                          archetype: e.target.value as StoryBeat["archetype"],
                        })
                      }
                    >
                      {ARCHETYPES.map((a) => (
                        <option key={a} value={a}>
                          {a.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <small className={words(b.title) > 8 ? "pw-invalid" : ""}>
                    {words(b.title)}/8 words
                  </small>
                  <small>{b.evidence.length} sources</small>
                </div>
              </div>
              {i > 0 && i < story.beats.length - 1 && (
                <div className="pw-reorder">
                  <button
                    disabled={i === 1}
                    aria-label={`Move slide ${i + 1} up`}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    disabled={i === story.beats.length - 2}
                    aria-label={`Move slide ${i + 1} down`}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
        <footer className="pw-plan-footer">
          <div>
            <label className="pw-consent">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Use 5 credits to build this presentation
            </label>
            <small>
              Planning and editing are free. A failed generation returns its
              charge.
            </small>
          </div>
          <div>
            <button
              className="pw-button"
              disabled={busy}
              onClick={() => void action(false)}
            >
              Save plan
            </button>
            <button
              className="pw-button primary"
              disabled={busy || !confirmed}
              onClick={() => void action(true)}
            >
              {busy ? <span className="pw-spinner" /> : <Sparkles size={16} />}
              Generate presentation
            </button>
          </div>
        </footer>
      </section>
      <aside className="pw-plan-style">
        <h2>
          <Palette size={18} />
          Look & feel
        </h2>
        <TemplateTile
          id={template}
          index={1}
          selected
          onClick={() => setThemes(!themes)}
        />
        <p>{TEMPLATE_CATALOG.find((t) => t.id === template)?.description}</p>
        <button
          className="pw-button"
          aria-expanded={themes}
          onClick={() => setThemes(!themes)}
        >
          Browse themes
        </button>
        {themes && (
          <div className="pw-theme-choices">
            {TEMPLATE_CATALOG.map((t) => (
              <button
                key={t.id}
                aria-pressed={template === t.id}
                onClick={() => {
                  setTemplate(t.id);
                  setDirty(true);
                  setConfirmed(false);
                }}
              >
                {t.name}
                {template === t.id && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
        <div className="pw-design-note">
          <h3>Designed for clarity</h3>
          <p>
            Six fixed layouts. Short copy, clear hierarchy and consistent
            spacing. Source excerpts support metrics and quotations.
          </p>
          <p>Detailed context stays in private speaker notes.</p>
          <p>
            For a metric trio, include three source-supported numerical values
            in that slide’s purpose. Use Bento or Comparison for qualitative
            facts.
          </p>
        </div>
      </aside>
    </div>
  );
}
