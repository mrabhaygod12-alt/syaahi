"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  Save,
  FileText,
  SlidersHorizontal,
  BookOpen,
  Check,
  ShieldCheck,
  RotateCcw,
  Orbit,
  Volume2,
  VolumeX,
  MessageSquare,
  Sparkles,
  History,
  Link2,
  MoveUp,
  MoveDown,
  X,
  Upload,
  ZoomIn,
} from "lucide-react";
import { useAccount } from "@/components/WorkspaceProvider";
import { requestJson } from "@/lib/http-client";
import type { Deck } from "@/lib/presentations/store";
import type { DeckSlide } from "@/lib/presentations/model";
import {
  VISUAL_ENGINES,
  VISUAL_METAPHORS,
  type FactCitation,
  type SlideManifest,
  type DesignGenome,
} from "@/lib/presentations/hybrid/model";
import UniversalStage, { type StageStats } from "./UniversalStage";
import SourceInspector from "./SourceInspector";
import { StudioDialog } from "./StudioShell";
import { GenomePicker } from "./StudioHome";
import SlideCanvas from "../SlideCanvas";
type Panel = "design" | "sources" | "notes" | "ask";
type Modal = "export" | "share" | "history" | "regenerate" | "quality" | null;
export default function StudioWorkbench({ id }: { id?: string }) {
  const { user, loading } = useAccount(),
    [deck, setDeck] = useState<Deck | null>(null),
    [slides, setSlides] = useState<DeckSlide[]>([]),
    [active, setActive] = useState(0),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [saveState, setSaveState] = useState("Saved"),
    [error, setError] = useState(""),
    [panel, setPanel] = useState<Panel>("design"),
    [modal, setModal] = useState<Modal>(null),
    [fact, setFact] = useState<FactCitation | null>(null),
    [presenting, setPresenting] = useState(false),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [orbit, setOrbit] = useState(false),
    [camera, setCamera] = useState(0),
    [stats, setStats] = useState<StageStats>({
      fps: null,
      renderer: "vector",
      buffers: null,
      detail: "",
    }),
    [voice, setVoice] = useState(false),
    [wordEmphasis, setWordEmphasis] = useState(0),
    [zoom, setZoom] = useState(1),
    [shares, setShares] = useState<any[]>([]),
    [shareUrl, setShareUrl] = useState(""),
    [comments, setComments] = useState<any[]>([]),
    [comment, setComment] = useState(""),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<{
      facts: FactCitation[];
      note: string;
      mode: string;
    } | null>(null),
    [instruction, setInstruction] = useState(""),
    [regenApproved, setRegenApproved] = useState(false),
    [pane, setPane] = useState("stage"),
    [media, setMedia] = useState<any[]>([]),
    [mediaConfig, setMediaConfig] = useState<any>({}),
    [mediaBusy, setMediaBusy] = useState(false);
  const [regenerations, setRegenerations] = useState<
    Array<{ id: string; status: string; error?: string }>
  >([]);
  const [audioBeat, setAudioBeat] = useState(0),
    [neuralBusy, setNeuralBusy] = useState(false),
    [neuralPlaying, setNeuralPlaying] = useState(false);
  const audio = useRef<{
      context: AudioContext;
      source: AudioBufferSourceNode;
      raf: number;
    } | null>(null),
    identity = useRef(""),
    timeRef = useRef(0);
  identity.current = (user?.id || "") + ":" + id;
  timeRef.current = time;
  function stopNeural() {
    const current = audio.current;
    if (current) {
      cancelAnimationFrame(current.raf);
      try {
        current.source.stop();
      } catch {}
      void current.context.close();
      audio.current = null;
    }
    setNeuralPlaying(false);
    setAudioBeat(0);
  }
  useEffect(
    () => () => {
      const current = audio.current;
      if (current) {
        cancelAnimationFrame(current.raf);
        try {
          current.source.stop();
        } catch {}
        void current.context.close();
        audio.current = null;
      }
    },
    [active, id, user?.id],
  );
  async function neural() {
    if (neuralPlaying) {
      stopNeural();
      return;
    }
    if (!manifest) return;
    const session = identity.current;
    let context: AudioContext | undefined;
    setNeuralBusy(true);
    setError("");
    try {
      context = new AudioContext();
      await context.resume();
      const { response, data } = await requestJson(
        `/api/presentations/${id}/narration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slide: manifest.id }),
        },
        55000,
      );
      if (!response.ok) throw new Error(data.error);
      if (identity.current !== session) {
        void context.close();
        return;
      }
      const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0)),
        buffer = await context.decodeAudioData(bytes.buffer);
      if (identity.current !== session) {
        void context.close();
        return;
      }
      const source = context.createBufferSource(),
        analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.buffer = buffer;
      source.connect(analyser);
      analyser.connect(context.destination);
      const samples = new Uint8Array(analyser.fftSize),
        started = context.currentTime;
      audio.current = { context, source, raf: 0 };
      source.onended = stopNeural;
      source.start();
      setNeuralPlaying(true);
      const tick = () => {
        if (!audio.current) return;
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(
            samples.reduce((n, v) => n + ((v - 128) / 128) ** 2, 0) /
              samples.length,
          ),
          t = context!.currentTime - started;
        setAudioBeat(Math.min(1, rms * 5));
        setWordEmphasis(
          data.timestamps.some(
            (w: { start: number; end: number }) => t >= w.start && t <= w.end,
          )
            ? 1
            : 0,
        );
        audio.current.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      if (context && !audio.current) void context.close();
      if (identity.current === session) setError((e as Error).message);
    } finally {
      if (identity.current === session) setNeuralBusy(false);
    }
  }
  const dirtyRef = useRef(false),
    version = useRef(0),
    inflight = useRef(false),
    request = useRef<AbortController | null>(null),
    deckRef = useRef<Deck | null>(null),
    stageRef = useRef<HTMLDivElement>(null),
    logoRef = useRef<HTMLInputElement>(null),
    sceneRef = useRef<HTMLInputElement>(null),
    drag = useRef(-1),
    mounted = useRef(true);
  deckRef.current = deck;
  dirtyRef.current = dirty;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      const { response, data } = await requestJson(
        `/api/presentations/${id}`,
        { signal },
        25000,
      );
      if (!response.ok) throw new Error(data.error);
      if (signal?.aborted) return;
      setDeck(data.deck);
      if (!dirtyRef.current) setSlides(data.deck.slides);
      setShares(data.shares || []);
      setComments(data.comments || []);
      setMedia(data.exports || []);
      setRegenerations(data.regenerations || []);
      setMediaConfig(data.media || {});
      setActive((n) => Math.min(n, Math.max(0, data.deck.slides.length - 1)));
    },
    [id],
  );
  useEffect(() => {
    mounted.current = true;
    request.current?.abort();
    setDeck(null);
    setSlides([]);
    setDirty(false);
    setError("");
    setModal(null);
    setFact(null);
    setVoice(false);
    setRegenerations([]);
    version.current = 0;
    if (!user || !id) return;
    const controller = new AbortController();
    request.current = controller;
    void load(controller.signal).catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => {
      mounted.current = false;
      controller.abort();
      window.speechSynthesis?.cancel();
    };
  }, [id, user?.id, load]);
  const working = !!deck && ["queued", "working"].includes(deck.status);
  const refining = regenerations.some((r) =>
    ["queued", "working"].includes(r.status),
  );
  useEffect(() => {
    if (
      !user ||
      !id ||
      (!working &&
        !refining &&
        !media.some((j) => ["queued", "working"].includes(j.status)))
    )
      return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await load(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 1000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    working,
    refining,
    user?.id,
    id,
    load,
    media.some((j) => ["queued", "working"].includes(j.status)),
  ]);
  const current = slides[active],
    manifest = current?.manifest;
  const edit = (next: DeckSlide[]) => {
    version.current++;
    setSlides(next);
    setDirty(true);
    setSaveState("Unsaved changes");
  };
  const patch = (update: Partial<SlideManifest>) => {
    if (!manifest) return;
    const next = { ...manifest, ...update };
    edit(
      slides.map((s, i) =>
        i === active
          ? {
              ...s,
              title: next.headline,
              subtitle: next.category,
              notes: next.notes,
              bullets: next.facts.map((f) => f.statement),
              manifest: next,
            }
          : s,
      ),
    );
  };
  const save = useCallback(
    async (confirmCredits = false) => {
      const session = identity.current;
      const current = deckRef.current;
      if (
        inflight.current ||
        !current ||
        !["done", "error"].includes(current.status) ||
        !dirtyRef.current
      )
        return;
      if (
        current.status === "error" &&
        (current.creditsReserved ?? 5) > 0 &&
        !confirmCredits
      ) {
        setSaveState("Approve the displayed retry cost to apply these edits");
        return;
      }
      inflight.current = true;
      const at = version.current;
      setSaveState("Saving & checking…");
      try {
        const { response, data } = await requestJson(
          `/api/presentations/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slides,
              expectedUpdatedAt: current.updatedAt,
              confirmCredits,
            }),
          },
          30000,
        );
        if (!response.ok) throw new Error(data.error);
        if (!mounted.current || identity.current !== session) return;
        setDeck(data.deck);
        if (version.current === at) {
          setSlides(data.deck.slides);
          setDirty(false);
          setSaveState("Saved · visual checks queued");
        } else setSaveState("More changes waiting to save");
        setError("");
      } catch (e) {
        if (mounted.current && identity.current === session) {
          setError((e as Error).message);
          setSaveState("Save needs retry");
        }
      } finally {
        inflight.current = false;
      }
    },
    [id, slides],
  );
  useEffect(() => {
    if (
      !dirty ||
      !deck ||
      !(
        deck.status === "done" ||
        (deck.status === "error" && deck.creditsReserved === 0)
      )
    )
      return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [dirty, slides, save, deck?.status, deck?.updatedAt]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    setTime(0);
    setWordEmphasis(0);
    setNeuralPlaying(false);
    setAudioBeat(0);
    if (voice) {
      window.speechSynthesis?.cancel();
      setVoice(false);
    }
  }, [active]);
  useEffect(() => {
    if (!playing || !manifest) return;
    let previous = performance.now(),
      elapsed = timeRef.current;
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = (now - previous) / 1000;
      previous = now;
      elapsed += delta;
      if (elapsed >= manifest.duration) {
        if (active < slides.length - 1) setActive((i) => i + 1);
        else setPlaying(false);
        setTime(0);
        return;
      }
      setTime(elapsed);
    }, 100);
    return () => clearInterval(timer);
  }, [playing, active, manifest?.duration, slides.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        !presenting ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      )
        return;
      if (e.key === "Escape") {
        setPresenting(false);
        setPlaying(false);
      }
      if (["ArrowRight", "PageDown"].includes(e.key)) {
        e.preventDefault();
        setActive((i) => Math.min(slides.length - 1, i + 1));
      }
      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      }
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [presenting, slides.length]);
  const stableStats = useCallback((s: StageStats) => setStats(s), []);
  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(
        `/api/presentations/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        30000,
      );
      if (!response.ok) throw new Error(data.error);
      if (data.deck) {
        setDeck(data.deck);
        setSlides(data.deck.slides);
        setDirty(false);
      }
      if (data.share)
        setShareUrl(
          `${location.origin}/presentations/shared/${data.share.token}`,
        );
      await load();
      return data;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function reorder(from: number, to: number) {
    if (from < 0 || to < 0 || to >= slides.length) return;
    const next = [...slides],
      item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    edit(next);
    setActive(to);
  }
  async function ask() {
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(
        `/api/presentations/${id}/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        },
        30000,
      );
      if (!response.ok) throw new Error(data.error);
      setAnswer(data as any);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function narrate() {
    if (!manifest || typeof window.speechSynthesis === "undefined") return;
    if (voice) {
      speechSynthesis.cancel();
      setVoice(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      [manifest.headline, ...manifest.facts.map((f) => f.statement)].join(". "),
    );
    utterance.lang = /^hindi/i.test(deck?.language || "") ? "hi-IN" : "en-IN";
    utterance.onboundary = () => {
      setWordEmphasis(1);
      setTimeout(() => setWordEmphasis(0), 180);
    };
    utterance.onend = () => setVoice(false);
    utterance.onerror = () => setVoice(false);
    speechSynthesis.speak(utterance);
    setVoice(true);
  }
  async function brand(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("alt", "Brand logo for presentation theme");
      const image = await requestJson(
        "/api/presentations/assets",
        { method: "POST", body: form },
        30000,
      );
      if (!image.response.ok) throw new Error(image.data.error);
      const { response, data } = await requestJson(
        "/api/presentations/genome",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: image.data.id,
            name: file.name.replace(/\.[^.]+$/, ""),
          }),
        },
        30000,
      );
      if (!response.ok) throw new Error(data.error);
      applyGenome(data.genome);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }
  async function scene(file: File) {
    if (!manifest) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const { response, data } = await requestJson(
        "/api/presentations/scene-assets",
        { method: "POST", body: form },
        30000,
      );
      if (!response.ok) throw new Error(data.error);
      patch({
        visual: { ...manifest.visual, splineAssetId: data.id },
        visualEngine: "spline",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (sceneRef.current) sceneRef.current.value = "";
    }
  }
  function applyGenome(genome: DesignGenome) {
    edit(
      slides.map((s) =>
        s.manifest ? { ...s, manifest: { ...s.manifest, genome } } : s,
      ),
    );
  }
  async function mediaExport(format: string) {
    setMediaBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(
        `/api/presentations/${id}/exports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format, event: crypto.randomUUID() }),
        },
        30000,
      );
      if (!response.ok) throw new Error(data.error);
      setMedia((old) => [data.job, ...old.filter((j) => j.id !== data.job.id)]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMediaBusy(false);
    }
  }
  if (!id)
    return (
      <main className="cv-empty">
        <h1>Begin with a source-backed brief.</h1>
        <a className="cv-button" href="/presentations/new">
          Open the new studio
        </a>
      </main>
    );
  if (!user && !loading)
    return (
      <main className="cv-empty">
        <h1>Your presentation is private.</h1>
        <a
          className="cv-button"
          href={`/login?next=${encodeURIComponent(`/presentations/${id}`)}`}
        >
          Sign in to open it
        </a>
      </main>
    );
  if (!deck || deck.owner !== user?.id)
    return (
      <main className="cv-empty">
        <p role={error ? "alert" : "status"}>
          {error || "Opening the studio…"}
        </p>
        <a href="/presentations/library">Return to library</a>
      </main>
    );
  const ready = deck.status === "done" && !dirty && !refining,
    legacy = deck.designEngine !== 3;
  return (
    <main
      className={"cv-workbench" + (presenting ? " cv-presenting" : "")}
      data-mobile-pane={pane}
    >
      <header className="cv-document-bar">
        <a href="/presentations/library">
          <ArrowLeft size={16} />
          Your work
        </a>
        <div>
          <span className="cv-save-state" role="status">
            {dirty
              ? saveState
              : working
                ? deck.stage
                : legacy
                  ? "Saved archive · read & export"
                  : saveState}
          </span>
          {!legacy && (
            <button
              className="cv-icon-button"
              aria-label="Save presentation"
              disabled={!dirty || busy || working}
              onClick={() => void save()}
            >
              <Save size={17} />
            </button>
          )}
          <button
            className="cv-button subtle"
            onClick={() => setModal("share")}
            disabled={!ready}
          >
            <Share2 size={14} />
            Share
          </button>
          <button
            className="cv-button subtle"
            onClick={() => {
              setPresenting((p) => !p);
              setPlaying(false);
            }}
            disabled={!slides.length}
          >
            {presenting ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{presenting ? "Exit" : "Present"}</span>
          </button>
          <button
            className="cv-button primary"
            disabled={!ready}
            onClick={() => setModal("export")}
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </header>
      <nav className="cv-pane-tabs" aria-label="Editor panels">
        {["outline", "stage", "director"].map((p) => (
          <button key={p} aria-pressed={pane === p} onClick={() => setPane(p)}>
            {p === "outline" ? "Scenes" : p === "stage" ? "Stage" : "Director"}
          </button>
        ))}
      </nav>
      <aside className="cv-scene-rail">
        <div className="cv-panel-heading">
          <span className="cv-eyebrow">THE STORY / {slides.length} SCENES</span>
          <LayersIcon />
        </div>
        {slides.map((s, i) => (
          <article
            key={s.id || i}
            draggable={!legacy && !working}
            onDragStart={() => {
              drag.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              reorder(drag.current, i);
            }}
            className={active === i ? "selected" : ""}
          >
            <button
              className="cv-scene-thumb"
              onClick={() => {
                setActive(i);
                setPane("stage");
              }}
              aria-label={`Open scene ${i + 1}: ${s.title}`}
              aria-pressed={active === i}
            >
              {s.manifest ? (
                <UniversalStage
                  slide={s.manifest}
                  interactive={false}
                  index={i}
                />
              ) : (
                <div className="cv-legacy-thumb">
                  <FileText size={19} />
                  {s.title}
                </div>
              )}
            </button>
            <span>
              <b>{String(i + 1).padStart(2, "0")}</b>
              {s.title}
            </span>
          </article>
        ))}
        {working && (
          <div className="cv-scene-progress" role="status">
            <span className="cv-pulse" />
            <p>{deck.stage}</p>
            <small>
              {deck.slides.length} of {deck.count} scenes saved
            </small>
          </div>
        )}
        <a className="cv-button subtle" href="/presentations/new">
          New source brief
          <ArrowRight size={13} />
        </a>
      </aside>
      <section className="cv-stage-center">
        <header className="cv-stage-heading">
          <div>
            <span className="cv-eyebrow">
              {legacy ? "ARCHIVED PRESENTATION" : "THE UNIVERSAL STAGE"}
            </span>
            <h1>{deck.title}</h1>
          </div>
          <button className="cv-chip" onClick={() => setModal("quality")}>
            <ShieldCheck size={12} />
            {dirty
              ? "Unsaved scene edits"
              : refining
                ? "Refining scene"
                : deck.quality?.status === "passed"
                  ? "Delivery checks passed"
                  : working
                    ? "Checks pending"
                    : legacy
                      ? "Legacy archive"
                      : "Review required"}
          </button>
        </header>
        {refining && (
          <p className="cv-fineprint" role="status">
            Refining the source-backed scene. The saved version remains
            available while the new result is checked.
          </p>
        )}
        {regenerations
          .filter((r) => r.status === "error" && r.error)
          .slice(0, 1)
          .map((r) => (
            <p key={r.id} className="cv-error" role="status">
              {r.error}
            </p>
          ))}
        {error && (
          <p className="cv-error" role="alert">
            {error}
            <button
              className="cv-icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={15} />
            </button>
          </p>
        )}
        {deck.status === "error" && (
          <div className="cv-error" role="alert">
            <p>{deck.error}</p>
            <button
              className="cv-button"
              disabled={busy}
              onClick={() =>
                dirty ? void save(true) : void action({ action: "retry" })
              }
            >
              <RotateCcw size={15} />
              {dirty ? "Apply changes and retry with " : "Retry with "}
              {deck.creditsReserved ?? 5} credits
            </button>
          </div>
        )}
        <div className="cv-stage-scroll" ref={stageRef}>
          <div className="cv-stage-surface" style={{ width: `${zoom * 100}%` }}>
            {manifest ? (
              <UniversalStage
                slide={manifest}
                index={active}
                time={time}
                playing={false}
                camera={camera}
                orbit={orbit}
                wordEmphasis={wordEmphasis}
                audioBeat={audioBeat}
                onStats={stableStats}
                world={
                  presenting && !legacy
                    ? slides.map((s) => s.manifest!)
                    : undefined
                }
                onCitation={(i) => setFact(manifest.facts[i])}
              />
            ) : current ? (
              <SlideCanvas
                slide={current}
                template={deck.template}
                brand={deck.brand}
                language={deck.language}
                index={active}
              />
            ) : (
              <div className="cv-stage-placeholder">
                <Sparkles size={42} />
                <h2>From knowledge to a visual world.</h2>
                <p>{deck.stage}</p>
                <span>
                  No scene is delivered until its evidence and layout pass
                  checks.
                </span>
              </div>
            )}
          </div>
        </div>
        {manifest && (
          <details className="cv-mobile-reading">
            <summary>Read this scene</summary>
            <h2>{manifest.headline}</h2>
            {manifest.facts.map((f) => (
              <button
                className="cv-source-citation"
                key={f.id}
                onClick={() => setFact(f)}
              >
                {f.statement}
                <small>
                  {f.documentTitle}
                  {f.pageNumber ? ` · p. ${f.pageNumber}` : ""}
                </small>
              </button>
            ))}
          </details>
        )}
        <div className="cv-stage-tools">
          <div>
            <button
              className={"cv-icon-button" + (orbit ? " selected" : "")}
              aria-label="Toggle 3D orbit controls"
              aria-pressed={orbit}
              onClick={() => setOrbit((p) => !p)}
              disabled={!manifest}
            >
              <Orbit size={16} />
            </button>
            <button
              className="cv-icon-button"
              aria-label="Change stage zoom"
              onClick={() => setZoom((z) => (z >= 3 ? 1 : z + 0.5))}
            >
              <ZoomIn size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="cv-icon-button"
              aria-label={
                voice ? "Stop device narration" : "Read scene with device voice"
              }
              onClick={narrate}
              disabled={!manifest}
            >
              {voice ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
          <div className="cv-performance">
            <span className="cv-live-dot" />
            {stats.renderer}
            {stats.fps !== null
              ? ` · ${stats.fps} measured FPS`
              : " · vector view"}
            <small title={stats.detail}>
              {stats.buffers !== null
                ? `~${(stats.buffers / 1048576).toFixed(2)} MB known buffers`
                : "GPU memory not exposed"}
            </small>
          </div>
        </div>
        <div className="cv-director-timeline">
          <button
            className="cv-icon-button"
            aria-label={
              playing
                ? "Pause presentation playback"
                : "Play presentation playback"
            }
            onClick={() => setPlaying((p) => !p)}
            disabled={!manifest}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div>
            <label htmlFor="cv-time">
              Scene timeline{" "}
              <span>
                {time.toFixed(1)}s / {manifest?.duration.toFixed(1) || "0"}s
              </span>
            </label>
            <input
              id="cv-time"
              type="range"
              min="0"
              max={manifest?.duration || 1}
              step="0.1"
              value={time}
              onChange={(e) => {
                setTime(Number(e.target.value));
                setPlaying(false);
              }}
              disabled={!manifest}
            />
          </div>
          <button
            className="cv-icon-button"
            aria-label="Previous scene"
            disabled={active === 0}
            onClick={() => setActive((i) => i - 1)}
          >
            <ArrowLeft size={16} />
          </button>
          <span>
            {active + 1}/{slides.length || deck.count}
          </span>
          <button
            className="cv-icon-button"
            aria-label="Next scene"
            disabled={active >= slides.length - 1}
            onClick={() => setActive((i) => i + 1)}
          >
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="cv-camera-director">
          <label htmlFor="cv-camera">Camera director</label>
          <input
            id="cv-camera"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={camera}
            onChange={(e) => setCamera(Number(e.target.value))}
            disabled={!manifest}
          />
          <span>{Math.round(camera * 100)}%</span>
        </div>
        <div className="cv-stage-bottom">
          <span>
            Conceptual visualization · source passages supply the factual text
          </span>
          <button onClick={() => setModal("history")} disabled={!ready}>
            <History size={13} />
            Version history
          </button>
        </div>
        <div className="cv-discussion">
          <button
            className="cv-section-button"
            onClick={() => setPanel("notes")}
          >
            <FileText size={15} />
            Private speaker notes
          </button>
          <p>
            {manifest?.notes ||
              current?.notes ||
              "Select a scene to inspect its notes."}
          </p>
          <h3>
            <MessageSquare size={15} />
            Discussion
          </h3>
          {comments
            .filter((c) => c.slide === current?.id)
            .map((c) => (
              <article key={c.id}>
                <strong>{c.name}</strong>
                <p>{c.text}</p>
              </article>
            ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action({
                action: "comment",
                slide: current?.id,
                text: comment,
                event: crypto.randomUUID(),
              }).then((d) => {
                if (d) setComment("");
              });
            }}
          >
            <label>
              Your comment
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                rows={2}
                disabled={!ready}
              />
            </label>
            <button
              className="cv-button subtle"
              disabled={!comment.trim() || busy || !ready}
            >
              Post comment
            </button>
          </form>
        </div>
      </section>
      <aside className="cv-editor-director">
        <nav className="cv-director-tabs" aria-label="Director panels">
          {(
            [
              { id: "design", icon: SlidersHorizontal, label: "Design" },
              { id: "sources", icon: BookOpen, label: "Sources" },
              { id: "notes", icon: FileText, label: "Notes" },
              { id: "ask", icon: Sparkles, label: "Ask" },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              aria-label={`Open ${label} panel`}
              aria-pressed={panel === id}
              onClick={() => setPanel(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        {!manifest ? (
          <div className="cv-director-body">
            <h2>Preserved, not overwritten.</h2>
            <p>
              This is a saved presentation from the retired engine. Read,
              present or export it; use a new source brief for the redesigned
              editor.
            </p>
            <a className="cv-button" href="/presentations/new">
              Create a source-backed deck
            </a>
          </div>
        ) : (
          <div className="cv-director-body">
            {panel === "design" ? (
              <>
                <span className="cv-eyebrow">VISUAL ENGINE INSPECTOR</span>
                <h2>Direct the idea.</h2>
                <label>
                  Scene heading
                  <input
                    value={manifest.headline}
                    maxLength={100}
                    onChange={(e) => patch({ headline: e.target.value })}
                  />
                </label>
                <small className="cv-fineprint">
                  {manifest.headline.trim().split(/\s+/).length}/8 words
                </small>
                <label>
                  Renderer
                  <select
                    value={manifest.visualEngine}
                    onChange={(e) =>
                      patch({
                        visualEngine: e.target
                          .value as SlideManifest["visualEngine"],
                      })
                    }
                  >
                    {VISUAL_ENGINES.map((e) => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>
                </label>
                {manifest.visualEngine === "spline" && (
                  <div>
                    <p className="cv-fineprint">
                      An owned Spline scene asset is required. Without one, the
                      stage uses a readable vector fallback.
                    </p>
                    <input
                      ref={sceneRef}
                      type="file"
                      hidden
                      accept=".splinecode"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void scene(f);
                      }}
                    />
                    <button
                      className="cv-button subtle"
                      disabled={busy}
                      onClick={() => sceneRef.current?.click()}
                    >
                      Import .splinecode scene
                    </button>
                    <p className="cv-fineprint">
                      Binary scene export, up to 4 MB. External scene assets
                      stay restricted by the site’s content policy.
                    </p>
                  </div>
                )}
                <label>
                  Metaphor
                  <select
                    value={manifest.metaphor}
                    onChange={(e) =>
                      patch({
                        metaphor: e.target.value as SlideManifest["metaphor"],
                      })
                    }
                  >
                    {VISUAL_METAPHORS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Visual density
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={manifest.visual.density}
                    onChange={(e) =>
                      patch({
                        visual: {
                          ...manifest.visual,
                          density: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Motion speed
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={manifest.visual.speed}
                    onChange={(e) =>
                      patch({
                        visual: {
                          ...manifest.visual,
                          speed: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label className="cv-check-label">
                  <input
                    type="checkbox"
                    checked={manifest.visual.exploded}
                    onChange={(e) =>
                      patch({
                        visual: {
                          ...manifest.visual,
                          exploded: e.target.checked,
                        },
                      })
                    }
                  />
                  Exploded inspection view
                </label>
                <label>
                  Scene duration, seconds
                  <input
                    type="number"
                    min="5"
                    max="30"
                    step="0.5"
                    value={manifest.duration}
                    onChange={(e) =>
                      patch({ duration: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="cv-editor-reorder">
                  <button
                    className="cv-button subtle"
                    disabled={active === 0}
                    onClick={() => reorder(active, active - 1)}
                  >
                    <MoveUp size={13} />
                    Move up
                  </button>
                  <button
                    className="cv-button subtle"
                    disabled={active === slides.length - 1}
                    onClick={() => reorder(active, active + 1)}
                  >
                    <MoveDown size={13} />
                    Move down
                  </button>
                </div>
                <h3>Design genome</h3>
                <GenomePicker value={manifest.genome} onChange={applyGenome} />
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="cv-visually-hidden"
                  aria-label="Upload brand logo"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void brand(f);
                  }}
                />
                <button
                  className="cv-button subtle"
                  disabled={busy}
                  onClick={() => logoRef.current?.click()}
                >
                  <Upload size={14} />
                  Extract logo palette
                </button>
                <p className="cv-fineprint">
                  Palette extraction uses image pixels. Lighting and motion stay
                  editable.
                </p>
                <button
                  className="cv-button"
                  disabled={!ready || busy}
                  onClick={() => setModal("regenerate")}
                >
                  <Sparkles size={15} />
                  Refine with AI
                </button>
              </>
            ) : panel === "sources" ? (
              <>
                <span className="cv-eyebrow">EVERY CLAIM HAS A PLACE</span>
                <h2>Inspect the evidence.</h2>
                {manifest.facts.map((f, i) => (
                  <button
                    className="cv-source-citation"
                    key={f.id}
                    onClick={() => setFact(f)}
                  >
                    <span>
                      [{i + 1}] {f.documentTitle}
                    </span>
                    <p>{f.statement}</p>
                    <small>
                      {f.pageNumber
                        ? `Page ${f.pageNumber}`
                        : "Exact saved passage"}
                      <ArrowRight size={12} />
                    </small>
                  </button>
                ))}
                <p className="cv-fineprint">
                  These passages match the saved source. Cross-check the
                  original and its context when accuracy matters.
                </p>
              </>
            ) : panel === "notes" ? (
              <>
                <span className="cv-eyebrow">YOUR PRESENTER SPACE</span>
                <h2>Say the useful detail.</h2>
                <label>
                  Private speaker notes
                  <textarea
                    rows={12}
                    maxLength={1800}
                    value={manifest.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                </label>
                <p className="cv-fineprint">
                  Notes stay out of shared web views. Editable PPTX and notes
                  PDF downloads include them.
                </p>
                <button className="cv-button subtle" onClick={narrate}>
                  <Volume2 size={14} />
                  {voice ? "Stop device voice" : "Read factual scene text"}
                </button>
                <button
                  className="cv-button subtle"
                  onClick={() => void neural()}
                  disabled={!mediaConfig.narration || neuralBusy || !ready}
                >
                  {neuralBusy
                    ? "Preparing neural voice…"
                    : neuralPlaying
                      ? "Stop neural narration"
                      : "Neural voice + word sync"}
                </button>
                {!mediaConfig.narration && (
                  <p className="cv-fineprint">
                    Neural voice requires a configured Kokoro service. Device
                    voice uses your browser.
                  </p>
                )}
              </>
            ) : (
              <>
                <span className="cv-eyebrow">SPATIAL Q&A</span>
                <h2>Go one layer deeper.</h2>
                <p className="cv-fineprint">
                  Ask a question about your imported knowledge. Answers are
                  exact source passages, selected by AI when available.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask();
                  }}
                >
                  <label>
                    Question
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      maxLength={1000}
                      rows={4}
                    />
                  </label>
                  <button
                    className="cv-button"
                    disabled={busy || question.trim().length < 4}
                  >
                    <Sparkles size={14} />
                    Find supported passages
                  </button>
                </form>
                {answer && (
                  <div className="cv-answer">
                    <small>{answer.mode.replaceAll("-", " ")}</small>
                    <p>{answer.note}</p>
                    {answer.facts.map((f) => (
                      <button
                        className="cv-source-citation"
                        key={f.id}
                        onClick={() => setFact(f)}
                      >
                        {f.statement}
                        <small>{f.documentTitle}</small>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </aside>
      {fact && (
        <SourceInspector
          fact={fact}
          sources={deck.sources || []}
          onClose={() => setFact(null)}
        />
      )}
      {modal && (
        <StudioDialog
          title={
            modal === "export"
              ? "One story. Every format."
              : modal === "share"
                ? "Share a read-only deck"
                : modal === "history"
                  ? "Saved versions"
                  : modal === "quality"
                    ? "Delivery inspection report"
                    : "Refine this source-backed scene"
          }
          onClose={() => setModal(null)}
        >
          <div className="cv-modal-body">
            {modal === "export" ? (
              <>
                <p>
                  Portable formats keep the source text readable. PDF and PPTX
                  use vector illustrations; web playback includes a shader with
                  a vector fallback.
                </p>
                <div className="cv-export-grid">
                  {[
                    {
                      format: "web",
                      label: "Interactive web deck",
                      desc: "Offline HTML · keyboard navigation · private notes excluded",
                    },
                    {
                      format: "pptx",
                      label: "Editable PowerPoint",
                      desc: "Native text and vector shapes · includes speaker notes",
                    },
                    {
                      format: "pdf",
                      label: "Presentation PDF",
                      desc: "High-resolution 16:9 handout",
                    },
                    {
                      format: "png",
                      label: "Current scene PNG",
                      desc: "High-resolution image",
                    },
                    {
                      format: "notes",
                      label: "Speaker notes PDF",
                      desc: "Private notes, one scene per page",
                    },
                  ]
                    .filter((f) => !legacy || f.format !== "web")
                    .map((f) => (
                      <a
                        key={f.format}
                        href={`/api/presentations/${id}/export?format=${f.format}&slide=${active}`}
                        className="cv-export-option"
                      >
                        <Download size={18} />
                        <strong>{f.label}</strong>
                        <small>{f.desc}</small>
                      </a>
                    ))}
                </div>
                <h3>Queued video delivery</h3>
                <p className="cv-fineprint">
                  Video requires a configured rendering worker and applicable
                  Remotion license eligibility. The browser does not wait for
                  the render.
                </p>
                <div className="cv-editor-reorder">
                  <button
                    className="cv-button"
                    disabled={!mediaConfig.video || mediaBusy || legacy}
                    onClick={() => void mediaExport("mp4")}
                  >
                    4K · 60 FPS MP4
                  </button>
                  <button
                    className="cv-button subtle"
                    disabled={!mediaConfig.video || mediaBusy || legacy}
                    onClick={() => void mediaExport("vertical")}
                  >
                    9:16 vertical video
                  </button>
                </div>
                {!mediaConfig.video && (
                  <p className="cv-fineprint">
                    Video rendering is not enabled on the current worker.
                  </p>
                )}
                {media.map((j) => (
                  <article className="cv-media-job" key={j.id}>
                    <strong>
                      {j.format} · {j.status}
                    </strong>
                    <span>{j.stage || j.error}</span>
                    {["queued", "working"].includes(j.status) && (
                      <>
                        <progress
                          aria-label="Video export progress"
                          max={100}
                          value={j.progress || 0}
                        />
                        <span>{j.progress || 0}% rendered</span>
                        <button
                          className="cv-button subtle"
                          onClick={() =>
                            void requestJson(
                              `/api/presentations/${id}/exports/${j.id}`,
                              { method: "DELETE" },
                            )
                              .then(({ response, data }) => {
                                if (!response.ok) throw new Error(data.error);
                                return load();
                              })
                              .catch((e) => setError(e.message))
                          }
                        >
                          Cancel export
                        </button>
                      </>
                    )}
                    {j.status === "done" && (
                      <a
                        className="cv-button"
                        href={`/api/presentations/${id}/exports/${j.id}`}
                      >
                        Download video
                      </a>
                    )}
                  </article>
                ))}
              </>
            ) : modal === "share" ? (
              <>
                <p>
                  The link lasts seven days. Viewers receive scene content and
                  citations; private notes and full source files are excluded.
                </p>
                <button
                  className="cv-button"
                  disabled={busy}
                  onClick={() => void action({ action: "share" })}
                >
                  <Link2 size={15} />
                  Create a seven-day link
                </button>
                {shareUrl && (
                  <div>
                    <label>
                      Share URL
                      <input
                        readOnly
                        value={shareUrl}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <div className="cv-editor-reorder">
                      <a
                        className="cv-button subtle"
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open shared deck
                      </a>
                      <button
                        className="cv-button subtle"
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(shareUrl)
                            .catch(() =>
                              setError(
                                "Copy the selected share URL from the field above.",
                              ),
                            )
                        }
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                )}
                {shares.map((s) => (
                  <div className="cv-share-row" key={s.id}>
                    <small>
                      Expires {new Date(s.expires).toLocaleString()}
                    </small>
                    <button
                      className="cv-button subtle"
                      disabled={busy}
                      onClick={() =>
                        void action({ action: "revoke-share", share: s.id })
                      }
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </>
            ) : modal === "history" ? (
              <>
                {deck.history?.length ? (
                  deck.history.map((h) => (
                    <article className="cv-history-row" key={h.id}>
                      <div>
                        <strong>{h.label}</strong>
                        <small>{new Date(h.at).toLocaleString()}</small>
                      </div>
                      <button
                        className="cv-button subtle"
                        disabled={busy}
                        onClick={() =>
                          void action({
                            action: "restore",
                            version: h.id,
                            expectedUpdatedAt: deck.updatedAt,
                          }).then((d) => {
                            if (d) setModal(null);
                          })
                        }
                      >
                        Restore
                      </button>
                    </article>
                  ))
                ) : (
                  <p>
                    No earlier versions yet. Your next saved edit creates a
                    snapshot.
                  </p>
                )}
              </>
            ) : modal === "quality" ? (
              <>
                <span className="cv-chip">
                  {deck.quality?.status || "No new-engine report"}
                </span>
                {deck.quality?.checks.map((c) => (
                  <article className="cv-quality-row" key={c.name}>
                    <strong>
                      {c.status === "passed" ? (
                        <Check size={15} />
                      ) : (
                        <ShieldCheck size={15} />
                      )}{" "}
                      {c.name}
                      <small>{c.status}</small>
                    </strong>
                    <p>{c.detail}</p>
                  </article>
                ))}
                <p className="cv-fineprint">
                  Checks describe what ran. No universal zero-crash,
                  hallucination-free or fixed-FPS guarantee is implied.
                </p>
              </>
            ) : (
              <>
                <label>
                  What should change?
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    maxLength={1000}
                    rows={5}
                    placeholder="Focus this scene on the strongest evidence and use a network visual…"
                  />
                </label>
                <label className="cv-check-label">
                  <input
                    type="checkbox"
                    checked={regenApproved}
                    onChange={(e) => setRegenApproved(e.target.checked)}
                  />
                  Reserve one credit. Unsupported output is rejected and the
                  credit returned.
                </label>
                <button
                  className="cv-button primary"
                  disabled={
                    !regenApproved || busy || instruction.trim().length < 5
                  }
                  onClick={() =>
                    void action({
                      action: "regenerate",
                      slide: current?.id,
                      instruction,
                      event: crypto.randomUUID(),
                      confirmCredits: true,
                    }).then((d) => {
                      if (d) {
                        setModal(null);
                        setInstruction("");
                        setRegenApproved(false);
                      }
                    })
                  }
                >
                  <Sparkles size={15} />
                  Refine scene
                </button>
              </>
            )}
            {error && (
              <p className="cv-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </StudioDialog>
      )}
    </main>
  );
}
function LayersIcon() {
  return <SlidersHorizontal size={15} />;
}
