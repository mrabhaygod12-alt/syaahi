"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  Sparkles,
  FileText,
  Check,
  ExternalLink,
} from "lucide-react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
import type { DeckDraft } from "@/lib/presentations/drafts";
import {
  VISUAL_ENGINES,
  VISUAL_METAPHORS,
  type HybridPlan,
  type FactCitation,
} from "@/lib/presentations/hybrid/model";
import { manifestForBeat } from "@/lib/presentations/hybrid/manifest";
import UniversalStage from "./UniversalStage";
import SourceInspector from "./SourceInspector";
import { GenomePicker } from "./StudioHome";
export default function StudioPlan({ id }: { id: string }) {
  const { user, loading } = useAccount(),
    [draft, setDraft] = useState<DeckDraft | null>(null),
    [plan, setPlan] = useState<HybridPlan | null>(null),
    [active, setActive] = useState(0),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [fact, setFact] = useState<FactCitation | null>(null),
    [drag, setDrag] = useState(-1),
    [pane, setPane] = useState("story");
  useEffect(() => {
    setDraft(null);
    setPlan(null);
    setError("");
    if (!user) return;
    const controller = new AbortController();
    void requestJson(`/api/presentations/drafts/${id}`, {
      signal: controller.signal,
    })
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        setDraft(data.draft);
        setPlan(data.draft.hybridPlan || null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, user?.id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (next: HybridPlan) => {
    setPlan(next);
    setDirty(true);
    setConfirmed(false);
    setNotice("");
  };
  function move(from: number, to: number) {
    if (
      !plan ||
      busy ||
      from <= 0 ||
      from >= plan.beats.length - 1 ||
      to <= 0 ||
      to >= plan.beats.length - 1
    )
      return;
    const beats = [...plan.beats],
      removed = beats.splice(from, 1)[0];
    beats.splice(to, 0, removed);
    update({ ...plan, beats });
    setActive(to);
  }
  async function save() {
    if (!draft || !plan) return null;
    const { response, data } = await requestJson(
      `/api/presentations/drafts/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: draft.revision,
          outline: plan.beats.map((b) => b.title),
          hybridPlan: plan,
        }),
      },
      30000,
    );
    if (!response.ok) throw new Error(data.error);
    setDraft(data.draft);
    setPlan(data.draft.hybridPlan);
    setDirty(false);
    setNotice("Storyboard saved to your account.");
    return data.draft as DeckDraft;
  }
  async function action(generate: boolean) {
    setBusy(true);
    setError("");
    try {
      if (generate && !confirmed)
        throw new Error("Approve the displayed credit reservation first.");
      const current = await save();
      if (generate && current) {
        const { response, data } = await requestJson(
          "/api/presentations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              draftId: current.id,
              revision: current.revision,
              outline: current.outline,
              confirmCredits: true,
              expectedCredits: current.hybridPlan!.budget.credits,
            }),
          },
          30000,
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
  if (!user && !loading)
    return (
      <main className="cv-empty">
        <h1>Your storyboard is private.</h1>
        <a
          className="cv-button"
          href={`/login?next=${encodeURIComponent(`/presentations/plan/${id}`)}`}
        >
          Sign in to continue
        </a>
      </main>
    );
  if (!draft)
    return (
      <main className="cv-empty">
        <p role={error ? "alert" : "status"}>
          {error || "Opening your source-backed storyboard…"}
        </p>
        <a href="/presentations">Return to studio</a>
      </main>
    );
  if (!plan)
    return (
      <main className="cv-empty">
        <h1>This draft belongs to the retired engine.</h1>
        <p>
          Your saved content remains available. Create a new source-backed brief
          to use the redesigned studio.
        </p>
        <a className="cv-button" href="/presentations/new">
          Create a new brief
        </a>
      </main>
    );
  const beat = plan.beats[active],
    preview = manifestForBeat(
      {
        ...plan,
        beats: plan.beats.map((b) => ({
          ...b,
          title:
            b.title.trim().split(/\s+/u).slice(0, 8).join(" ").slice(0, 100) ||
            "Edit scene heading",
        })),
      },
      active,
    ),
    selected = new Set(beat.factIds);
  return (
    <main className="cv-plan" data-mobile-pane={pane}>
      <header className="cv-document-bar">
        <a href="/presentations">
          <ArrowLeft size={16} />
          Creation studio
        </a>
        <div>
          <span className="cv-chip">
            Storyboard / {plan.beats.length} scenes
          </span>
          <span className="cv-save-state">
            {dirty ? "Unsaved plan" : notice || "Saved to your account"}
          </span>
          <button
            className="cv-button subtle"
            onClick={() => void action(false)}
            disabled={busy || !dirty}
          >
            <Save size={15} />
            Save plan
          </button>
        </div>
      </header>
      <nav className="cv-pane-tabs" aria-label="Storyboard panels">
        {["sources", "story", "design"].map((p) => (
          <button key={p} aria-pressed={pane === p} onClick={() => setPane(p)}>
            {p === "sources"
              ? "Knowledge"
              : p === "story"
                ? "Storyboard"
                : "Direction"}
          </button>
        ))}
      </nav>
      <aside className="cv-plan-sources">
        <span className="cv-eyebrow">THE KNOWLEDGE DOSSIER</span>
        <h2>Know what you’re saying.</h2>
        <p>
          {plan.context.characters.toLocaleString()} extracted characters ·
          full-source context
        </p>
        {draft.sources.map((s) => (
          <details key={s.id} className="cv-source-detail">
            <summary>
              <FileText size={16} />
              {s.name}
            </summary>
            <p>{s.text.slice(0, 700)}</p>
            {s.locator?.startsWith("https:") && (
              <a href={s.locator} target="_blank" rel="noopener noreferrer">
                Original source
                <ExternalLink size={12} />
              </a>
            )}
          </details>
        ))}
        <h3>Research trace</h3>
        {plan.research.length ? (
          plan.research.map((r, i) => (
            <article className="cv-trace" key={i}>
              <span>
                {r.status === "complete" ? <Check size={13} /> : "—"}
                {r.provider}
              </span>
              <strong>{r.query}</strong>
              <small>
                {r.results} sources · {r.status}
              </small>
            </article>
          ))
        ) : (
          <p className="cv-fineprint">
            Using your imported sources. No live search was requested.
          </p>
        )}
        <div className="cv-source-principle">
          <span>ONE SLIDE. ONE THESIS.</span>
          <p>{plan.thesis}</p>
        </div>
      </aside>
      <section className="cv-plan-center">
        <div className="cv-plan-heading">
          <span className="cv-eyebrow">THE NARRATIVE, BEFORE THE DECK</span>
          <h1>A clear story starts here.</h1>
          <p>
            Refine the headings, reorder the middle, and inspect the evidence
            before you build.
          </p>
        </div>
        {error && (
          <p className="cv-error" role="alert">
            {error}
          </p>
        )}
        <div className="cv-plan-preview">
          <UniversalStage
            slide={preview}
            interactive={false}
            index={active}
            onCitation={(i) => setFact(preview.facts[i])}
          />
        </div>
        <div className="cv-outline-list">
          {plan.beats.map((b, i) => (
            <article
              key={b.id}
              className={i === active ? "selected" : ""}
              draggable={!busy && i > 0 && i < plan.beats.length - 1}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                move(drag, i);
                setDrag(-1);
              }}
            >
              <button
                className="cv-outline-number"
                aria-label={`Preview scene ${i + 1}`}
                aria-pressed={active === i}
                onClick={() => setActive(i)}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
              <div>
                <span>
                  {b.role} · {b.engine} / {b.metaphor}
                </span>
                <label className="cv-visually-hidden" htmlFor={`beat-${b.id}`}>
                  Scene {i + 1} heading
                </label>
                <input
                  id={`beat-${b.id}`}
                  value={b.title}
                  maxLength={100}
                  disabled={busy}
                  onFocus={() => setActive(i)}
                  onChange={(e) =>
                    update({
                      ...plan,
                      beats: plan.beats.map((old, n) =>
                        n === i ? { ...old, title: e.target.value } : old,
                      ),
                    })
                  }
                />
                <small>
                  {b.factIds.length} exact source passages ·{" "}
                  {b.title.trim().split(/\s+/).length}/8 heading words
                </small>
              </div>
              <div className="cv-reorder">
                <GripVertical size={15} />
                <button
                  aria-label={`Move scene ${i + 1} up`}
                  disabled={busy || i <= 1 || i === plan.beats.length - 1}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  aria-label={`Move scene ${i + 1} down`}
                  disabled={busy || i === 0 || i >= plan.beats.length - 2}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <aside className="cv-director">
        <div className="cv-panel-heading">
          <div>
            <span className="cv-eyebrow">DIRECTOR’S NOTES</span>
            <h2>Scene {active + 1}</h2>
          </div>
          <Sparkles size={18} />
        </div>
        <label>
          Visual engine
          <select
            value={beat.engine}
            disabled={busy}
            onChange={(e) =>
              update({
                ...plan,
                beats: plan.beats.map((b, i) =>
                  i === active
                    ? { ...b, engine: e.target.value as typeof b.engine }
                    : b,
                ),
              })
            }
          >
            {VISUAL_ENGINES.filter((e) => e !== "spline").map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label>
          Visual metaphor
          <select
            value={beat.metaphor}
            disabled={busy}
            onChange={(e) =>
              update({
                ...plan,
                beats: plan.beats.map((b, i) =>
                  i === active
                    ? { ...b, metaphor: e.target.value as typeof b.metaphor }
                    : b,
                ),
              })
            }
          >
            {VISUAL_METAPHORS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <h3>Evidence in this scene</h3>
        <div className="cv-fact-choices">
          {plan.facts.map((f) => (
            <label key={f.id}>
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                disabled={busy || (!selected.has(f.id) && selected.size >= 3)}
                onChange={(e) => {
                  const ids = e.target.checked
                    ? [...beat.factIds, f.id]
                    : beat.factIds.filter((id) => id !== f.id);
                  if (!ids.length) return;
                  update({
                    ...plan,
                    beats: plan.beats.map((b, i) =>
                      i === active ? { ...b, factIds: ids } : b,
                    ),
                  });
                }}
              />
              <span>
                {f.statement}
                <small>{f.documentTitle}</small>
              </span>
            </label>
          ))}
        </div>
        <h3>Design genome</h3>
        <GenomePicker
          value={plan.genome}
          onChange={(g) => update({ ...plan, genome: g })}
        />
        <div className="cv-approval">
          <strong>
            {plan.budget.credits} credits · {plan.beats.length} scenes
          </strong>
          <p>{plan.budget.explanation}</p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy}
            />
            I approve this reservation. A failed delivery check returns it.
          </label>
          <button
            className="cv-button primary"
            disabled={!confirmed || busy}
            onClick={() => void action(true)}
          >
            <Sparkles size={17} />
            {busy ? "Saving your plan…" : "Build the visual deck"}
          </button>
        </div>
      </aside>
      {fact && (
        <SourceInspector
          fact={fact}
          sources={draft.sources}
          onClose={() => setFact(null)}
        />
      )}
    </main>
  );
}
