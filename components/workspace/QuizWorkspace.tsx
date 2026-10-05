"use client";
import { useEffect, useState } from "react";
import { useLesson } from "./LessonProvider";
import { requestJson } from "@/lib/http-client";
import { questionId, answerCorrect } from "@/lib/study/quiz";
interface Attempt {
  id: string;
  mode: "practice" | "exam";
  version: string;
  answers: Record<string, string>;
  submitted: boolean;
  correct: number;
  total: number;
}
export default function QuizWorkspace() {
  const { job } = useLesson();
  const quiz = job?.practice?.quiz || [];
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [mode, setMode] = useState("practice"),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [format, setFormat] = useState("mixed"),
    [difficulty, setDifficulty] = useState("standard");
  useEffect(() => {
    if (!job) return;
    let alive = true;
    void requestJson(`/api/student/quiz?lesson=${job.id}`)
      .then(({ response, data }) => {
        if (alive && response.ok) setAttempt(data.attempt);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [job?.id]);
  const q = quiz[index],
    key = q ? questionId(q, index) : "",
    stored = attempt?.answers[key],
    revealed =
      !!attempt &&
      (attempt.submitted || (attempt.mode === "practice" && !!stored));
  useEffect(() => setAnswer(stored || ""), [key, stored]);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson("/api/student/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson: job.id,
          action,
          attempt: attempt?.id,
          ...extra,
        }),
      });
      if (!response.ok) throw new Error(data.error);
      setAttempt(data.attempt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  async function build() {
    if (!job) return;
    setBusy(true);
    try {
      const { response, data } = await requestJson(
        "/api/practice",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            format,
            difficulty,
            regenerate: quiz.length > 0,
            size: Math.min(30, Math.max(8, job.pages.length * 3)),
            language: job.language,
            pages: job.pages.map((p) => ({
              topic: p.topic,
              markdown: p.markdown,
            })),
          }),
        },
        90000,
      );
      if (!response.ok) throw new Error(data.error);
      location.reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches("input,textarea,select,button"))
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => Math.min(quiz.length - 1, i + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [quiz.length]);
  if (!job) return null;
  return (
    <section className="quiz-room">
      <div className="quiz-card">
        <p className="eyebrow">RECALL WITH INTENTION</p>
        <h1>
          {attempt?.mode === "exam" ? "Exam practice" : "Practice this lesson"}
        </h1>
        <p>
          Practice locks your first answer before showing feedback. Exam
          practice allows changes and hides feedback until submission. Saved
          attempts resume across devices.
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {!quiz.length ? (
          <>
            <label>
              Question style
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="mixed">Mixed</option>
                <option value="mcq">Multiple choice</option>
                <option value="short">Typed answer</option>
              </select>
            </label>
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="foundation">Foundation</option>
                <option value="standard">Standard</option>
                <option value="challenge">Challenge</option>
              </select>
            </label>
            <button
              className="btn dark"
              disabled={busy}
              onClick={() => void build()}
            >
              Generate practice
            </button>
          </>
        ) : !attempt || attempt.version !== quiz.map(questionId).join("|") ? (
          <>
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
        ) : (
          <>
            <div className="quiz-progress">
              <progress
                value={Object.keys(attempt.answers).length}
                max={quiz.length}
                aria-label="Saved answers"
              />
              <span>
                {Object.keys(attempt.answers).length}/{quiz.length} answered
              </span>
            </div>
            <div className="quiz-card-top">
              <label>
                Question
                <select
                  value={index}
                  onChange={(e) => setIndex(Number(e.target.value))}
                >
                  {quiz.map((q, i) => (
                    <option key={questionId(q, i)} value={i}>
                      {i + 1}
                      {attempt.answers[questionId(q, i)] ? " · answered" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <span className="quiz-chip">{attempt.mode}</span>
            </div>
            <h2>{q.q}</h2>
            {q.type === "mcq" && q.options?.length ? (
              <div className="quiz-options">
                {q.options.map((o, i) => (
                  <button
                    key={o}
                    aria-pressed={answer === o}
                    className={`quiz-opt ${answer === o ? "selected" : ""}`}
                    disabled={
                      busy ||
                      attempt.submitted ||
                      (attempt.mode === "practice" && !!stored)
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
                    attempt.submitted ||
                    (attempt.mode === "practice" && !!stored)
                  }
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </label>
            )}
            {!attempt.submitted && !(attempt.mode === "practice" && stored) && (
              <button
                className="btn dark"
                disabled={busy || !answer.trim()}
                onClick={() => void act("answer", { question: key, answer })}
              >
                {busy ? "Saving…" : "Save answer"}
              </button>
            )}
            {revealed && (
              <div className="card" role="status">
                <strong>
                  {answerCorrect(q, stored || "")
                    ? "Correct"
                    : "Review this concept"}
                </strong>
                <p>Expected answer: {q.answer}</p>
                <p>
                  {(q as any).explanation ||
                    "Typed answers accept differences in case, spacing and trailing punctuation, plus saved accepted variants. Broader paraphrases require human review."}
                </p>
              </div>
            )}
            <div className="quiz-nav">
              <button
                className="btn light"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
              >
                Previous
              </button>
              <button
                className="btn light"
                disabled={index === quiz.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              >
                Next
              </button>
            </div>
            {attempt.submitted ? (
              <>
                <h2>
                  {attempt.correct}/{attempt.total} · saved practice result
                </h2>
                <button
                  className="btn light"
                  disabled={busy}
                  onClick={() => void act("start", { mode: attempt.mode })}
                >
                  Start another attempt
                </button>
              </>
            ) : (
              <button
                className="btn dark"
                disabled={
                  busy || Object.keys(attempt.answers).length !== quiz.length
                }
                onClick={() => void act("submit")}
              >
                Submit and review
              </button>
            )}
            <p className="small">
              Arrow keys move between questions. Answers and scores are saved by
              the server; these are study results, not proctored grades.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
