"use client";
import { useEffect, useState } from "react";
import { useLesson } from "./LessonProvider";
interface Review {
  due: number;
  interval: number;
  repetitions: number;
}
type Flashcard = {
  front: string;
  back: string;
  type?: "basic" | "cloze" | "ordering" | "image";
  topic?: string;
  items?: string[];
  imageAlt?: string;
};

function clozePrompt(front: string) {
  return front.replace(/\{\{c1::([^{}]+)\}\}/g, "_____");
}

function VisualMnemonic({ label }: { label: string }) {
  const safe = label.slice(0, 140);
  return (
    <svg className="flashcard-visual" viewBox="0 0 600 230" role="img" aria-label={safe}>
      <defs>
        <linearGradient id="flashcard-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#eff6ee" />
          <stop offset="1" stopColor="#d9ece0" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="584" height="214" rx="28" fill="url(#flashcard-gradient)" stroke="#b7d0be" strokeWidth="3" />
      <circle cx="92" cy="110" r="48" fill="#205641" opacity=".92" />
      <path d="M76 110h32M92 94v32" stroke="white" strokeWidth="8" strokeLinecap="round" />
      <path d="M164 160 C235 70, 345 200, 438 84" fill="none" stroke="#719b79" strokeWidth="7" strokeLinecap="round" strokeDasharray="8 13" />
      <circle cx="460" cy="80" r="18" fill="#be8a42" />
      <text x="164" y="118" fill="#173b30" fontSize="28" fontFamily="Arial, sans-serif" fontWeight="700">{safe}</text>
      <text x="164" y="154" fill="#466356" fontSize="17" fontFamily="Arial, sans-serif">Visual recall cue</text>
    </svg>
  );
}

export default function FlashcardsView() {
  const { job, refresh } = useLesson();
  const [cards, setCards] = useState<Flashcard[]>(
      job?.practice?.flashcards ?? [],
    ),
    [ids, setIds] = useState<string[]>([]),
    [reviews, setReviews] = useState<Record<string, Review>>({}),
    [index, setIndex] = useState(0),
    [flip, setFlip] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dueOnly, setDueOnly] = useState(true),
    [order, setOrder] = useState<string[]>([]);
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
  useEffect(() => {
    const items = card?.type === "ordering" ? [...(card.items || [])] : [];
    items.sort(() => Math.random() - 0.5);
    // Do not present an already solved sequence unless there is only one item.
    if (
      items.length > 1 &&
      items.every((item, itemIndex) => item === card?.items?.[itemIndex])
    ) {
      [items[0], items[1]] = [items[1], items[0]];
    }
    setOrder(items);
  }, [card]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      if (!card || busy || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlip((value) => !value);
      }
      if (flip && ["1", "2", "3", "4"].includes(event.key)) {
        const ratings = ["again", "hard", "good", "easy"];
        void rate(ratings[Number(event.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, busy, flip, current]);
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
          {card.type === "ordering" && !flip ? (
            <div className="ordering-card">
              <h2>{card.front}</h2>
              <p className="small">
                Put the steps in the correct order, then reveal the sequence.
              </p>
              {order.map((item, itemIndex) => (
                <div className="ordering-step" key={`${item}-${itemIndex}`}>
                  <span>{itemIndex + 1}</span>
                  <b>{item}</b>
                  <button
                    type="button"
                    aria-label={`Move ${item} up`}
                    disabled={itemIndex === 0}
                    onClick={() =>
                      setOrder((currentOrder) => {
                        const next = [...currentOrder];
                        [next[itemIndex - 1], next[itemIndex]] = [
                          next[itemIndex],
                          next[itemIndex - 1],
                        ];
                        return next;
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item} down`}
                    disabled={itemIndex === order.length - 1}
                    onClick={() =>
                      setOrder((currentOrder) => {
                        const next = [...currentOrder];
                        [next[itemIndex + 1], next[itemIndex]] = [
                          next[itemIndex],
                          next[itemIndex + 1],
                        ];
                        return next;
                      })
                    }
                  >
                    ↓
                  </button>
                </div>
              ))}
              <button
                className="btn dark"
                type="button"
                onClick={() => setFlip(true)}
              >
                Reveal sequence
              </button>
            </div>
          ) : (
            <button
              className={`flip-card ${flip ? "flipped" : ""}`}
              onClick={() => setFlip(!flip)}
              aria-label={flip ? "Show question" : "Show answer"}
            >
              {!flip && card.type === "image" && card.imageAlt && (
                <VisualMnemonic label={card.imageAlt} />
              )}
              <span>
                {flip
                  ? card.type === "ordering"
                    ? `Correct order: ${(card.items || []).join(" → ")}\n\n${card.back}`
                    : card.back
                  : card.type === "cloze"
                    ? clozePrompt(card.front)
                    : card.front}
              </span>
              <small>
                {flip
                  ? "Explanation"
                  : card.type === "cloze"
                    ? "Fill the missing idea"
                    : "Question"}{" "}
                · tap, Enter, or Space to flip
              </small>
            </button>
          )}
          {flip && (
            <div className="review-ratings">
              {["again", "hard", "good", "easy"].map((r, ratingIndex) => (
                <button
                  className="btn light"
                  disabled={busy}
                  key={r}
                  onClick={() => rate(r)}
                >
                  {r} <small>({ratingIndex + 1})</small>
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
