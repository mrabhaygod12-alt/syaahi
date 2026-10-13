"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLesson } from "./LessonProvider";
import { lessonTitle } from "./types";
import { requestJson } from "@/lib/http-client";
import PracticeSources from "./PracticeSources";
import "./learning-studio.css";
type Unit = {
  objective: string;
  explanation: string;
  example: string;
  question: string;
  options: string[];
};
const goals = [
  "Exam preparation",
  "Assignment",
  "Learn something new",
  "Other",
];
export default function LearnView() {
  const { job, openTutor, closeChat } = useLesson();
  const [attempts, setAttempts] = useState(0);
  const [resumeIndex, setResumeIndex] = useState(0);
  const [overviewReload, setOverviewReload] = useState(0);
  const [goal, setGoal] = useState(goals[0]),
    [version, setVersion] = useState(""),
    [completed, setCompleted] = useState<number[]>([]),
    [index, setIndex] = useState<number | null>(null),
    [phase, setPhase] = useState(0),
    [unit, setUnit] = useState<Unit | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [correct, setCorrect] = useState(false),
    [audio, setAudio] = useState("");
  const requestId = useRef(0);
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio);
    },
    [audio],
  );
  useEffect(() => {
    if (!job) return;
    let active = true;
    setVersion("");
    ++requestId.current;
    closeChat();
    setIndex(null);
    setUnit(null);
    setCompleted([]);
    setResumeIndex(0);
    setPhase(0);
    setFeedback("");
    setCorrect(false);
    setAudio("");
    setBusy(false);
    setError("");
    requestJson("/api/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson: job.id, goal, action: "overview" }),
    })
      .then(({ response, data: d }) => {
        if (!response.ok) throw Error(d.error);
        if (active) {
          setVersion(d.version);
          setResumeIndex(d.progress.cursor || 0);
          setCompleted(d.progress.completed);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [job?.id, job?.revision, goal, overviewReload]);
  if (!job) return null;
  async function api(action: string, extra: object = {}) {
    const { response: r, data: d } = await requestJson(
      "/api/learn",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson: job!.id,
          goal,
          version,
          index,
          action,
          ...extra,
        }),
      },
      action === "unit" ? 90000 : 30000,
    );
    if (!r.ok) throw Error(d.error || "Could not load lesson.");
    return d;
  }
  async function start(n: number, resume = false) {
    const id = ++requestId.current;
    closeChat();
    setAttempts(0);
    setIndex(n);
    setPhase(0);
    setUnit(null);
    setFeedback("");
    setCorrect(false);
    setError("");
    setAudio("");
    setBusy(true);
    try {
      const d = await api("unit", { index: n, resume });
      if (id === requestId.current) {
        setUnit(d.unit);
        setPhase(d.progress.phase || 0);
        setCompleted(d.progress.completed);
      }
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  async function movePhase(phase: number) {
    const id = requestId.current;
    setBusy(true);
    setError("");
    try {
      await api("position", { phase });
      if (id !== requestId.current) return;
      closeChat();
      setPhase(phase);
      setAudio("");
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  async function answer(n: number) {
    const id = requestId.current;
    setBusy(true);
    setError("");
    try {
      const d = await api("answer", { answer: n });
      if (id !== requestId.current) return;
      setFeedback(d.feedback);
      setCorrect(d.correct);
      setAttempts(d.progress.attempts?.[index!] || 1);
      setCompleted(d.progress.completed);
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  async function listen() {
    if (!unit) return;
    const id = requestId.current;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson: job!.id,
          action: "chat",
          text: phase === 0 ? unit.explanation : unit.example,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw Error(d.error || "Audio unavailable");
      }
      const blob = await r.blob();
      if (id === requestId.current) setAudio(URL.createObjectURL(blob));
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  const next = job.pages.findIndex((_, i) => !completed.includes(i));
  return (
    <div className="learn-page teaching-page lesson-studio">
      {index === null ? (
        <>
          <p className="eyebrow">YOUR GUIDED LEARNING PATH</p>
          <header className="learning-studio-heading">
            <div>
              <h1>{lessonTitle(job)}</h1>
              <p>
                Understand each idea, work through an example, then check what
                you learned. Progress is saved after each correct checkpoint.
              </p>
            </div>
            <Link className="btn light" href={`/lesson/${job.id}/source`}>
              Review sources
            </Link>
          </header>
          <div className="lesson-studio-summary">
            <span>
              <b>{job.pages.length} focused sections</b>
              <small>Learn → Apply → Check</small>
            </span>
            <span>
              <b>{completed.length} checkpoints passed</b>
              <small>Saved to your account</small>
            </span>
            <span>
              <b>{goal}</b>
              <small>Your current learning path</small>
            </span>
          </div>
          <section className="learning-intro">
            <h2>Getting started</h2>
            <p>What’s your goal for this lesson?</p>
            <div className="learning-goals">
              {goals.map((g) => (
                <button
                  key={g}
                  className={`btn ${goal === g ? "dark" : "light"}`}
                  aria-pressed={goal === g}
                  onClick={() => setGoal(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="small">
              Your goal shapes the teaching examples. Each goal has its own
              progress.
            </p>
            <button
              disabled={!version || !job.pages.length}
              className="btn dark"
              onClick={() =>
                start(
                  resumeIndex < job.pages.length &&
                    !completed.includes(resumeIndex)
                    ? resumeIndex
                    : next < 0
                      ? 0
                      : next,
                  true,
                )
              }
            >
              {completed.length ? "Continue learning" : "Start lesson"} →
            </button>
          </section>
          <h2>
            Contents{" "}
            <span className="small">
              {completed.length} / {job.pages.length} complete
            </span>
          </h2>
          <ol className="learning-outline">
            {job.pages.map((p, i) => (
              <li key={i}>
                <span>{completed.includes(i) ? "✓" : i + 1}</span>
                <div>
                  <h3>{p.topic}</h3>
                  <p className="small">
                    {job.sections?.[i]?.objective ||
                      "Understand the idea, apply it, then check your reasoning."}
                  </p>
                  {job.sections?.[i]?.prerequisite && (
                    <p className="small">
                      Builds on: {job.sections[i].prerequisite}
                    </p>
                  )}
                </div>
                <button
                  className="btn light"
                  disabled={!version}
                  onClick={() => start(i)}
                >
                  {completed.includes(i) ? "Review" : "Start"}
                </button>
              </li>
            ))}
          </ol>
          {job.pages.length > 0 && completed.length === job.pages.length && (
            <section className="learning-intro">
              <h2>Learning path complete</h2>
              <Link className="btn dark" href={`/lesson/${job.id}/quiz`}>
                Practise with the full quiz →
              </Link>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="guided-top">
            <button
              className="btn light"
              disabled={busy}
              onClick={() => {
                setIndex(null);
                setAudio("");
              }}
            >
              ← Contents
            </button>
            <span>
              Section {index + 1} / {job.pages.length} · Step {phase + 1} / 3
            </span>
          </div>
          <progress
            className="learning-progress"
            value={phase + 1}
            max={3}
            aria-label="Current section progress"
          />
          <h1>{job.pages[index]?.topic}</h1>
          <nav className="lesson-phase-nav" aria-label="Lesson steps">
            {["Understand", "Worked example", "Checkpoint"].map((label, n) => (
              <button
                key={label}
                disabled={busy || !unit}
                aria-current={phase === n ? "step" : undefined}
                onClick={() => void movePhase(n)}
              >
                {n + 1} · {label}
              </button>
            ))}
          </nav>
          {busy && !unit && (
            <p role="status">Preparing your explanation and worked example…</p>
          )}
          {correct && phase === 2 ? (
            <section className="section-celebration" aria-live="polite">
              <div className="completion-ring">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="ring-track" cx="60" cy="60" r="52" />
                  <circle className="ring-progress" cx="60" cy="60" r="52" />
                </svg>
                <span>
                  ✓<small>COMPLETE</small>
                </span>
              </div>
              <p className="eyebrow">
                {attempts === 1 ? "FIRST TRY" : "KEEPING AT IT PAYS OFF"}
              </p>
              <h2>Section complete</h2>
              <p>{job.pages[index].topic}</p>
              <p className="small">
                Checkpoint passed · {attempts}{" "}
                {attempts === 1 ? "attempt" : "attempts"}
              </p>
              <p className="learning-feedback">{feedback}</p>
              <div className="guided-actions">
                <button
                  className="btn light"
                  onClick={() => {
                    setIndex(null);
                    closeChat();
                  }}
                >
                  Back to contents
                </button>
                <button
                  className="btn dark"
                  onClick={() =>
                    index + 1 < job.pages.length
                      ? start(index + 1)
                      : setIndex(null)
                  }
                >
                  {index + 1 < job.pages.length
                    ? "Next section →"
                    : "Finish lesson ✓"}
                </button>
              </div>
            </section>
          ) : (
            unit && (
              <article className="teaching-step" key={`${index}-${phase}`}>
                <p className="eyebrow">
                  {["UNDERSTAND", "APPLY", "CHECK YOUR UNDERSTANDING"][phase]}
                </p>
                <h2>{unit.objective}</h2>
                {phase < 2 ? (
                  <p className="teaching-copy">
                    {phase === 0 ? unit.explanation : unit.example}
                  </p>
                ) : (
                  <>
                    <h3>{unit.question}</h3>
                    <div className="learning-answers">
                      {unit.options.map((o, i) => (
                        <button
                          key={i}
                          className="btn light"
                          disabled={busy || correct}
                          onClick={() => answer(i)}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                    {feedback && (
                      <div role="status" className="learning-feedback">
                        <strong>
                          {correct ? "That’s right. " : "Try again. "}
                        </strong>
                        {feedback}
                      </div>
                    )}
                  </>
                )}
                <div className="guided-actions">
                  {phase > 0 && (
                    <button
                      className="btn light"
                      disabled={busy}
                      onClick={() => {
                        void movePhase(phase - 1);
                      }}
                    >
                      ← Back
                    </button>
                  )}
                  {phase < 2 &&
                    job.accessRole !== "viewer" &&
                    job.accessRole !== "editor" && (
                      <button
                        className="btn light"
                        disabled={busy}
                        onClick={listen}
                      >
                        Listen
                      </button>
                    )}
                  <button
                    className="btn light"
                    onClick={() =>
                      openTutor({
                        goal,
                        version,
                        index,
                        phase,
                        topic: job.pages[index].topic,
                      })
                    }
                  >
                    Ask Syaahi
                  </button>
                  {phase < 2 ? (
                    <button
                      className="btn dark"
                      disabled={busy}
                      onClick={() => {
                        void movePhase(phase + 1);
                      }}
                    >
                      Continue →
                    </button>
                  ) : (
                    correct && (
                      <button
                        className="btn dark"
                        disabled={busy}
                        onClick={() =>
                          index + 1 < job.pages.length
                            ? start(index + 1)
                            : setIndex(null)
                        }
                      >
                        {index + 1 < job.pages.length
                          ? "Next section →"
                          : "Finish lesson ✓"}
                      </button>
                    )
                  )}
                </div>
                {audio && <audio controls autoPlay src={audio} />}
                <div className="lesson-section-source">
                  <PracticeSources
                    lesson={job.id}
                    sources={[{ page: index, topic: job.pages[index].topic }]}
                  />
                  <Link
                    className="btn light"
                    href={`/lesson/${job.id}/notes#page-${index + 1}`}
                  >
                    Read original notes
                  </Link>
                </div>
              </article>
            )
          )}
          {!unit && !busy && (
            <button className="btn dark" onClick={() => start(index)}>
              Retry teaching
            </button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {error && index === null && (
        <button
          className="btn light"
          onClick={() => setOverviewReload((n) => n + 1)}
        >
          Retry lesson overview
        </button>
      )}
    </div>
  );
}
