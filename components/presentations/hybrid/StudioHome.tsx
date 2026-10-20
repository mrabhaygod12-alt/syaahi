"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Sparkles,
  Search,
  Play,
  ShieldCheck,
  Layers3,
  ArrowRight,
  Check,
  FileText,
  Plus,
  LoaderCircle,
} from "lucide-react";
import { useAccount } from "@/components/WorkspaceProvider";
import { requestJson } from "@/lib/http-client";
import {
  GENOMES,
  hybridCredits,
  type DesignGenome,
} from "@/lib/presentations/hybrid/model";
import type { Deck } from "@/lib/presentations/store";
import UniversalStage from "./UniversalStage";
import SourceHub, { type SourceRef } from "./SourceHub";
import { studioExample } from "./examples";
type Task = {
  id: string;
  status: string;
  stage: string;
  draftId?: string;
  error?: string;
  canRetry?: boolean;
  retryAt?: number;
};
export function GenomePicker({
  value,
  onChange,
}: {
  value: DesignGenome;
  onChange: (g: DesignGenome) => void;
}) {
  return (
    <div
      className="cv-genome-picker"
      role="group"
      aria-label="Brand design direction"
    >
      {GENOMES.map((g) => (
        <button
          type="button"
          key={g.name}
          aria-pressed={g.name === value.name}
          onClick={() => onChange(g)}
        >
          <span style={{ background: g.canvas, color: g.ink }}>
            <i style={{ background: g.accent }} />
            <b>Aa</b>
            {g.name === value.name && <Check size={12} />}
          </span>
          <small>{g.name}</small>
        </button>
      ))}
    </div>
  );
}
export default function StudioHome({
  view = "create",
}: {
  view?: "create" | "library" | "templates";
}) {
  const { user, loading } = useAccount(),
    [sources, setSources] = useState<SourceRef[]>([]),
    [prompt, setPrompt] = useState(""),
    [audience, setAudience] = useState("University learners"),
    [language, setLanguage] = useState("english"),
    [count, setCount] = useState(6),
    [credits, setCredits] = useState(0),
    [max, setMax] = useState(6),
    [genome, setGenome] = useState(GENOMES[0]),
    [research, setResearch] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [task, setTask] = useState<Task | null>(null),
    [decks, setDecks] = useState<Deck[]>([]),
    [drafts, setDrafts] = useState<any[]>([]),
    [filter, setFilter] = useState(""),
    [pane, setPane] = useState("brief"),
    [briefOwner, setBriefOwner] = useState("");
  const pending = useRef<AbortController | null>(null),
    event = useRef("");
  useEffect(() => {
    pending.current?.abort();
    setSources([]);
    setTask(null);
    setDecks([]);
    setDrafts([]);
    setError("");
    setPrompt("");
    setCredits(0);
    event.current = "";
    if (!user) {
      setBriefOwner("");
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    try {
      setPrompt(localStorage.getItem(`syaahi-hybrid-brief:${user.id}`) || "");
      setBriefOwner(user.id);
      const saved = localStorage.getItem(`syaahi-hybrid-task:${user.id}`);
      if (saved)
        setTask({
          id: saved,
          status: "queued",
          stage: "Reconnecting to saved research…",
        });
    } catch {}
    void requestJson("/api/presentations", { signal: controller.signal })
      .then(({ response, data }) => {
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(data.error);
        setDecks(data.decks || []);
        setDrafts((data.drafts || []).filter((d: any) => d.designEngine === 3));
        setCredits(data.credits || 0);
        setMax(data.maxSlides || 6);
        setCount((n) => Math.min(n, data.maxSlides || 6));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [user?.id]);
  useEffect(() => {
    if (!user || briefOwner !== user.id) return;
    try {
      localStorage.setItem(`syaahi-hybrid-brief:${user.id}`, prompt);
    } catch {}
  }, [prompt, user?.id, briefOwner]);
  useEffect(() => {
    const selected = new URLSearchParams(location.search).get("direction");
    if (selected) {
      const g = GENOMES.find((g) => g.name === selected);
      if (g) setGenome(g);
    }
  }, []);
  useEffect(() => {
    if (!task?.id || !user || !["queued", "researching"].includes(task.status))
      return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { response, data } = await requestJson(
          `/api/presentations/tasks/${task.id}`,
          { signal: controller.signal },
          20000,
        );
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) {
            setTask(null);
            if (response.status === 404)
              try {
                localStorage.removeItem(`syaahi-hybrid-task:${user.id}`);
              } catch {}
            setError(
              data.error || "Sign in again to reconnect to your research.",
            );
            return;
          }
          throw new Error(data.error);
        }
        setError("");
        setTask(data.task);
        if (data.task.status === "done") {
          try {
            localStorage.removeItem(`syaahi-hybrid-task:${user.id}`);
          } catch {}
          location.assign(`/presentations/plan/${data.task.draftId}`);
        } else if (["error", "cancelled"].includes(data.task.status)) {
          if (data.task.status === "cancelled")
            try {
              localStorage.removeItem(`syaahi-hybrid-task:${user.id}`);
            } catch {}
          if (data.task.error) setError(data.task.error);
        } else timer = setTimeout(poll, 2500);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
          timer = setTimeout(poll, 6000);
        }
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [task?.id, task?.status, user?.id]);
  useEffect(() => {
    event.current = "";
  }, [prompt, sources, count, audience, language, research, genome]);
  async function begin() {
    if (!user) return;
    setBusy(true);
    setError("");
    event.current ||= crypto.randomUUID();
    try {
      const { response, data } = await requestJson(
        "/api/presentations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "outline",
            designEngine: 3,
            event: event.current,
            prompt,
            count,
            audience,
            language,
            sources,
            liveResearch: research,
            genome,
          }),
        },
        20000,
      );
      if (!response.ok) throw new Error(data.error);
      setTask(data.task);
      try {
        localStorage.setItem(`syaahi-hybrid-task:${user.id}`, data.task.id);
      } catch {}
      event.current = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!task) return;
    try {
      const { response, data } = await requestJson(
        `/api/presentations/tasks/${task.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(data.error);
      setTask(data.task);
      if (user)
        try {
          localStorage.removeItem(`syaahi-hybrid-task:${user.id}`);
        } catch {}
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function retrySaved() {
    if (!task || !user) return;
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(
        `/api/presentations/tasks/${task.id}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(data.error);
      setTask(data.task);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const running = !!task && ["queued", "researching"].includes(task.status),
    example = studioExample(genome);
  const all = decks.filter((d) =>
    d.title.toLowerCase().includes(filter.toLowerCase()),
  );
  if (view !== "create")
    return (
      <main className="cv-collection">
        <header>
          <span className="cv-eyebrow">
            {view === "library"
              ? "YOUR KNOWLEDGE, SHAPED"
              : "A VISUAL LANGUAGE"}
          </span>
          <h1>
            {view === "library"
              ? "Work worth returning to."
              : "Give your ideas a point of view."}
          </h1>
          <p>
            {view === "library"
              ? "Saved presentations and source-backed storyboards, in one quiet place."
              : "Choose a palette. The director will select a visual metaphor for each source-backed slide."}
          </p>
        </header>
        {view === "library" ? (
          <>
            <label className="cv-search">
              <Search size={18} />
              <input
                aria-label="Search presentations"
                placeholder="Find a presentation…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            {!user && !loading && (
              <a
                className="cv-button"
                href="/login?next=%2Fpresentations%2Flibrary"
              >
                Sign in to your library
              </a>
            )}
            <div className="cv-deck-grid">
              <a href="/presentations/new" className="cv-new-card">
                <Plus size={28} />
                <strong>Something new starts here.</strong>
                <span>Create a source-backed brief</span>
              </a>
              {drafts
                .filter((d) =>
                  d.title?.toLowerCase().includes(filter.toLowerCase()),
                )
                .map((d) => (
                  <a
                    key={d.id}
                    className="cv-deck-card cv-draft-card"
                    href={`/presentations/plan/${d.id}`}
                  >
                    <FileText size={36} />
                    <span className="cv-chip">Storyboard</span>
                    <h2>{d.title}</h2>
                    <small>
                      {d.count} scenes · Continue planning{" "}
                      <ArrowUpRight size={13} />
                    </small>
                  </a>
                ))}
              {all.map((d) => (
                <a
                  className="cv-deck-card"
                  href={`/presentations/${d.id}`}
                  key={d.id}
                >
                  <div className="cv-card-stage">
                    {d.slides[0]?.manifest ? (
                      <UniversalStage
                        slide={d.slides[0].manifest}
                        interactive={false}
                      />
                    ) : (
                      <div className="cv-archive-preview">
                        <Layers3 size={30} />
                        <strong>{d.title}</strong>
                      </div>
                    )}
                  </div>
                  <div className="cv-card-meta">
                    <span className="cv-chip">
                      {d.designEngine === 3
                        ? d.status === "done"
                          ? "Checked & ready"
                          : d.status
                        : "Saved archive"}
                    </span>
                    <h2>{d.title}</h2>
                    <small>
                      {d.count} scenes ·{" "}
                      {new Date(d.updatedAt).toLocaleDateString()}{" "}
                      <ArrowUpRight size={13} />
                    </small>
                  </div>
                </a>
              ))}
            </div>
            {!all.length && filter && <p>No presentations match that title.</p>}
          </>
        ) : (
          <div className="cv-direction-grid">
            {GENOMES.map((g) => (
              <a
                key={g.name}
                className="cv-direction-card"
                href={`/presentations/new?direction=${encodeURIComponent(g.name)}`}
              >
                <UniversalStage slide={studioExample(g)} interactive={false} />
                <div>
                  <h2>{g.name}</h2>
                  <span>
                    {g.lighting} lighting · {g.font}
                  </span>
                  <ArrowUpRight size={20} />
                </div>
              </a>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="cv-error">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <main className="cv-creation" data-mobile-pane={pane}>
      <nav className="cv-pane-tabs" aria-label="Creation panels">
        {["sources", "brief", "design"].map((p) => (
          <button key={p} aria-pressed={pane === p} onClick={() => setPane(p)}>
            {p === "sources"
              ? "Sources"
              : p === "brief"
                ? "Your brief"
                : "Design"}
          </button>
        ))}
      </nav>
      <SourceHub
        key={user?.id || "guest"}
        sources={sources}
        onChange={setSources}
        disabled={!user || running}
        liveResearch={research}
        onResearchChange={setResearch}
      />
      <section className="cv-creation-center">
        <div className="cv-creation-heading">
          <span className="cv-eyebrow">
            <span className="cv-live-dot" />
            SYAAHI / COGNITIVE STUDIO
          </span>
          <h1>
            First, understand.
            <br />
            <em>Then, make it seen.</em>
          </h1>
          <p>
            Bring your sources. Build a narrative. Explore the idea in motion.
          </p>
        </div>
        <div className="cv-command">
          <label htmlFor="cv-brief">
            What should your audience understand?
          </label>
          <textarea
            id="cv-brief"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              event.current = "";
            }}
            placeholder="Explain database normalization to university students. Compare the normal forms, show the trade-offs, and end with a design checklist…"
            maxLength={3000}
            rows={4}
            disabled={running}
          />
          <div className="cv-command-bottom">
            <span>
              <FileText size={14} />
              {sources.length
                ? `${sources.length} source${sources.length === 1 ? "" : "s"} attached`
                : research
                  ? "Live discovery enabled"
                  : "Add sources to begin"}
            </span>
            {user ? (
              <button
                className="cv-button primary"
                onClick={() => void begin()}
                disabled={busy || running || prompt.trim().length < 12}
              >
                {busy ? (
                  <LoaderCircle size={16} className="cv-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Research & plan
                <ArrowRight size={16} />
              </button>
            ) : (
              <a
                className="cv-button primary"
                href="/login?next=%2Fpresentations"
              >
                Sign in to create
                <ArrowRight size={16} />
              </a>
            )}
          </div>
        </div>
        {error && (
          <p className="cv-error" role="alert">
            {error}
          </p>
        )}
        {running && (
          <section className="cv-job-status" role="status">
            <LoaderCircle className="cv-spin" size={22} />
            <div>
              <strong>{task.stage}</strong>
              <p>
                You can leave this page. Your account keeps the research task;
                credits are reserved only after you approve the plan.
              </p>
            </div>
            <button className="cv-button subtle" onClick={() => void cancel()}>
              Cancel delivery
            </button>
          </section>
        )}
        {task?.status === "error" && (
          <section
            className="cv-job-status"
            aria-label="Saved research recovery"
          >
            <div>
              <strong>Your saved brief and sources are safe.</strong>
              <p>
                No planning credits were charged. Wait one minute before
                retrying. Retrying reuses the original sources and settings.
              </p>
            </div>
            {task.canRetry && (
              <button
                className="cv-button"
                disabled={busy}
                onClick={() => void retrySaved()}
              >
                Retry saved brief
              </button>
            )}
          </section>
        )}
        <div className="cv-preview-heading">
          <span>
            <Play size={14} />A glimpse of the stage
          </span>
          <small>
            Illustrative preview · your research will replace this content
          </small>
        </div>
        <div className="cv-home-preview">
          <UniversalStage slide={example} interactive={!running} />
        </div>
        <div className="cv-workflow-strip">
          <span>
            <b>01</b>Knowledge
          </span>
          <i />
          <span>
            <b>02</b>Narrative
          </span>
          <i />
          <span>
            <b>03</b>Visual world
          </span>
          <i />
          <span>
            <b>04</b>Checked delivery
          </span>
        </div>
      </section>
      <aside className="cv-director">
        <div className="cv-panel-heading">
          <div>
            <span className="cv-eyebrow">02 / DIRECTION</span>
            <h2>Make it yours.</h2>
          </div>
          <Sparkles size={18} />
        </div>
        <label>
          Audience
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            maxLength={120}
            disabled={running}
          />
        </label>
        <label>
          Language
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={running}
          >
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="hinglish">Hinglish</option>
            <option value="german">German</option>
            <option value="french">French</option>
            <option value="spanish">Spanish</option>
          </select>
        </label>
        <div className="cv-budget">
          <p className="cv-fineprint">
            Narrative headings follow your language choice. Cited passages keep
            their original source wording.
          </p>
          <label htmlFor="cv-count">
            Scene budget <b>{count}</b>
          </label>
          <input
            id="cv-count"
            type="range"
            min={5}
            max={Math.max(6, max)}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={running}
          />
          <div>
            <span>5</span>
            <span>{max} on your plan</span>
          </div>
          <p>
            <strong>{hybridCredits(count)} credits</strong> if approved ·{" "}
            {credits} available
          </p>
          <small>
            Source depth can reduce the final scene count. The review screen
            shows the exact reservation.
          </small>
          {max < 20 && (
            <a href="/pricing">
              Need a deeper deck? Max supports up to 30 scenes{" "}
              <ArrowUpRight size={12} />
            </a>
          )}
        </div>
        <span className="cv-eyebrow">DESIGN GENOME</span>
        <GenomePicker value={genome} onChange={setGenome} />
        <div className="cv-director-note">
          <ShieldCheck size={19} />
          <strong>Grounded by construction.</strong>
          <p>
            Factual text comes from exact source spans. Before delivery, every
            scene is checked for source integrity, clipping and readable
            contrast.
          </p>
          <small>
            Source verification is not a guarantee that the source itself is
            correct.
          </small>
        </div>
      </aside>
    </main>
  );
}
