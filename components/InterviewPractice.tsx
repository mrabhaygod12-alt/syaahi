"use client";
import { useState, useEffect } from "react";
const tracks: Record<string, string[]> = {
  "Software engineering": [
    "Explain how you would find a bug that only happens in production.",
    "Compare binary search with linear search and explain their assumptions.",
    "How would you design a rate limiter for a public API?",
  ],
  "Data & analytics": [
    "How would you investigate a sudden drop in a product metric?",
    "Explain the difference between correlation and causation with an example.",
    "How would you handle missing values in a dataset?",
  ],
  Behavioural: [
    "Tell me about a time you disagreed with a teammate.",
    "Describe a project that did not go as planned. What changed afterwards?",
    "Tell me about a difficult decision you made with incomplete information.",
  ],
};
export default function InterviewPractice() {
  const [track, setTrack] = useState("Software engineering"),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [seconds, setSeconds] = useState(0),
    [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  async function review() {
    setBusy(true);
    setFeedback("");
    setRunning(false);
    try {
      const r = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: tracks[track][index], answer, track }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setFeedback(d.feedback);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Feedback unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap feature-section">
      <div className="tabs-row" role="tablist" aria-label="Interview tracks">
        {Object.keys(tracks).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={track === t}
            onClick={() => {
              setTrack(t);
              setIndex(0);
              setFeedback("");
              setAnswer("");
              setSeconds(0);
              setRunning(false);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="steps-grid">
        <section className="interactive-panel">
          <div className="section-heading">
            <span className="eyebrow">
              QUESTION {index + 1} OF {tracks[track].length}
            </span>
            <span className="badge">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </span>
          </div>
          <h2>{tracks[track][index]}</h2>
          <button className="btn light" onClick={() => setRunning(!running)}>
            {running ? "Pause timer" : "Start timer"}
          </button>
          <p className="small">
            Think aloud, state your assumptions, and use a concrete example.
          </p>
          <textarea
            rows={9}
            aria-label="Your interview answer"
            placeholder="Write your answer here..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={6000}
          />
          <div className="hero-actions">
            <button
              className="btn dark"
              disabled={busy || answer.trim().length < 30}
              onClick={review}
            >
              {busy ? "Reviewing..." : "Get AI coaching"}
            </button>
            <button
              className="btn light"
              onClick={() => {
                setIndex((index + 1) % tracks[track].length);
                setAnswer("");
                setFeedback("");
                setSeconds(0);
                setRunning(false);
              }}
            >
              Next question →
            </button>
          </div>
          <p className="small">
            AI coaching requires an account. It is practice feedback, not a
            hiring assessment.
          </p>
        </section>
        <aside className="interactive-panel">
          <span className="eyebrow">YOUR COACHING NOTES</span>
          {feedback ? (
            <div
              style={{ whiteSpace: "pre-wrap", fontSize: 14 }}
              aria-live="polite"
            >
              {feedback}
            </div>
          ) : (
            <>
              <h2>A stronger answer has structure.</h2>
              <ol>
                <li>Clarify the problem and assumptions.</li>
                <li>Explain your reasoning step by step.</li>
                <li>Use evidence, an example, or a trade-off.</li>
                <li>Close with what you learned or would test.</li>
              </ol>
              <p className="small">
                Your feedback will identify strengths, gaps, and one follow-up
                question.
              </p>
            </>
          )}
          <hr />
          <a
            className="btn light"
            href={`/dashboard?topic=${encodeURIComponent(track + " interview preparation: " + tracks[track][index])}`}
          >
            Build notes for this question ↗
          </a>
        </aside>
      </div>
    </div>
  );
}
