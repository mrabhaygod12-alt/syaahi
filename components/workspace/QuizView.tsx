"use client";
import { useEffect, useMemo, useState } from "react";
import { useLesson } from "./LessonProvider";
import type { QuizQ } from "./types";

function optionLetter(i: number) {
  return String.fromCharCode(65 + i);
}

export default function QuizView() {
  const { job } = useLesson();
  const [quiz, setQuiz] = useState<QuizQ[]>(job?.practice?.quiz ?? []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [hint, setHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [format, setFormat] = useState("mcq");
  const [difficulty, setDifficulty] = useState("standard"),
    [focus, setFocus] = useState(""),
    [saved, setSaved] = useState(false);

  useEffect(() => {
    setQuiz(job?.practice?.quiz ?? []);
  }, [job?.practice?.quiz]);

  async function build() {
    if (!job?.pages.length) return;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          difficulty,
          focus,
          jobId: job.id,
          regenerate: quiz.length > 0,
          pages: job.pages.map((p) => ({
            topic: p.topic,
            markdown: p.markdown,
          })),
          size: Math.min(30, Math.max(8, job.pages.length * 3)),
          language: job.language ?? "english",
        }),
      });
      const j = await r.json();
      if (j.error) {
        setErr(j.error);
        return;
      }
      setQuiz(j.quiz ?? []);
      setI(0);
      setPicked({});
      setHint(false);
      setSaved(false);
    } catch {
      setErr("Could not reach the practice service. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  const items = useMemo(() => {
    if (!shuffle) return quiz;
    return [...quiz].sort((a, b) => a.q.localeCompare(b.q));
  }, [quiz, shuffle]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === "ArrowRight")
        setI((n) => Math.min(items.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      const num = Number(e.key);
      if (num >= 1 && num <= 4) {
        const opt = items[i]?.options?.[num - 1];
        if (opt) setPicked((p) => ({ ...p, [i]: opt }));
      }
      if (e.key === "h") setHint(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, i]);

  if (!job) return null;
  if (!items.length) {
    return (
      <div className="quiz-empty">
        <h1>Practice this lesson</h1>
        <p className="small">Build a quiz grounded in this lesson’s notes.</p>
        <div className="quiz-settings">
          <label>
            Question type
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="mcq">Multiple choice</option>
              <option value="blank">Fill the blank</option>
              <option value="short">Short answer</option>
              <option value="mixed">Mixed practice</option>
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
          <label>
            Focus topic
            <input
              type="text"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Optional topic or chapter"
            />
          </label>
        </div>
        {err && (
          <p className="small" style={{ color: "#dc2626" }}>
            {err}
          </p>
        )}
        <button className="btn dark" disabled={loading} onClick={build}>
          {loading ? "Building…" : "Generate quiz"}
        </button>
      </div>
    );
  }

  const q = items[i];
  const total = items.length;
  const pct = Math.round(((i + 1) / total) * 100);
  const topicChip =
    q.topic || job.topics[Math.min(i, job.topics.length - 1)] || "Practice";

  return (
    <div className="quiz-room">
      <div className="quiz-progress">
        <div className="quiz-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <span>
          {i + 1} / {total}
        </span>
      </div>
      <div className="quiz-card">
        <div className="quiz-settings">
          <label>
            Question type
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="mcq">Multiple choice</option>
              <option value="blank">Fill the blank</option>
              <option value="short">Short answer</option>
              <option value="mixed">Mixed practice</option>
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
          <label>
            Focus
            <input
              type="text"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Optional topic"
            />
          </label>
        </div>
        <div className="quiz-card-top">
          <label>
            Question
            <select
              value={i}
              onChange={(e) => {
                setI(Number(e.target.value));
                setHint(false);
              }}
            >
              {items.map((_, n) => (
                <option key={n} value={n}>
                  Question {n + 1}
                </option>
              ))}
            </select>
          </label>
          <span className="quiz-chip">{topicChip}</span>
          <button
            className="btn light"
            onClick={() => {
              setShuffle(!shuffle);
              setPicked({});
              setI(0);
              setSaved(false);
            }}
          >
            Change question order
          </button>
        </div>
        <h1>{q.q}</h1>
        <div className="quiz-options">
          {(q.type === "mcq" && q.options?.length ? q.options : []).map(
            (o, n) => {
              const selected = picked[i] === o;
              const reveal = selected && q.answer;
              const correct = reveal && o === q.answer;
              const wrong = reveal && o !== q.answer;
              return (
                <button
                  key={o}
                  className={`quiz-opt ${selected ? "selected" : ""} ${correct ? "ok" : ""} ${wrong ? "bad" : ""}`}
                  onClick={() => setPicked((p) => ({ ...p, [i]: o }))}
                >
                  <b>{optionLetter(n)}</b>
                  <span>{o}</span>
                </button>
              );
            },
          )}
        </div>
        {q.type !== "mcq" && (
          <input
            placeholder="Type your answer"
            value={picked[i] ?? ""}
            onChange={(e) => setPicked((p) => ({ ...p, [i]: e.target.value }))}
          />
        )}
        {picked[i] && q.type === "mcq" && q.explanation && (
          <div className="card">
            <b>Why this answer?</b>
            <p>{q.explanation}</p>
          </div>
        )}
        <button className="quiz-hint" onClick={() => setHint(true)}>
          Show Hint
        </button>
        {hint && (
          <p className="small">
            {q.hint ||
              "Re-read the matching notes section, then eliminate two options."}
          </p>
        )}
        <div className="quiz-nav">
          <button
            className="btn light"
            disabled={i === 0}
            onClick={() => {
              setI(i - 1);
              setHint(false);
            }}
          >
            ‹ Previous
          </button>
          <button
            className="btn dark"
            disabled={i >= total - 1}
            onClick={() => {
              setI(i + 1);
              setHint(false);
            }}
          >
            Next ›
          </button>
        </div>
        <p className="small">
          Answered {Object.keys(picked).length} of {total} · Correct{" "}
          {items.filter((item, n) => picked[n] === item.answer).length}
        </p>
        {picked[i] && q.type === "mcq" && picked[i] !== q.answer && (
          <p className="inline-error">
            Review this concept. The expected answer is: {q.answer}
          </p>
        )}
        {saved&&q.type!=='mcq'&&<div className="card"><b>Expected answer: {q.answer}</b><p>{q.explanation||'Compare your response with the term in the notes. Typed answers are checked as exact text.'}</p></div>}
        <button
          className="btn dark"
          disabled={saved || Object.keys(picked).length < total}
          onClick={async () => {
            try {
              const response = await fetch("/api/study", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "quiz-attempt",
                  questions:quiz.map(item=>item.q),
                  lesson: job.id,
                  answers: quiz.map(
                    (item) => picked[items.indexOf(item)] || "",
                  ),
                }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              setSaved(true);
            } catch (e) {
              setErr(
                e instanceof Error ? e.message : "Could not save results.",
              );
            }
          }}
        >
          {saved ? "Result saved to your account" : "Save completed quiz"}
        </button>
        <p className="quiz-keys">
          <kbd>←</kbd>
          <kbd>→</kbd> move · <kbd>1</kbd>–<kbd>4</kbd> pick · <kbd>H</kbd> hint
          · <kbd>?</kbd> this help
        </p>
        <button className="btn light" disabled={loading} onClick={build}>
          {loading ? "Rebuilding…" : "Rebuild quiz"}
        </button>
        {err && (
          <p className="small" style={{ color: "#dc2626" }}>
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
