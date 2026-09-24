"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import ConceptHero from "./ConceptHero";
import NotePage from "@/components/NotePage";
import SelectionAsk from "./SelectionAsk";
import { DEFAULT_STYLE } from "@/lib/handwriting/options";
import { useLesson } from "./LessonProvider";
import { contentsModel, lessonTitle } from "./types";

// Turbo-style Learn room: overview (hero + contents) + a guided step-through
// session. "Start lesson" walks one section at a time — page, explain-in-chat,
// complete-and-advance — instead of dumping all notes at once.
export default function LearnView() {
  const { job, markComplete, openChat } = useLesson();
  const [step, setStep] = useState<number | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  if (!job) return null;

  const items = contentsModel(job);
  const completed = new Set(job.progress?.completed ?? []);
  const sectionCount = job.topics.length + 1; // sections + final quiz slot
  const done = completed.size;
  const firstOpen = job.topics.findIndex((_, i) => !completed.has(i));
  const nextIdx = firstOpen === -1 ? 0 : firstOpen;
  const getStepScope = () => stepRef.current;

  // ── Guided session: one section at a time ──
  if (step !== null) {
    const topic = job.topics[step] ?? "Section";
    const page = job.pages[step];
    const isDone = completed.has(step);
    const last = step === job.topics.length - 1;
    const pct = Math.round(((step + 1) / Math.max(job.topics.length, 1)) * 100);
    const advance = () => {
      markComplete(step, true);
      if (!last) setStep(step + 1);
    };
    return (
      <div className="learn-page">
        <div className="guided-top">
          <button className="btn light" onClick={() => setStep(null)}>
            ✕ Overview
          </button>
          <div className="guided-progress">
            <div className="quiz-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <span className="small">
              Section {step + 1} of {job.topics.length}
            </span>
          </div>
        </div>
        <div ref={stepRef}>
          {page ? (
            <NotePage
              markdown={page.markdown}
              style={DEFAULT_STYLE}
              seedKey={`guided-${job.id}-${step}`}
              footer={`Page ${step + 1} of ${job.pages.length} · Syaahi`}
            />
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <b>{topic}</b>
              <p className="small">
                This page is still generating — check back in a bit.
              </p>
            </div>
          )}
        </div>
        <SelectionAsk getScope={getStepScope} />
        <div className="guided-actions">
          <button
            className="btn light"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            ← Prev
          </button>
          <button
            className="btn light"
            onClick={() =>
              openChat(`Teach me "${topic}" simply, using my lesson notes.`)
            }
          >
            Explain in chat ✦
          </button>
          {!last ? (
            <button className="btn dark" onClick={advance}>
              {isDone ? "Next →" : "✓ Complete & next"}
            </button>
          ) : (
            <>
              <button
                className="btn dark"
                onClick={() => markComplete(step, true)}
              >
                ✓ Complete
              </button>
              <Link className="btn dark" href={`/lesson/${job.id}/quiz`}>
                Take the quiz →
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Overview ──
  const started = done > 0;
  return (
    <div className="learn-page">
      <div className="learn-hero">
        <ConceptHero title={lessonTitle(job)} seed={job.id} />
        <div>
          <h1>{lessonTitle(job)}</h1>
          <p className="small">
            {job.pages.length} pages generated
            {(job.plannedTotal ?? job.total) !== job.pages.length
              ? ` · ${job.plannedTotal ?? job.total} planned`
              : ""}
            {job.planNote ? ` · ${job.planNote}` : ""}
          </p>
          <div className="learn-cta">
            <button className="btn dark" onClick={() => setStep(nextIdx)}>
              {started ? "Continue lesson" : "Start lesson"}
            </button>
            <div>
              <div className="small">UP NEXT</div>
              <b>{job.topics[nextIdx] ?? "Getting Started"}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="learn-contents-head">
        <h2>Contents</h2>
        <span className="small">
          {done} of {sectionCount} complete
        </span>
      </div>
      <ol className="learn-list">
        {items.map((it, i) => {
          const num = it.kind === "section" ? it.index + 1 : null;
          const isDone = it.kind === "section" && completed.has(it.index);
          const href =
            it.kind === "final" || it.kind === "checkpoint"
              ? `/lesson/${job.id}/quiz`
              : `/lesson/${job.id}/notes`;
          return (
            <li
              key={`${it.kind}-${i}`}
              className={`learn-row ${it.kind} ${isDone ? "done" : ""}`}
            >
              <span className="learn-idx">
                {it.kind === "checkpoint" || it.kind === "final" ? "★" : num}
              </span>
              <div className="learn-meta">
                {it.kind === "section" ? (
                  <button
                    className="learn-link"
                    onClick={() => setStep(it.index)}
                  >
                    {it.title}
                  </button>
                ) : (
                  <Link href={href}>{it.title}</Link>
                )}
                <span className="small">
                  {it.kind === "section" ? `${it.pages} page` : "Checkpoint"}
                </span>
              </div>
              {it.kind === "section" && i === 0 && (
                <button
                  className="btn dark learn-start"
                  onClick={() => setStep(it.index)}
                >
                  Start
                </button>
              )}
              {it.kind === "section" && i > 0 && (
                <button
                  className="learn-check"
                  onClick={() => markComplete(it.index, !isDone)}
                  title="Mark complete"
                >
                  {isDone ? "✓" : "○"}
                </button>
              )}
            </li>
          );
        })}
        <li className="learn-row trophy">
          <span className="learn-idx">🏆</span>
          <div className="learn-meta">
            <span>Finish every section to complete the lesson</span>
          </div>
        </li>
      </ol>
    </div>
  );
}
