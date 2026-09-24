"use client";
import { useEffect, useState } from "react";
import { useLesson } from "./LessonProvider";
interface Review {
  due: number;
  interval: number;
  repetitions: number;
}
export default function FlashcardsView() {
  const { job, refresh } = useLesson();
  const [cards, setCards] = useState(job?.practice?.flashcards ?? []),
    [ids, setIds] = useState<string[]>([]),
    [reviews, setReviews] = useState<Record<string, Review>>({}),
    [index, setIndex] = useState(0),
    [flip, setFlip] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dueOnly, setDueOnly] = useState(true);
  useEffect(() => {
    if (job?.practice?.flashcards) setCards(job.practice.flashcards);
  }, [job?.practice?.flashcards]);
  useEffect(() => {
    let alive = true;
    Promise.all(
      cards.map(async (c) => {
        const hash = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(c.front + "\n" + c.back),
        );
        return Array.from(new Uint8Array(hash))
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
          .slice(0, 20);
      }),
    ).then((values) => {
      if (alive) setIds(values);
    });
    return () => {
      alive = false;
    };
  }, [cards]);
  useEffect(() => {
    if (!job) return;
    fetch("/api/study")
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews?.[job.id] || {}))
      .catch(() => setError("Saved review schedule could not be loaded."));
  }, [job?.id]);
  async function build() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          pages: job.pages,
          language: job.language,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCards(d.flashcards);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cards unavailable.");
    } finally {
      setBusy(false);
    }
  }
  if (!job) return null;
  const queue = cards
    .map((_, i) => i)
    .filter(
      (i) => !dueOnly || !reviews[ids[i]] || reviews[ids[i]].due <= Date.now(),
    );
  const current = queue[Math.min(index, queue.length - 1)];
  const card = cards[current];
  async function rate(rating: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          lesson: job!.id,
          index: current,
          rating,
          event: crypto.randomUUID(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setReviews(d.reviews?.[job!.id] || {});
      setFlip(false);
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="quiz-room">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ACTIVE RECALL</span>
          <h1>Make the ideas stick.</h1>
        </div>
        <select
          aria-label="Flashcard review mode"
          value={dueOnly ? "due" : "all"}
          onChange={(e) => {
            setDueOnly(e.target.value === "due");
            setIndex(0);
            setFlip(false);
          }}
        >
          <option value="due">Due for review</option>
          <option value="all">All cards</option>
        </select>
      </div>
      <p className="small">
        Your review schedule is saved to your account. Again returns a card in
        10 minutes; stronger recall increases the interval.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!cards.length ? (
        <button
          className="btn dark"
          disabled={busy || !job.pages.length}
          onClick={build}
        >
          {busy ? "Building cards..." : "Generate flashcards"}
        </button>
      ) : !card ? (
        <div className="card">
          <h2>You’re up to date.</h2>
          <p>
            No cards are due right now. Come back later or switch to all cards.
          </p>
        </div>
      ) : (
        <>
          <div className="quiz-progress">
            <span>
              {Math.min(index + 1, queue.length)} of {queue.length}{" "}
              {dueOnly ? "due cards" : "cards"}
            </span>
          </div>
          <button
            className={`flip-card ${flip ? "flipped" : ""}`}
            onClick={() => setFlip(!flip)}
          >
            <span>{flip ? card.back : card.front}</span>
            <small>{flip ? "Answer" : "Question"} · tap to flip</small>
          </button>
          {flip && (
            <div className="review-ratings">
              {["again", "hard", "good", "easy"].map((r) => (
                <button
                  className="btn light"
                  disabled={busy}
                  key={r}
                  onClick={() => rate(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          <div className="quiz-nav">
            <button
              className="btn light"
              disabled={index === 0}
              onClick={() => {
                setIndex(index - 1);
                setFlip(false);
              }}
            >
              ← Previous
            </button>
            <button
              className="btn light"
              disabled={index >= queue.length - 1}
              onClick={() => {
                setIndex(index + 1);
                setFlip(false);
              }}
            >
              Next →
            </button>
          </div>
          {reviews[ids[current]] && (
            <p className="small">
              Next review:{" "}
              {new Date(reviews[ids[current]].due).toLocaleString()} ·{" "}
              {reviews[ids[current]].repetitions} reviews
            </p>
          )}
        </>
      )}
    </div>
  );
}
