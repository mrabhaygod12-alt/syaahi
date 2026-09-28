"use client";

import { useEffect, useState } from "react";

type Track = "Software engineering" | "Data & analytics" | "Behavioural";
type Question = { question: string; competency: string; guidance: string };
type InterviewSession = {
  id: string;
  track: Track;
  targetRole: string;
  createdAt: string;
  questions: Question[];
  reviews: Array<{ question: string; feedback: string; at: string }>;
};
type SessionSummary = {
  id: string;
  track: Track;
  targetRole: string;
  createdAt: string;
  total: number;
  completed: number;
};

const tracks: Track[] = [
  "Software engineering",
  "Data & analytics",
  "Behavioural",
];

function errorMessage(value: unknown) {
  return value && typeof value === "object" && "error" in value
    ? String(value.error)
    : "Something went wrong. Please try again.";
}

export default function InterviewPractice() {
  const [track, setTrack] = useState<Track>("Software engineering");
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const current = session?.questions[index];

  async function loadHistory() {
    const response = await fetch("/api/interview", { cache: "no-store" });
    if (response.status === 401) return;
    const data = await response.json().catch(() => null);
    if (response.ok && data?.sessions) setHistory(data.sessions);
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function resetQuestion() {
    setAnswer("");
    setFeedback("");
    setMessage("");
    setSeconds(0);
    setRunning(false);
  }

  async function buildPlan() {
    setBusy(true);
    setMessage("");
    setFeedback("");
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plan", track, targetRole, jobDescription }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        window.location.assign("/login?next=/interview");
        return;
      }
      if (!response.ok || !data?.session) throw new Error(errorMessage(data));
      setSession(data.session);
      setIndex(0);
      resetQuestion();
      setMessage("Your private practice plan is ready and saved to this account.");
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not build a plan.");
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    if (!current || !session) return;
    setBusy(true);
    setFeedback("");
    setMessage("");
    setRunning(false);
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track,
          targetRole,
          jobDescription,
          sessionId: session.id,
          question: current.question,
          answer,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        window.location.assign("/login?next=/interview");
        return;
      }
      if (!response.ok) throw new Error(errorMessage(data));
      setFeedback(data.feedback);
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Feedback is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  function nextQuestion() {
    if (!session) return;
    setIndex((value) => (value + 1) % session.questions.length);
    resetQuestion();
  }

  return (
    <div className="wrap feature-section">
      <div className="tabs-row" role="tablist" aria-label="Interview tracks">
        {tracks.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={track === value}
            onClick={() => {
              setTrack(value);
              setSession(null);
              resetQuestion();
            }}
          >
            {value}
          </button>
        ))}
      </div>

      {!session ? (
        <section className="interactive-panel" style={{ maxWidth: 780 }}>
          <span className="eyebrow">PRIVATE, ROLE-SPECIFIC PRACTICE</span>
          <h2>Build a five-question interview plan.</h2>
          <p className="small">
            Add the role and only relevant, non-confidential requirements. Your
            private plan is saved to your account so you can return to it later.
          </p>
          <label className="small">
            Target role (optional)
            <input
              value={targetRole}
              maxLength={160}
              placeholder="e.g. Junior frontend developer"
              onChange={(event) => setTargetRole(event.target.value)}
            />
          </label>
          <label className="small">
            Job requirements (optional, never published)
            <textarea
              rows={5}
              maxLength={4000}
              placeholder="Paste skills or responsibilities. Do not include credentials, client data, or confidential material."
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
            />
          </label>
          <button className="btn dark" disabled={busy} onClick={buildPlan}>
            {busy ? "Building your plan..." : "Build my practice plan"}
          </button>
          {message && <p className="small" aria-live="polite">{message}</p>}
        </section>
      ) : (
        <div className="steps-grid">
          <section className="interactive-panel">
            <div className="section-heading">
              <span className="eyebrow">
                QUESTION {index + 1} OF {session.questions.length} · {current?.competency}
              </span>
              <span className="badge">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </span>
            </div>
            <h2>{current?.question}</h2>
            <p className="small">{current?.guidance}</p>
            <button className="btn light" onClick={() => setRunning((value) => !value)}>
              {running ? "Pause timer" : "Start timer"}
            </button>
            <textarea
              rows={9}
              aria-label="Your interview answer"
              placeholder="Write your answer here..."
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              maxLength={6000}
            />
            <div className="hero-actions">
              <button className="btn dark" disabled={busy || answer.trim().length < 30} onClick={review}>
                {busy ? "Reviewing..." : "Get AI coaching"}
              </button>
              <button className="btn light" onClick={nextQuestion}>Next question →</button>
              <button className="btn light" onClick={() => { setSession(null); resetQuestion(); }}>
                New plan
              </button>
            </div>
            <p className="small">
              This is private practice feedback, not a hiring assessment or a human interview.
            </p>
            {message && <p className="small" aria-live="polite">{message}</p>}
          </section>
          <aside className="interactive-panel">
            <span className="eyebrow">YOUR COACHING NOTES</span>
            {feedback ? (
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }} aria-live="polite">{feedback}</div>
            ) : (
              <>
                <h2>A stronger answer has structure.</h2>
                <ol>
                  <li>Clarify the problem and assumptions.</li>
                  <li>Explain your reasoning step by step.</li>
                  <li>Use evidence, an example, or a trade-off.</li>
                  <li>Close with what you learned or would test.</li>
                </ol>
              </>
            )}
            <hr />
            <a className="btn light" href={`/dashboard?topic=${encodeURIComponent(`${track} interview preparation: ${current?.question || ""}`)}>`}>
              Build notes for this question ↗
            </a>
          </aside>
        </div>
      )}

      {history.length > 0 && (
        <section className="interactive-panel" style={{ marginTop: 24 }}>
          <span className="eyebrow">SAVED PRACTICE</span>
          <h2>Continue where you left off.</h2>
          <ul>
            {history.slice(0, 5).map((item) => (
              <li key={item.id}>
                {item.track}{item.targetRole ? ` · ${item.targetRole}` : ""} — {item.completed}/{item.total} answers reviewed
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
