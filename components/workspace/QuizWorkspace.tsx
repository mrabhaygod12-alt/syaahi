"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  BookOpen,
  ListChecks,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useLesson } from "./LessonProvider";
import { requestJson } from "@/lib/http-client";
import {
  questionId,
  answerCorrect,
  quizVersion,
  attemptQuestionIds,
  type QuizAttempt,
} from "@/lib/study/quiz";
import { practiceSettings } from "@/lib/study/practice";
import PracticeSources from "./PracticeSources";
import "./learning-studio.css";

export default function QuizWorkspace() {
  const { job, refresh } = useLesson();
  const quiz = job?.practice?.quiz || [];
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [mode, setMode] = useState("practice"),
    [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false);
  const [loadingAttempt, setLoadingAttempt] = useState(true),
    [error, setError] = useState("");
  const [settings, setSettings] = useState(() => practiceSettings({}, 1));
  const [showHint, setShowHint] = useState(false),
    [warning, setWarning] = useState("");
  const version = quizVersion(quiz);
  const active = attempt?.version === version ? attempt : null;
  const selected = useMemo(
    () =>
      active
        ? quiz.filter((q) =>
            new Set(attemptQuestionIds(active, quiz)).has(questionId(q)),
          )
        : quiz,
    [active, quiz],
  );
  const q = selected[Math.min(index, selected.length - 1)];
  const key = q ? questionId(q) : "",
    stored = active?.answers[key];
  const revealed =
    !!active && (active.submitted || (active.mode === "practice" && !!stored));

  useEffect(() => {
    setSettings(
      job?.practice?.settings || practiceSettings({}, job?.pages.length || 1),
    );
  }, [job?.id, job?.practice?.settings]);
  useEffect(() => {
    if (!job) return;
    let alive = true;
    setLoadingAttempt(true);
    setAttempt(null);
    setError("");
    void requestJson(`/api/student/quiz?lesson=${job.id}`)
      .then(({ response, data }) => {
        if (!response.ok)
          throw new Error(data.error || "Could not load your saved attempt.");
        if (!alive) return;
        const saved = data.attempt as QuizAttempt | null;
        setAttempt(saved);
        if (saved?.version === version) {
          setMode(saved.mode);
          const ids = attemptQuestionIds(saved, quiz);
          const cursor = saved.cursor ? ids.indexOf(saved.cursor) : -1;
          const unanswered = ids.findIndex((id) => !saved.answers[id]);
          setIndex(cursor >= 0 ? cursor : Math.max(0, unanswered));
        } else setIndex(0);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoadingAttempt(false));
    return () => {
      alive = false;
    };
  }, [job?.id, version]);
  useEffect(() => {
    setAnswer(stored || "");
    setShowHint(false);
  }, [key, stored]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!job || busy) return;
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson("/api/student/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson: job.id,
          action,
          attempt: active?.id,
          ...extra,
        }),
      });
      if (!response.ok)
        throw new Error(data.error || "Could not save your attempt.");
      setAttempt(data.attempt);
      if (action === "start") setIndex(0);
      if (action === "position") setIndex(Number(extra.index));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  function go(next: number) {
    const target = selected[next];
    if (!target || busy) return;
    void act("position", { question: questionId(target), index: next });
  }
  async function build() {
    if (!job || busy) return;
    if (active && !active.submitted) {
      setError("Submit your current attempt before rebuilding practice.");
      return;
    }
    setBusy(true);
    setError("");
    setWarning("");
    try {
      const { response, data } = await requestJson(
        "/api/practice",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            ...settings,
            regenerate: quiz.length > 0,
          }),
        },
        90000,
      );
      if (!response.ok)
        throw new Error(data.error || "Could not generate practice.");
      setWarning(data.warning || "");
      await refresh();
      setAttempt(null);
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate practice.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest("input,textarea,select,button,a") ||
        busy ||
        !active
      )
        return;
      if (e.key === "ArrowRight" && index < selected.length - 1) {
        e.preventDefault();
        go(index + 1);
      }
      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, selected, busy, active]);
  if (!job) return null;
  const owner = job.accessRole !== "viewer" && job.accessRole !== "editor";
  const answered = selected.filter(
    (q) => active?.answers[questionId(q)],
  ).length;
  const missed = active?.submitted
    ? selected.filter(
        (q) => !answerCorrect(q, active.answers[questionId(q)] || ""),
      )
    : [];
  const settingsForm = (
    <fieldset
      className="practice-settings"
      disabled={busy || !owner || (!!active && !active.submitted)}
    >
      <legend>Shape your practice</legend>
      <label>
        Question style
        <select
          value={settings.format}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              format: e.target.value as typeof s.format,
            }))
          }
        >
          <option value="mixed">Mixed</option>
          <option value="mcq">Multiple choice</option>
          <option value="blank">Fill the blank</option>
          <option value="short">Typed answer</option>
        </select>
      </label>
      <label>
        Difficulty
        <select
          value={settings.difficulty}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              difficulty: e.target.value as typeof s.difficulty,
            }))
          }
        >
          <option value="foundation">Foundation</option>
          <option value="standard">Standard</option>
          <option value="challenge">Challenge</option>
        </select>
      </label>
      <label>
        Questions
        <select
          value={settings.size}
          onChange={(e) =>
            setSettings((s) => ({ ...s, size: Number(e.target.value) }))
          }
        >
          {[5, 8, 10, 15, 20, 25, 30].includes(settings.size) ? null : (
            <option value={settings.size}>{settings.size}</option>
          )}
          {[5, 8, 10, 15, 20, 25, 30].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Flashcards
        <select
          value={settings.cardCount}
          onChange={(e) =>
            setSettings((s) => ({ ...s, cardCount: Number(e.target.value) }))
          }
        >
          {[6, 9, 12, 18, 24, 30, 36].includes(settings.cardCount) ? null : (
            <option value={settings.cardCount}>{settings.cardCount}</option>
          )}
          {[6, 9, 12, 18, 24, 30, 36].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="practice-focus">
        Focus on a concept (optional)
        <input
          maxLength={160}
          value={settings.focus}
          onChange={(e) =>
            setSettings((s) => ({ ...s, focus: e.target.value }))
          }
          placeholder="For example, database normalization"
        />
      </label>
    </fieldset>
  );
  return (
    <section className="practice-studio quiz-room">
      <header className="learning-studio-heading">
        <div>
          <p className="eyebrow">YOUR PRACTICE STUDIO</p>
          <h1>
            {active?.mode === "exam" ? "Exam practice" : "Practice this lesson"}
          </h1>
          <p>
            Turn your saved notes into questions you can reason through. Return
            to a supporting section whenever you need it.
          </p>
        </div>
        <Link className="btn light" href={`/lesson/${job.id}/learn`}>
          <BookOpen size={16} aria-hidden="true" /> Guided lesson
        </Link>
      </header>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {warning && (
        <p className="source-notice" role="status">
          {warning}
        </p>
      )}
      <div className="practice-studio-grid">
        <aside className="practice-sidebar">
          <div className="practice-mode-note">
            <ListChecks size={20} aria-hidden="true" />
            <h2>One concept at a time</h2>
            <p>
              Practice locks your first answer before showing feedback. Exam
              practice lets you change answers and reveals feedback after
              submission.
            </p>
            <small>
              Answers and your place are saved to your account across devices.
            </small>
          </div>
          {active && selected.length > 0 && (
            <nav
              className="practice-question-map"
              aria-label="Question navigation"
            >
              {selected.map((q, i) => (
                <button
                  key={questionId(q)}
                  disabled={busy}
                  onClick={() => go(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={active.answers[questionId(q)] ? "answered" : ""}
                  aria-label={`Question ${i + 1}${active.answers[questionId(q)] ? ", answered" : ""}`}
                >
                  {i + 1}
                </button>
              ))}
            </nav>
          )}
          <Link
            className="practice-source-link"
            href={`/lesson/${job.id}/source`}
          >
            Review lesson sources
          </Link>
        </aside>
        <div className="quiz-card practice-main-card">
          {loadingAttempt ? (
            <p role="status">Loading your saved attempt…</p>
          ) : !quiz.length ? (
            <>
              {settingsForm}
              <button
                className="btn dark"
                disabled={busy || !owner || !job.pages.length}
                onClick={() => void build()}
              >
                <Sparkles size={16} aria-hidden="true" />{" "}
                {busy ? "Building practice…" : "Generate practice"}
              </button>
              {!owner && <p>Ask the lesson owner to generate practice.</p>}
            </>
          ) : !active ? (
            <>
              <p className="eyebrow">{quiz.length} SAVED QUESTIONS</p>
              <h2>Choose how you want to practise</h2>
              <label>
                Mode
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="practice">Practice with feedback</option>
                  <option value="exam">Exam practice, delayed feedback</option>
                </select>
              </label>
              <button
                className="btn dark"
                disabled={busy}
                onClick={() => void act("start", { mode })}
              >
                Start saved attempt
              </button>
            </>
          ) : q ? (
            <>
              <div className="quiz-progress">
                <progress
                  value={answered}
                  max={selected.length}
                  aria-label="Saved answers"
                />
                <span>
                  {answered}/{selected.length} answered
                </span>
              </div>
              <div className="quiz-card-top">
                <span className="eyebrow">
                  QUESTION {index + 1} OF {selected.length}
                </span>
                <span className="quiz-chip">
                  {active.scope === "missed" ? "Missed concepts" : active.mode}
                </span>
              </div>
              {q.topic && <p className="practice-topic">{q.topic}</p>}
              <h2>{q.q}</h2>
              {active.mode === "practice" && !revealed && q.hint && (
                <div className="practice-hint">
                  <button
                    className="btn light"
                    onClick={() => setShowHint((h) => !h)}
                    aria-expanded={showHint}
                  >
                    {showHint ? "Hide hint" : "Show a hint"}
                  </button>
                  {showHint && <p role="status">{q.hint}</p>}
                </div>
              )}
              {q.type === "mcq" && q.options?.length ? (
                <div className="quiz-options">
                  {q.options.map((o, i) => (
                    <button
                      key={o}
                      aria-pressed={answer === o}
                      className={`quiz-opt ${answer === o ? "selected" : ""}`}
                      disabled={
                        busy ||
                        active.submitted ||
                        (active.mode === "practice" && !!stored)
                      }
                      onClick={() => setAnswer(o)}
                    >
                      <b>{String.fromCharCode(65 + i)}</b>
                      <span>{o}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <label>
                  Your answer
                  <textarea
                    value={answer}
                    rows={3}
                    maxLength={2000}
                    disabled={
                      busy ||
                      active.submitted ||
                      (active.mode === "practice" && !!stored)
                    }
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                </label>
              )}
              {!active.submitted && !(active.mode === "practice" && stored) && (
                <button
                  className="btn dark"
                  disabled={busy || !answer.trim()}
                  onClick={() => void act("answer", { question: key, answer })}
                >
                  {busy ? "Saving…" : "Save answer"}
                </button>
              )}
              {revealed && (
                <div className="practice-feedback" role="status">
                  <strong>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    {answerCorrect(q, stored || "")
                      ? "Correct"
                      : "Review this concept"}
                  </strong>
                  <p>Expected answer: {q.answer}</p>
                  <p>
                    {q.explanation ||
                      "Typed answers accept differences in case, spacing and trailing punctuation, plus saved accepted variants. Broader paraphrases require human review."}
                  </p>
                  <PracticeSources lesson={job.id} sources={q.sources} />
                </div>
              )}
              <div className="quiz-nav">
                <button
                  className="btn light"
                  disabled={busy || index === 0}
                  onClick={() => go(index - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn light"
                  disabled={busy || index === selected.length - 1}
                  onClick={() => go(index + 1)}
                >
                  Next
                </button>
              </div>
              {active.submitted ? (
                <section className="practice-result">
                  <p className="eyebrow">SAVED TO YOUR STUDY HISTORY</p>
                  <h2>
                    {active.correct}/{active.total} · saved practice result
                  </h2>
                  {missed.length > 0 ? (
                    <>
                      <p>
                        Revisit {missed.length} missed{" "}
                        {missed.length === 1 ? "concept" : "concepts"}, then try
                        them in a fresh saved attempt.
                      </p>
                      <button
                        className="btn dark"
                        disabled={busy}
                        onClick={() =>
                          void act("start", {
                            mode: "practice",
                            scope: "missed",
                          })
                        }
                      >
                        <RotateCcw size={16} aria-hidden="true" /> Retry missed
                        questions
                      </button>
                    </>
                  ) : (
                    <p>
                      You recalled every concept in this attempt. Keep the ideas
                      fresh with spaced flashcard review.
                    </p>
                  )}
                  <label>
                    Next attempt mode
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="practice">Practice with feedback</option>
                      <option value="exam">
                        Exam practice, delayed feedback
                      </option>
                    </select>
                  </label>
                  <button
                    className="btn light"
                    disabled={busy}
                    onClick={() => void act("start", { mode, scope: "all" })}
                  >
                    Start another attempt
                  </button>
                  <Link
                    className="btn light"
                    href={`/lesson/${job.id}/flashcards`}
                  >
                    Review flashcards
                  </Link>
                </section>
              ) : (
                <button
                  className="btn dark"
                  disabled={busy || answered !== selected.length}
                  onClick={() => void act("submit")}
                >
                  Submit and review
                </button>
              )}
              <p className="small">
                Arrow keys move between questions. These are study results, not
                proctored grades.
              </p>
            </>
          ) : null}
          {quiz.length > 0 && owner && (
            <details className="source-review">
              <summary>Rebuild practice questions</summary>
              <p className="small">
                New questions replace this lesson’s current quiz and flashcards.
                Submitted results stay in study history. Finish any active
                attempt first.
              </p>
              {settingsForm}
              <button
                className="btn light"
                disabled={
                  busy || loadingAttempt || (!!active && !active.submitted)
                }
                onClick={() => void build()}
              >
                {busy ? "Working…" : "Rebuild quiz and flashcards"}
              </button>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
