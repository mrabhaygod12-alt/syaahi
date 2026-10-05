"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "../WorkspaceProvider";
import {
  DECK_TEMPLATES,
  SLIDE_LAYOUTS,
  slideQuality,
  type DeckSlide,
  type DeckTemplate,
  type SlideObject,
  type BrandKit,
} from "@/lib/presentations/model";
import { slideObjects, deckTheme } from "@/lib/presentations/layout";
import type { DeckDraft, DeckSource } from "@/lib/presentations/drafts";
import type { Deck } from "@/lib/presentations/store";
import SlideCanvas, { type PreviewMeasurement } from "./SlideCanvas";
import "./presentation-studio.css";
type View = Omit<Deck, "context" | "prompt" | "lease">;
const blankSlide = (): DeckSlide => ({
  id: crypto.randomUUID(),
  title: "New slide",
  layout: "points",
  subtitle: "",
  bullets: ["Add your main point"],
  columns: [],
  steps: [],
  table: [],
  chart: null,
  notes: "",
  citations: [],
  evidence: [],
});
export default function PresentationWorkbench({ id }: { id?: string }) {
  const { user } = useAccount();
  const [decks, setDecks] = useState<View[]>([]),
    [deck, setDeck] = useState<View | null>(null),
    [max, setMax] = useState(6),
    [sources, setSources] = useState<DeckSource[]>([]),
    [library, setLibrary] = useState<{ documents: any[]; lessons: any[] }>({
      documents: [],
      lessons: [],
    }),
    [draft, setDraft] = useState<DeckDraft | null>(null),
    [outline, setOutline] = useState<string[]>([]),
    [brief, setBrief] = useState(""),
    [reference, setReference] = useState(""),
    [audience, setAudience] = useState("Students"),
    [format, setFormat] = useState("detailed"),
    [language, setLanguage] = useState("english"),
    [count, setCount] = useState(6),
    [template, setTemplate] = useState<DeckTemplate>("editorial"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [guest, setGuest] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [selected, setSelected] = useState(0),
    [slides, setSlides] = useState<DeckSlide[]>([]),
    [dirty, setDirty] = useState(false),
    [object, setObject] = useState<string>(""),
    [mobile, setMobile] = useState("canvas"),
    [presenting, setPresenting] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [kits, setKits] = useState<BrandKit[]>([]),
    [shares, setShares] = useState<any[]>([]),
    [regen, setRegen] = useState<any[]>([]),
    [instruction, setInstruction] = useState("Make this slide more concise"),
    [regenConsent, setRegenConsent] = useState(false),
    [shareUrl, setShareUrl] = useState(""),
    [editTab, setEditTab] = useState("content");
  const [comments, setComments] = useState<any[]>([]),
    [comment, setComment] = useState("");
  const [measurement, setMeasurement] = useState<PreviewMeasurement | null>(
    null,
  );
  const measurePreview = useCallback((next: PreviewMeasurement) => {
    setMeasurement((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    );
  }, []);
  const regenerationRequest = useRef("");
  const rehearsalEvent = useRef("");
  const [rehearsals, setRehearsals] = useState<any[]>([]);
  useEffect(() => {
    if (id)
      void requestJson(`/api/presentations/${id}/rehearsals`)
        .then(({ response, data }) => {
          if (response.ok) setRehearsals(data.rehearsals || []);
        })
        .catch(() => {});
  }, [id]);
  useEffect(() => {
    regenerationRequest.current = "";
    setRegenConsent(false);
  }, [instruction, selected]);
  const undo = useRef<DeckSlide[][]>([]),
    redo = useRef<DeckSlide[][]>([]),
    stageRef = useRef<HTMLDivElement>(null),
    loadedVersion = useRef("");
  const [recovery, setRecovery] = useState<DeckSlide[] | null>(null);
  const recovered = useRef(false);
  const audienceChannel = useRef<BroadcastChannel | null>(null),
    audienceState = useRef<unknown>(null);
  useEffect(
    () => () => {
      audienceChannel.current?.postMessage({ type: "closed" });
      audienceChannel.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!user?.id || !id || !deck || recovered.current) return;
    recovered.current = true;
    try {
      const saved = JSON.parse(
        localStorage.getItem(`syaahi-deck-draft:${user.id}:${id}`) || "null",
      );
      if (
        saved?.slides?.length &&
        JSON.stringify(saved.slides) !== JSON.stringify(deck.slides)
      )
        setRecovery(saved.slides);
    } catch {}
  }, [user?.id, id, deck]);
  useEffect(() => {
    if (!user?.id || !id || !dirty) return;
    try {
      localStorage.setItem(
        `syaahi-deck-draft:${user.id}:${id}`,
        JSON.stringify({ base: loadedVersion.current, slides }),
      );
    } catch {}
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [user?.id, id, dirty, slides]);
  const load = useCallback(async () => {
    const { response, data } = await requestJson(
      id ? `/api/presentations/${id}` : "/api/presentations",
    );
    if (response.status === 401) {
      setGuest(true);
      return;
    }
    if (!response.ok) throw new Error(data.error);
    setMax(data.maxSlides || 6);
    if (id) {
      setDeck(data.deck);
      setRegen(data.regenerations || []);
      setShares(data.shares || []);
      setComments(data.comments || []);
      if (data.deck.updatedAt !== loadedVersion.current && !dirty) {
        setSlides(data.deck.slides || []);
        loadedVersion.current = data.deck.updatedAt;
      }
    } else setDecks(data.decks || []);
  }, [id, dirty]);
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [load]);
  useEffect(() => {
    if (!user?.id) return;
    void requestJson("/api/presentations/sources")
      .then(({ response, data }) => {
        if (response.ok) setLibrary(data as any);
      })
      .catch((e) => setMessage(e.message));
    void requestJson("/api/presentations/brands")
      .then(({ response, data }) => {
        if (response.ok) setKits(data.kits || []);
      })
      .catch((e) => setMessage(e.message));
    const saved = id
      ? localStorage.getItem(`syaahi-deck-selection:${user.id}:${id}`)
      : null;
    if (saved) setSelected(Math.max(0, Number(saved) || 0));
    if (!id) {
      const draftId = new URLSearchParams(location.search).get("draft");
      if (draftId)
        void requestJson(`/api/presentations/drafts/${draftId}`)
          .then(({ response, data }) => {
            if (response.ok) {
              setDraft(data.draft);
              setOutline(data.draft.outline);
              setSources(data.draft.sources);
              setTemplate(data.draft.template);
              setBrief(data.draft.prompt);
              setAudience(data.draft.audience);
              setFormat(data.draft.format);
              setLanguage(data.draft.language);
              setCount(data.draft.count);
            }
          })
          .catch((e) => setMessage(e.message));
    }
  }, [user?.id, id]);
  useEffect(() => {
    if (user?.id && id)
      localStorage.setItem(
        `syaahi-deck-selection:${user.id}:${id}`,
        String(selected),
      );
  }, [selected, user?.id, id]);
  useEffect(() => {
    if (
      !deck ||
      (!["queued", "working"].includes(deck.status) &&
        !regen.some((r) => ["queued", "working"].includes(r.status)))
    )
      return;
    const timer = setTimeout(
      () => void load().catch((e) => setMessage(e.message)),
      5000,
    );
    return () => clearTimeout(timer);
  }, [deck, regen, load]);
  const active = Math.min(selected, Math.max(0, slides.length - 1)),
    slide = slides[active],
    theme = deckTheme(deck?.template || template, deck?.brand),
    objects = slide ? slideObjects(slide, theme.ink, theme.accent) : [],
    selectedObject = objects.find((o) => o.id === object);
  useEffect(() => {
    if (!slide) return;
    const { notes, evidence, ...visible } = slide;
    void notes;
    void evidence;
    audienceState.current = {
      slide: { ...visible, notes: "", evidence: [] },
      template: deck?.template || template,
      language: deck?.language || language,
      brand: deck?.brand,
      index: active,
    };
    audienceChannel.current?.postMessage({
      type: "slide",
      view: audienceState.current,
    });
  }, [
    slide,
    deck?.template,
    deck?.brand,
    deck?.language,
    template,
    language,
    active,
  ]);
  function openAudience() {
    audienceChannel.current?.close();
    const token = crypto.randomUUID(),
      channel = new BroadcastChannel("syaahi-audience:" + token);
    audienceChannel.current = channel;
    channel.onmessage = (e) => {
      if (e.data?.type === "ready")
        channel.postMessage({ type: "slide", view: audienceState.current });
    };
    window.open(
      `/presentations/audience?channel=${token}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  useEffect(() => {
    if (!presenting) return;
    setElapsed(0);
    rehearsalEvent.current = crypto.randomUUID();
    const start = Date.now(),
      timer = setInterval(
        () => setElapsed(Math.floor((Date.now() - start) / 1000)),
        1000,
      );
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresenting(false);
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) {
        e.preventDefault();
        setSelected((i) => Math.min(slides.length - 1, i + 1));
      }
      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", keyboard);
    };
  }, [presenting, slides.length]);
  function changeSlides(next: DeckSlide[]) {
    undo.current = [...undo.current, slides].slice(-30);
    redo.current = [];
    setSlides(next);
    setDirty(true);
  }
  function changeSlide(patch: Partial<DeckSlide>) {
    changeSlides(slides.map((s, i) => (i === active ? { ...s, ...patch } : s)));
  }
  function changeObject(patch: Partial<SlideObject>) {
    if (!selectedObject) return;
    changeSlide({
      objects: objects.map((o) => (o.id === object ? { ...o, ...patch } : o)),
    });
  }
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const { response, data } = await requestJson(`/api/presentations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(data.error);
      if (body.action === "duplicate") {
        location.assign(`/presentations/${data.deck.id}`);
        return;
      }
      if (data.share)
        setShareUrl(
          `${location.origin}/presentations/shared/${data.share.token}`,
        );
      if (data.deck) {
        setDeck(data.deck);
        setSlides(data.deck.slides);
        loadedVersion.current = data.deck.updatedAt;
        setDirty(false);
        if (user?.id && id)
          try {
            localStorage.removeItem(`syaahi-deck-draft:${user.id}:${id}`);
          } catch {}
      }
      setMessage(
        body.action === "regenerate"
          ? "Slide regeneration queued. The current slide stays available."
          : "Saved to your account.",
      );
      await load();
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function importSource(kind: string, sourceId: string) {
    if (!sourceId) return;
    setBusy(true);
    try {
      const { response, data } = await requestJson(
        "/api/presentations/sources",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources: [{ kind, id: sourceId }] }),
        },
      );
      if (!response.ok) throw new Error(data.error);
      setSources((old) =>
        [
          ...old.filter((s) => s.id !== data.sources[0]?.id),
          ...data.sources,
        ].slice(0, 6),
      );
      setDraft(null);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function plan() {
    setBusy(true);
    setMessage("");
    try {
      const { response, data } = await requestJson(
        "/api/presentations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "outline",
            prompt: brief,
            audience,
            format,
            language,
            count,
            template,
            sources: [
              ...sources.map((s) =>
                s.kind === "text"
                  ? s
                  : {
                      kind: s.kind,
                      id: s.id.replace(/^(lesson|document)-/, ""),
                    },
              ),
              ...(reference.trim()
                ? [
                    {
                      kind: "text",
                      name: "Supplied reference",
                      text: reference,
                    },
                  ]
                : []),
            ],
          }),
        },
        90000,
      );
      if (!response.ok) throw new Error(data.error);
      setDraft(data.draft);
      setOutline(data.draft.outline);
      setSources(data.draft.sources);
      history.replaceState(null, "", `?draft=${data.draft.id}`);
      setConfirmed(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not plan.");
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!draft || !confirmed) return;
    setBusy(true);
    try {
      const { response, data } = await requestJson(
        "/api/presentations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: draft.id,
            revision: draft.revision,
            outline,
            confirmCredits: true,
          }),
        },
        90000,
      );
      if (!response.ok) throw new Error(data.error);
      location.assign(`/presentations/${data.deck.id}`);
    } catch (e) {
      setMessage(String(e));
      setBusy(false);
    }
  }
  async function saveOutline() {
    if (!draft) return;
    setBusy(true);
    try {
      const { response, data } = await requestJson(
        `/api/presentations/drafts/${draft.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: draft.revision, outline }),
        },
      );
      if (!response.ok) throw new Error(data.error);
      setDraft(data.draft);
      setMessage("Outline saved to your account.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save outline.");
    } finally {
      setBusy(false);
    }
  }
  async function uploadImage(file: File) {
    const alt = prompt("Describe this image for accessibility:") || "";
    if (!alt) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("alt", alt);
      const { response, data } = await requestJson(
        "/api/presentations/assets",
        { method: "POST", body: form },
      );
      if (!response.ok) throw new Error(data.error);
      changeSlide({
        imageId: data.id,
        imageAlt: data.alt,
        layout: "image",
        objects: undefined,
      });
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (guest)
    return (
      <section className="deck-workbench">
        <h2>Your presentation studio</h2>
        <p>
          Sign in as a student to import private sources, approve an outline and
          save editable decks.
        </p>
        <a
          className="btn dark"
          href="/login?workspace=student&next=%2Fpresentations"
        >
          Sign in
        </a>
      </section>
    );
  return (
    <section className="deck-workbench">
      <header className="studio-header">
        <div>
          <p className="eyebrow">SYAAHI STUDIO</p>
          <h2>{deck?.title || "From source to story."}</h2>
          <p>
            {id
              ? dirty
                ? "Unsaved changes"
                : deck?.stage || deck?.status
              : "Bring your knowledge. Shape your narrative."}
          </p>
        </div>
        <div className="studio-actions">
          {id && (
            <>
              <a className="btn light" href="/presentations">
                All decks
              </a>
              <button
                className="btn light"
                disabled={!slide}
                onClick={() => setPresenting(true)}
              >
                Present
              </button>
              <button
                className="btn dark"
                disabled={busy || !dirty || deck?.status !== "done"}
                onClick={() =>
                  void patch({
                    slides,
                    expectedUpdatedAt: loadedVersion.current,
                  })
                }
              >
                Save changes
              </button>
            </>
          )}
        </div>
      </header>
      {message && (
        <p className="studio-message" role="status">
          {message}
        </p>
      )}
      {recovery && (
        <div className="studio-message" role="status">
          Unsaved edits were found on this device. Review them against the
          current saved deck before saving.{" "}
          <button
            onClick={() => {
              changeSlides(recovery);
              setRecovery(null);
            }}
          >
            Recover edits
          </button>{" "}
          <button
            onClick={() => {
              setRecovery(null);
              if (user?.id && id)
                try {
                  localStorage.removeItem(`syaahi-deck-draft:${user.id}:${id}`);
                } catch {}
            }}
          >
            Discard local edits
          </button>
        </div>
      )}
      <nav className="studio-mobile" aria-label="Studio view">
        {["sources", "slides", "canvas", "properties"].map((v) => (
          <button
            key={v}
            aria-pressed={mobile === v}
            onClick={() => setMobile(v)}
          >
            {v}
          </button>
        ))}
      </nav>
      <div className={`studio-grid mobile-${mobile}`}>
        <aside className="studio-sources">
          <h3>Sources</h3>
          <p>
            Up to six owned sources; 18,000 characters are used across the
            selected sources.
          </p>
          {(deck?.sources || sources).map((s) => (
            <details key={s.id}>
              <summary>{s.name}</summary>
              <p>
                {s.text.slice(0, 1600)}
                {s.text.length > 1600 ? "…" : ""}
              </p>
              {s.locator && <a href={s.locator}>Open original ↗</a>}
              {!id && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setSources(sources.filter((x) => x.id !== s.id));
                    setDraft(null);
                  }}
                >
                  Remove source
                </button>
              )}
            </details>
          ))}
          {!id && (
            <>
              <label>
                Saved lesson
                <select
                  disabled={busy}
                  defaultValue=""
                  onChange={(e) => {
                    void importSource("lesson", e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose lesson…</option>
                  {library.lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Saved PDF
                <select
                  disabled={busy}
                  defaultValue=""
                  onChange={(e) => {
                    void importSource("document", e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose document…</option>
                  {library.documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Upload text PDF
                <input
                  disabled={busy}
                  type="file"
                  accept=".pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBusy(true);
                    try {
                      const form = new FormData();
                      form.append("file", file);
                      const { response, data } = await requestJson(
                        "/api/documents",
                        { method: "POST", body: form },
                        120000,
                      );
                      if (!response.ok) throw new Error(data.error);
                      await importSource("document", data.id);
                    } catch (err) {
                      setMessage(String(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              <label>
                Paste reference text
                <textarea
                  value={reference}
                  maxLength={18000}
                  rows={6}
                  onChange={(e) => {
                    setReference(e.target.value);
                    setDraft(null);
                  }}
                />
              </label>
            </>
          )}
          {id && (
            <>
              <h3>Evidence on this slide</h3>
              {slide?.evidence?.length ? (
                slide.evidence.map((e) => (
                  <p key={e}>
                    {deck?.sources?.find((s) => s.id === e)?.name ||
                      "Source unavailable"}
                  </p>
                ))
              ) : (
                <p>
                  No supplied source is linked. Verify factual claims before
                  presenting.
                </p>
              )}
              <p>
                AI evidence links require review. A supplied URL is not proof
                that its contents were retrieved.
              </p>
            </>
          )}
        </aside>
        <div className="studio-centre">
          {!id ? (
            <>
              <div className="studio-intro">
                <span>▧</span>
                <h2>A clearer way to explain.</h2>
                <p>
                  Sources on the left. Your narrative in the middle. Style and
                  generation controls on the right.
                </p>
                <div className="studio-flow">
                  <span>1 · Add sources</span>
                  <span>2 · Review outline</span>
                  <span>3 · Generate & edit</span>
                </div>
              </div>
              {draft && (
                <section className="studio-outline">
                  <h3>Approve your narrative</h3>
                  <p>
                    Planning used no credits. Reorder or rename these{" "}
                    {outline.length} slides before generation.
                  </p>
                  {outline.map((title, i) => (
                    <div key={i}>
                      <span>{i + 1}</span>
                      <input
                        aria-label={`Slide ${i + 1} outline`}
                        value={title}
                        maxLength={110}
                        onChange={(e) => {
                          setOutline(
                            outline.map((t, j) =>
                              j === i ? e.target.value : t,
                            ),
                          );
                          setConfirmed(false);
                        }}
                      />
                      <button
                        disabled={i === 0}
                        aria-label={`Move outline slide ${i + 1} up`}
                        onClick={() => {
                          const next = [...outline];
                          [next[i], next[i - 1]] = [next[i - 1], next[i]];
                          setOutline(next);
                          setConfirmed(false);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        disabled={i === outline.length - 1}
                        aria-label={`Move outline slide ${i + 1} down`}
                        onClick={() => {
                          const next = [...outline];
                          [next[i], next[i + 1]] = [next[i + 1], next[i]];
                          setOutline(next);
                          setConfirmed(false);
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn light"
                    disabled={busy || outline.some((t) => !t.trim())}
                    onClick={() => void saveOutline()}
                  >
                    Save outline
                  </button>
                  <label className="studio-consent">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    I approve this outline and the five-credit charge. Failed
                    generation refunds the charge.
                  </label>
                  <button
                    className="btn dark"
                    disabled={
                      busy || !confirmed || outline.some((t) => !t.trim())
                    }
                    onClick={() => void generate()}
                  >
                    Generate presentation · 5 credits
                  </button>
                </section>
              )}
              <h3>Your decks</h3>
              <div className="studio-decks">
                {decks.map((d) => (
                  <a key={d.id} href={`/presentations/${d.id}`}>
                    <div className="deck-mini">
                      {d.slides[0] ? (
                        <SlideCanvas
                          slide={d.slides[0]}
                          language={d.language}
                          template={d.template}
                          brand={d.brand}
                        />
                      ) : (
                        <span>▧</span>
                      )}
                    </div>
                    <h4>{d.title}</h4>
                    <p>
                      {d.status} · {d.slides.length}/{d.count} slides
                    </p>
                  </a>
                ))}
                {!decks.length && (
                  <p>Your saved presentations will appear here.</p>
                )}
              </div>
            </>
          ) : (
            <>
              {deck && ["queued", "working", "error"].includes(deck.status) && (
                <section className="studio-progress">
                  <h3>{deck.stage || deck.status}</h3>
                  <progress value={slides.length} max={deck.count} />
                  <p>
                    {slides.length}/{deck.count} slides saved · attempt{" "}
                    {deck.attempt}
                  </p>
                  {deck.error && <p>{deck.error}</p>}
                  {deck.status === "error" && (
                    <button
                      className="btn dark"
                      disabled={busy}
                      onClick={() => void patch({ action: "retry" })}
                    >
                      Retry from saved progress · 5 credits
                    </button>
                  )}
                  <p>
                    Keep this page open or return later. A refresh resumes the
                    same job.
                  </p>
                </section>
              )}
              <div className="studio-toolbar">
                <button
                  disabled={!undo.current.length}
                  onClick={() => {
                    const previous = undo.current.pop();
                    if (previous) {
                      redo.current.push(slides);
                      setSlides(previous);
                      setDirty(true);
                    }
                  }}
                >
                  Undo
                </button>
                <button
                  disabled={!redo.current.length}
                  onClick={() => {
                    const next = redo.current.pop();
                    if (next) {
                      undo.current.push(slides);
                      setSlides(next);
                      setDirty(true);
                    }
                  }}
                >
                  Redo
                </button>
                <span>
                  {active + 1}/{slides.length || deck?.count || 0}
                </span>
                {deck?.status === "done" && (
                  <>
                    <button
                      disabled={slides.length >= Math.max(max, deck.count)}
                      onClick={() => {
                        changeSlides([...slides, blankSlide()]);
                        setSelected(slides.length);
                      }}
                    >
                      ＋ Slide
                    </button>
                    <button
                      disabled={
                        !slide || slides.length >= Math.max(max, deck.count)
                      }
                      onClick={() => {
                        const next = [...slides];
                        next.splice(active + 1, 0, {
                          ...slide,
                          id: crypto.randomUUID(),
                        });
                        changeSlides(next);
                        setSelected(active + 1);
                      }}
                    >
                      Duplicate slide
                    </button>
                    <button
                      disabled={slides.length < 2}
                      onClick={() =>
                        changeSlides(slides.filter((_, i) => i !== active))
                      }
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
              <div className="studio-editor">
                <aside className="studio-thumbnails" aria-label="Slides">
                  {slides.map((s, i) => (
                    <button
                      key={s.id || i}
                      aria-pressed={active === i}
                      onClick={() => {
                        setSelected(i);
                        setObject("");
                      }}
                    >
                      <span>{i + 1}</span>
                      <SlideCanvas
                        slide={s}
                        language={deck?.language || language}
                        template={deck?.template || template}
                        brand={deck?.brand}
                        index={i}
                      />
                      <small>{s.title}</small>
                    </button>
                  ))}
                </aside>
                <div className="studio-preview" ref={stageRef}>
                  {slide ? (
                    <>
                      <SlideCanvas
                        slide={slide}
                        language={deck?.language || language}
                        template={deck?.template || template}
                        brand={deck?.brand}
                        index={active}
                        selected={object}
                        onMeasure={measurePreview}
                        onSelect={(o) => {
                          setObject(o.id);
                          setEditTab("objects");
                        }}
                      />
                      {measurement?.slide === (slide.id || slide.title) &&
                        measurement.issues.length > 0 && (
                          <aside
                            className="studio-overflow-warning"
                            role="status"
                            aria-label="Preview clipping warnings"
                          >
                            <strong>Some text is clipped</strong>
                            <ul>
                              {measurement.issues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                            <p>
                              Shorten the text, reduce its font size or enlarge
                              the object in Properties. This check measures the
                              current browser preview; PowerPoint fonts can wrap
                              differently.
                            </p>
                          </aside>
                        )}
                      <div className="studio-reorder">
                        <button
                          disabled={active === 0}
                          onClick={() => {
                            const next = [...slides];
                            [next[active], next[active - 1]] = [
                              next[active - 1],
                              next[active],
                            ];
                            changeSlides(next);
                            setSelected(active - 1);
                          }}
                        >
                          Move up
                        </button>
                        <button
                          disabled={active >= slides.length - 1}
                          onClick={() => {
                            const next = [...slides];
                            [next[active], next[active + 1]] = [
                              next[active + 1],
                              next[active],
                            ];
                            changeSlides(next);
                            setSelected(active + 1);
                          }}
                        >
                          Move down
                        </button>
                      </div>
                      <p className="studio-preview-note">
                        16:9 preview uses saved object geometry. Fonts and chart
                        styling can differ in PowerPoint; review the exported
                        file before sharing.
                      </p>
                    </>
                  ) : (
                    <p>Slides appear here as generation saves them.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <aside className="studio-properties">
          {!id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void plan();
              }}
            >
              <h3>Customize your deck</h3>
              <label>
                Brief
                <textarea
                  required
                  minLength={20}
                  maxLength={3000}
                  rows={5}
                  value={brief}
                  placeholder="What should the audience understand?"
                  onChange={(e) => {
                    setBrief(e.target.value);
                    setDraft(null);
                  }}
                />
              </label>
              <label>
                Audience
                <input
                  value={audience}
                  maxLength={120}
                  onChange={(e) => {
                    setAudience(e.target.value);
                    setDraft(null);
                  }}
                />
              </label>
              <label>
                Format
                <select
                  value={format}
                  onChange={(e) => {
                    setFormat(e.target.value);
                    setDraft(null);
                  }}
                >
                  <option value="detailed">
                    Detailed deck · reading and learning
                  </option>
                  <option value="presenter">
                    Presenter slides · concise talking points
                  </option>
                </select>
              </label>
              <label>
                Language
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    setDraft(null);
                  }}
                >
                  {[
                    "english",
                    "hindi",
                    "hinglish",
                    "german",
                    "french",
                    "spanish",
                  ].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label>
                Slide count
                <input
                  type="number"
                  min={4}
                  max={max}
                  value={count}
                  onChange={(e) => {
                    setCount(Number(e.target.value));
                    setDraft(null);
                  }}
                />
              </label>
              <fieldset>
                <legend>Visual style</legend>
                {Object.entries(DECK_TEMPLATES).map(([key, t]) => (
                  <label
                    className="studio-theme"
                    key={key}
                    style={{
                      background: "#" + t.background,
                      color: "#" + t.ink,
                    }}
                  >
                    <input
                      type="radio"
                      name="template"
                      checked={template === key}
                      onChange={() => {
                        setTemplate(key as DeckTemplate);
                        setDraft(null);
                      }}
                    />
                    {t.name}
                    <i style={{ background: "#" + t.accent }} />
                  </label>
                ))}
              </fieldset>
              <p>
                Your plan allows {max} slides. Outline planning is free;
                generation costs five credits.
              </p>
              <button className="btn dark" disabled={busy}>
                {busy ? "Preparing…" : "Prepare outline · free"}
              </button>
            </form>
          ) : slide ? (
            <>
              <h3>Slide properties</h3>
              <nav className="studio-tabs" aria-label="Properties">
                {[
                  "content",
                  "objects",
                  "design",
                  "export",
                  "history",
                  "discussion",
                ].map((t) => (
                  <button
                    key={t}
                    aria-pressed={editTab === t}
                    onClick={() => setEditTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </nav>
              {editTab === "content" && (
                <>
                  <label>
                    Title
                    <input
                      value={slide.title}
                      maxLength={110}
                      onChange={(e) =>
                        changeSlide({
                          title: e.target.value,
                          objects: slide.objects?.map((o) =>
                            o.id === "title-box"
                              ? { ...o, text: e.target.value }
                              : o,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Layout
                    <select
                      value={slide.layout}
                      onChange={(e) => {
                        const layout = e.target.value as DeckSlide["layout"];
                        changeSlide({
                          layout,
                          objects: undefined,
                          ...(["comparison", "case"].includes(layout) &&
                          !slide.columns.length
                            ? {
                                columns: [
                                  { title: "First", points: ["Point"] },
                                  { title: "Second", points: ["Point"] },
                                ],
                              }
                            : {}),
                          ...(["process", "timeline"].includes(layout) &&
                          !slide.steps.length
                            ? { steps: ["First step", "Next step"] }
                            : {}),
                          ...(layout === "table" && !slide.table.length
                            ? {
                                table: [
                                  ["Label", "Value"],
                                  ["Item", ""],
                                ],
                              }
                            : {}),
                          ...(layout === "chart" && !slide.chart
                            ? {
                                chart: {
                                  labels: ["First", "Second"],
                                  values: [0, 0],
                                  label: "Add units",
                                },
                              }
                            : {}),
                        });
                      }}
                    >
                      {SLIDE_LAYOUTS.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Changing layout resets canvas objects. Undo can restore
                    them.
                  </p>
                  <label>
                    Subtitle
                    <textarea
                      value={slide.subtitle}
                      maxLength={220}
                      rows={2}
                      onChange={(e) =>
                        changeSlide({
                          subtitle: e.target.value,
                          objects: slide.objects?.map((o) =>
                            o.id === "subtitle-box"
                              ? { ...o, text: e.target.value }
                              : o,
                          ),
                        })
                      }
                    />
                  </label>
                  {![
                    "table",
                    "chart",
                    "process",
                    "timeline",
                    "comparison",
                    "image",
                  ].includes(slide.layout) && (
                    <label>
                      Points, one per line
                      <textarea
                        value={slide.bullets.join("\n")}
                        rows={6}
                        onChange={(e) =>
                          changeSlide({
                            bullets: e.target.value.split("\n").slice(0, 5),
                            objects: undefined,
                          })
                        }
                      />
                    </label>
                  )}
                  {["process", "timeline"].includes(slide.layout) && (
                    <label>
                      Steps
                      <textarea
                        value={slide.steps.join("\n")}
                        rows={5}
                        onChange={(e) =>
                          changeSlide({
                            steps: e.target.value.split("\n").slice(0, 5),
                            objects: undefined,
                          })
                        }
                      />
                    </label>
                  )}
                  {["comparison", "case"].includes(slide.layout) &&
                    slide.columns.map((c, i) => (
                      <fieldset key={i}>
                        <legend>Column {i + 1}</legend>
                        <input
                          aria-label={`Column ${i + 1} heading`}
                          value={c.title}
                          onChange={(e) =>
                            changeSlide({
                              columns: slide.columns.map((o, j) =>
                                j === i ? { ...o, title: e.target.value } : o,
                              ),
                              objects: undefined,
                            })
                          }
                        />
                        <textarea
                          aria-label={`Column ${i + 1} points`}
                          value={c.points.join("\n")}
                          onChange={(e) =>
                            changeSlide({
                              columns: slide.columns.map((o, j) =>
                                j === i
                                  ? {
                                      ...o,
                                      points: e.target.value
                                        .split("\n")
                                        .slice(0, 4),
                                    }
                                  : o,
                              ),
                              objects: undefined,
                            })
                          }
                        />
                      </fieldset>
                    ))}
                  {slide.layout === "table" && (
                    <>
                      <div className="studio-grid-input">
                        <table>
                          <tbody>
                            {slide.table.map((row, i) => (
                              <tr key={i}>
                                {row.map((cell, j) => (
                                  <td key={j}>
                                    <input
                                      aria-label={`Row ${i + 1}, column ${j + 1}`}
                                      value={cell}
                                      maxLength={100}
                                      onChange={(e) =>
                                        changeSlide({
                                          table: slide.table.map((r, n) =>
                                            n === i
                                              ? r.map((v, k) =>
                                                  k === j ? e.target.value : v,
                                                )
                                              : r,
                                          ),
                                        })
                                      }
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        disabled={slide.table.length >= 6}
                        onClick={() =>
                          changeSlide({
                            table: [
                              ...slide.table,
                              slide.table[0].map(() => ""),
                            ],
                          })
                        }
                      >
                        ＋ Row
                      </button>
                      <button
                        disabled={(slide.table[0]?.length || 0) >= 4}
                        onClick={() =>
                          changeSlide({
                            table: slide.table.map((r) => [...r, ""]),
                          })
                        }
                      >
                        ＋ Column
                      </button>
                      <button
                        disabled={slide.table.length <= 2}
                        onClick={() =>
                          changeSlide({ table: slide.table.slice(0, -1) })
                        }
                      >
                        Remove row
                      </button>
                    </>
                  )}
                  {slide.layout === "chart" && slide.chart && (
                    <>
                      <label>
                        Series label and units
                        <input
                          value={slide.chart.label}
                          maxLength={70}
                          onChange={(e) =>
                            changeSlide({
                              chart: { ...slide.chart!, label: e.target.value },
                            })
                          }
                        />
                      </label>
                      {slide.chart.labels.map((l, i) => (
                        <div
                          className="studio-chart-input"
                          key={`${slide.id}-${i}`}
                        >
                          <input
                            aria-label={`Chart category ${i + 1}`}
                            value={l}
                            maxLength={35}
                            onChange={(e) =>
                              changeSlide({
                                chart: {
                                  ...slide.chart!,
                                  labels: slide.chart!.labels.map((v, j) =>
                                    j === i ? e.target.value : v,
                                  ),
                                },
                              })
                            }
                          />
                          <input
                            aria-label={`Chart value ${i + 1}`}
                            type="number"
                            step="any"
                            key={`${slide.id}-${i}-${slide.chart!.values[i]}`}
                            defaultValue={slide.chart!.values[i]}
                            onBlur={(e) => {
                              const value = Number(e.target.value);
                              if (
                                !e.target.value.trim() ||
                                !Number.isFinite(value) ||
                                Math.abs(value) >= 1e12
                              ) {
                                setMessage(
                                  "Enter a finite number under one trillion; negative values are supported.",
                                );
                                e.target.value = String(slide.chart!.values[i]);
                                return;
                              }
                              changeSlide({
                                chart: {
                                  ...slide.chart!,
                                  values: slide.chart!.values.map((v, j) =>
                                    j === i ? value : v,
                                  ),
                                },
                              });
                            }}
                          />
                        </div>
                      ))}
                      <button
                        disabled={slide.chart.labels.length >= 6}
                        onClick={() =>
                          changeSlide({
                            chart: {
                              ...slide.chart!,
                              labels: [...slide.chart!.labels, "New category"],
                              values: [...slide.chart!.values, 0],
                            },
                          })
                        }
                      >
                        ＋ Data row
                      </button>
                      <button
                        disabled={slide.chart.labels.length <= 2}
                        onClick={() =>
                          changeSlide({
                            chart: {
                              ...slide.chart!,
                              labels: slide.chart!.labels.slice(0, -1),
                              values: slide.chart!.values.slice(0, -1),
                            },
                          })
                        }
                      >
                        Remove data row
                      </button>
                      <p>
                        Charts include a real zero baseline for positive and
                        negative values.
                      </p>
                    </>
                  )}
                  {slide.layout === "image" && (
                    <label>
                      Add private image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadImage(f);
                        }}
                      />
                    </label>
                  )}
                  <label>
                    Speaker notes
                    <textarea
                      value={slide.notes}
                      maxLength={1800}
                      rows={5}
                      onChange={(e) => changeSlide({ notes: e.target.value })}
                    />
                  </label>
                  <fieldset>
                    <legend>Supplied evidence</legend>
                    {deck?.sources?.map((s) => (
                      <label key={s.id}>
                        <input
                          type="checkbox"
                          checked={slide.evidence?.includes(s.id) || false}
                          onChange={(e) =>
                            changeSlide({
                              evidence: e.target.checked
                                ? [...(slide.evidence || []), s.id]
                                : (slide.evidence || []).filter(
                                    (v) => v !== s.id,
                                  ),
                              citations: e.target.checked
                                ? [...slide.citations, s.name]
                                : slide.citations.filter((v) => v !== s.name),
                            })
                          }
                        />
                        {s.name}
                      </label>
                    ))}
                  </fieldset>
                  <label>
                    Improve this slide
                    <input
                      maxLength={1000}
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={regenConsent}
                      onChange={(e) => setRegenConsent(e.target.checked)}
                    />
                    Approve one-credit regeneration; failures refund it.
                  </label>
                  <button
                    disabled={
                      busy ||
                      dirty ||
                      !regenConsent ||
                      !slide.id ||
                      regen.some((r) =>
                        ["queued", "working"].includes(r.status),
                      )
                    }
                    onClick={() =>
                      void patch({
                        action: "regenerate",
                        slide: slide.id,
                        instruction,
                        event:
                          regenerationRequest.current ||
                          (regenerationRequest.current = crypto.randomUUID()),
                        confirmCredits: true,
                      })
                    }
                  >
                    Regenerate selected slide · 1 credit
                  </button>
                  {regen.map((r) => (
                    <p key={r.id}>
                      {r.status}
                      {r.error ? `: ${r.error}` : ""}
                    </p>
                  ))}
                </>
              )}
              {editTab === "objects" && (
                <>
                  <p>
                    Select an object on the canvas. Position and size use
                    percentages; keyboard inputs offer an alternative to
                    dragging.
                  </p>
                  <button
                    onClick={() => {
                      const next: SlideObject = {
                        id: crypto.randomUUID(),
                        type: "text",
                        text: "New text",
                        x: 10,
                        y: 40,
                        w: 70,
                        h: 15,
                        fontSize: 24,
                        bold: false,
                        color: "#" + theme.ink,
                        align: "left",
                      };
                      changeSlide({ objects: [...objects, next] });
                      setObject(next.id);
                    }}
                  >
                    ＋ Text box
                  </button>
                  {selectedObject && (
                    <>
                      <label>
                        Text
                        <textarea
                          aria-label="Object text"
                          value={selectedObject.text}
                          rows={4}
                          maxLength={1500}
                          disabled={selectedObject.type === "image"}
                          onChange={(e) =>
                            changeObject({ text: e.target.value })
                          }
                        />
                      </label>
                      <div className="studio-position">
                        {["x", "y", "w", "h", "fontSize"].map((field) => (
                          <label key={field}>
                            {
                              (
                                {
                                  x: "Left %",
                                  y: "Top %",
                                  w: "Width %",
                                  h: "Height %",
                                  fontSize: "Font pt",
                                } as any
                              )[field]
                            }
                            <input
                              aria-label={
                                (
                                  {
                                    x: "Left %",
                                    y: "Top %",
                                    w: "Width %",
                                    h: "Height %",
                                    fontSize: "Font pt",
                                  } as Record<string, string>
                                )[field]
                              }
                              type="number"
                              min={field === "fontSize" ? 10 : 0}
                              max={field === "fontSize" ? 72 : 100}
                              value={(selectedObject as any)[field]}
                              onChange={(e) =>
                                changeObject({
                                  [field]: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <label>
                        Text colour
                        <input
                          type="color"
                          value={selectedObject.color}
                          onChange={(e) =>
                            changeObject({ color: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Alignment
                        <select
                          aria-label="Object alignment"
                          value={selectedObject.align}
                          onChange={(e) =>
                            changeObject({ align: e.target.value as any })
                          }
                        >
                          <option>left</option>
                          <option>center</option>
                          <option>right</option>
                        </select>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedObject.bold}
                          onChange={(e) =>
                            changeObject({ bold: e.target.checked })
                          }
                        />
                        Bold
                      </label>
                      <button
                        onClick={() =>
                          changeSlide({
                            objects: objects.filter((o) => o.id !== object),
                          })
                        }
                      >
                        Remove object
                      </button>
                    </>
                  )}
                </>
              )}
              {editTab === "design" && (
                <>
                  <h4>Reusable brand kits</h4>
                  {kits.map((k) => (
                    <button
                      disabled={busy || dirty}
                      key={k.id}
                      onClick={() =>
                        void patch({
                          action: "brand",
                          brand: k,
                          expectedUpdatedAt: deck?.updatedAt,
                        })
                      }
                    >
                      {k.name} · v{k.version}
                    </button>
                  ))}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const values = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      setBusy(true);
                      try {
                        const { response, data } = await requestJson(
                          "/api/presentations/brands",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              ...values,
                              background: String(values.background).slice(1),
                              ink: String(values.ink).slice(1),
                              accent: String(values.accent).slice(1),
                              version: 0,
                            }),
                          },
                        );
                        if (!response.ok) throw new Error(data.error);
                        setKits(data.kits);
                      } catch (err) {
                        setMessage(String(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Kit name
                      <input name="name" required maxLength={60} />
                    </label>
                    {["background", "ink", "accent"].map((c) => (
                      <label key={c}>
                        {c}
                        <input
                          type="color"
                          name={c}
                          defaultValue={"#" + (theme as any)[c]}
                        />
                      </label>
                    ))}
                    <label>
                      Font
                      <select name="font">
                        {["Arial", "Aptos", "Georgia", "Nirmala UI"].map(
                          (f) => (
                            <option key={f}>{f}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <button disabled={busy}>Save kit</button>
                  </form>
                  <p>
                    Fonts require compatible fonts in the recipient’s
                    presentation application; fallback can change wrapping.
                  </p>
                  <h4>Quality checklist</h4>
                  {slideQuality(slide, theme).length ? (
                    <ul>
                      {slideQuality(slide, theme).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      No deterministic warning found. Review factual accuracy
                      separately.
                    </p>
                  )}
                </>
              )}
              {editTab === "export" && (
                <>
                  <h4>Export centre</h4>
                  <p>
                    Save changes before export. PPTX contains editable text,
                    tables, charts and private speaker notes.
                  </p>
                  <a
                    className={`btn dark ${dirty ? "disabled" : ""}`}
                    aria-disabled={dirty || deck?.status !== "done"}
                    href={
                      !dirty && deck?.status === "done"
                        ? `/api/presentations/${id}/export`
                        : undefined
                    }
                  >
                    Download editable PPTX
                  </a>
                  <p>
                    PDF and slide images use the saved canvas. Animated
                    transitions and media playback are not exported.
                  </p>
                  <a
                    className="btn light"
                    href={
                      !dirty && deck?.status === "done"
                        ? `/api/presentations/${id}/export?format=pdf`
                        : undefined
                    }
                  >
                    Download slide PDF
                  </a>
                  <a
                    className="btn light"
                    href={
                      !dirty && deck?.status === "done"
                        ? `/api/presentations/${id}/export?format=notes`
                        : undefined
                    }
                  >
                    Speaker notes handout
                  </a>
                  <a
                    className="btn light"
                    href={
                      !dirty && deck?.status === "done"
                        ? `/api/presentations/${id}/export?format=png&slide=${active}`
                        : undefined
                    }
                  >
                    Selected slide image
                  </a>
                  <button
                    disabled={busy || dirty || deck?.status !== "done"}
                    onClick={() => void patch({ action: "share" })}
                  >
                    Create 7-day viewing link
                  </button>
                  {shareUrl && (
                    <p>
                      <a href={shareUrl}>{shareUrl}</a>
                    </p>
                  )}
                  <p>
                    Viewing links include slide content and images. Private
                    notes and extracted source text stay excluded.
                  </p>
                  {shares.map((s) => (
                    <div key={s.id}>
                      <small>
                        Expires {new Date(s.expires).toLocaleDateString()}
                      </small>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void patch({ action: "revoke-share", share: s.id })
                        }
                      >
                        Revoke link
                      </button>
                    </div>
                  ))}
                </>
              )}
              {editTab === "discussion" && (
                <>
                  <h3>Discussion on slide {active + 1}</h3>
                  {comments
                    .filter((c) => c.slide === slide.id)
                    .map((c) => (
                      <article className="studio-source" key={c.id}>
                        <b>{c.name}</b>
                        <p>{c.text}</p>
                        <small>{new Date(c.at).toLocaleString()}</small>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void patch({
                              action: "delete-comment",
                              comment: c.id,
                            })
                          }
                        >
                          Remove comment
                        </button>
                      </article>
                    ))}
                  <label>
                    Comment
                    <textarea
                      maxLength={1000}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy || !comment.trim() || dirty}
                    onClick={() =>
                      void patch({
                        action: "comment",
                        slide: slide.id,
                        text: comment,
                        event: crypto.randomUUID(),
                      }).then((ok) => {
                        if (ok) setComment("");
                      })
                    }
                  >
                    Post comment
                  </button>
                  <p>
                    Comments are visible to people with an active share link.
                    Keep private source text out of the discussion.
                  </p>
                </>
              )}
              {editTab === "history" && (
                <>
                  {!!rehearsals.length && (
                    <>
                      <h3>Recent rehearsals</h3>
                      {rehearsals.slice(0, 5).map((r) => (
                        <p key={r.id}>
                          {new Date(r.at).toLocaleString()} ·{" "}
                          {Math.floor(r.seconds / 60)}m {r.seconds % 60}s ·{" "}
                          {r.slides} slides
                        </p>
                      ))}
                    </>
                  )}
                  <button
                    disabled={busy || dirty || deck?.status !== "done"}
                    onClick={() => void patch({ action: "duplicate" })}
                  >
                    Duplicate deck · no generation charge
                  </button>
                  {deck?.history?.map((h) => (
                    <div key={h.id}>
                      <h4>{h.label}</h4>
                      <small>{new Date(h.at).toLocaleString()}</small>
                      <button
                        disabled={busy || dirty}
                        onClick={() =>
                          void patch({
                            action: "restore",
                            version: h.id,
                            expectedUpdatedAt: deck.updatedAt,
                          })
                        }
                      >
                        Restore this version
                      </button>
                    </div>
                  ))}
                  {!deck?.history?.length && (
                    <p>Versions are created when you save edits.</p>
                  )}
                </>
              )}
            </>
          ) : (
            <p>Properties appear when a slide is saved.</p>
          )}
        </aside>
      </div>
      {presenting && slide && (
        <div
          className="studio-presenter"
          role="dialog"
          aria-modal="true"
          aria-label="Presentation mode"
        >
          <div className="presenter-audience">
            <SlideCanvas
              slide={slide}
              language={deck?.language || language}
              template={deck?.template || template}
              brand={deck?.brand}
              index={active}
            />
          </div>
          <aside>
            <p>
              {active + 1}/{slides.length} · {Math.floor(elapsed / 60)}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
            <h3>Private presenter notes</h3>
            <p>{slide.notes || "No notes for this slide."}</p>
            <p>
              Share the separate audience window. Speaker notes stay in this
              presenter window.
            </p>
            <button onClick={openAudience}>Open audience window</button>
            <button
              disabled={busy || elapsed < 1}
              onClick={async () => {
                setBusy(true);
                try {
                  const { response, data } = await requestJson(
                    `/api/presentations/${id}/rehearsals`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        seconds: elapsed,
                        event: rehearsalEvent.current,
                      }),
                    },
                  );
                  if (!response.ok) throw new Error(data.error);
                  setRehearsals(data.rehearsals);
                  setMessage("Rehearsal timing saved. No audio was recorded.");
                } catch (e) {
                  setMessage(
                    e instanceof Error
                      ? e.message
                      : "Could not save rehearsal.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save rehearsal timing
            </button>
            {message && <p role="status">{message}</p>}
            <button
              disabled={active === 0}
              onClick={() => setSelected((i) => i - 1)}
            >
              Previous
            </button>
            <button
              disabled={active === slides.length - 1}
              onClick={() => setSelected((i) => i + 1)}
            >
              Next
            </button>
            <button onClick={() => setPresenting(false)}>Exit · Esc</button>
          </aside>
        </div>
      )}
    </section>
  );
}
