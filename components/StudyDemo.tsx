"use client";
import { useState } from "react";
const rooms = ["Notes", "Lesson", "Quiz", "Flashcards"];
export default function StudyDemo() {
  const [room, setRoom] = useState("Notes"),
    [answer, setAnswer] = useState<number | null>(null),
    [flipped, setFlipped] = useState(false),
    [step, setStep] = useState(0);
  return (
    <section
      className="wrap product-demo"
      id="try-demo"
      aria-labelledby="demo-heading"
    >
      <div className="demo-story">
        <p className="eyebrow">TRY THE STUDY EXPERIENCE</p>
        <h2 id="demo-heading">
          One idea.
          <br />
          <em>Four ways to learn it.</em>
        </h2>
        <p>
          Explore binary search in this hand-reviewed interactive sample. The
          same study rooms are available in your own lessons.
        </p>
        <ol>
          <li>Read a clear explanation</li>
          <li>Work through the idea</li>
          <li>Check what you remember</li>
        </ol>
        <a className="btn dark" href="/dashboard">
          Use my own material →
        </a>
        <p className="small">Sample content · no account needed to try</p>
      </div>
      <div className="demo-workspace">
        <div className="demo-window">
          <span />
          <span />
          <span />
          <b>Binary search · Study desk</b>
        </div>
        <div
          className="demo-tabs"
          role="tablist"
          aria-label="Sample study rooms"
        >
          {rooms.map((r) => (
            <button
              key={r}
              role="tab"
              id={`demo-tab-${r}`}
              aria-controls="demo-panel"
              aria-selected={room === r}
              onClick={() => setRoom(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div
          id="demo-panel"
          role="tabpanel"
          aria-labelledby={`demo-tab-${room}`}
          className="demo-content"
          key={room}
        >
          {room === "Notes" ? (
            <div className="demo-notebook">
              <h3>Binary search</h3>
              <h4>The key idea</h4>
              <p>
                In a sorted list, compare the target with the middle item. Keep
                only the half that can contain it.
              </p>
              <div className="demo-flow">
                <span>Sorted list</span>
                <i>↓</i>
                <span>Compare the middle</span>
                <i>↓</i>
                <span>Keep the relevant half</span>
              </div>
              <p>
                <strong>Remember:</strong> the list must be sorted.
              </p>
            </div>
          ) : room === "Lesson" ? (
            <>
              <p className="eyebrow">UNDERSTAND · {step + 1} OF 3</p>
              <h3>
                {
                  [
                    "Start with the middle",
                    "Choose a half",
                    "Repeat until you find it",
                  ][step]
                }
              </h3>
              <p>
                {
                  [
                    "Look for 14 in [2, 5, 8, 11, 14, 17, 20]. The middle value is 11.",
                    "14 is larger than 11. Discard 11 and everything to its left. Now search [14, 17, 20].",
                    "Compare 14 with the new middle, 17. Search the left half: [14]. You found the target.",
                  ][step]
                }
              </p>
              <div className="demo-array">
                {[2, 5, 8, 11, 14, 17, 20].map((n) => (
                  <span
                    key={n}
                    className={
                      n === (step === 0 ? 11 : step === 1 ? 17 : 14)
                        ? "selected"
                        : ""
                    }
                  >
                    {n}
                  </span>
                ))}
              </div>
              <button
                className="btn dark"
                onClick={() => setStep((step + 1) % 3)}
              >
                {step === 2 ? "Start again" : "Continue"} →
              </button>
            </>
          ) : room === "Quiz" ? (
            <>
              <p className="eyebrow">CHECK YOUR UNDERSTANDING</p>
              <h3>What must be true before using binary search?</h3>
              <div className="demo-options">
                {[
                  "The list is sorted",
                  "The list has an even length",
                  "Every value is positive",
                ].map((o, i) => (
                  <button
                    key={o}
                    className={answer === i ? "selected" : ""}
                    onClick={() => setAnswer(i)}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {answer !== null && (
                <p role="status">
                  {answer === 0
                    ? "Correct. Sorting lets us decide which half can contain the target."
                    : "Try again. Think about how we decide which half to discard."}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="eyebrow">ACTIVE RECALL</p>
              <button
                className="demo-flashcard"
                onClick={() => setFlipped(!flipped)}
                aria-label={flipped ? "Show question" : "Reveal answer"}
              >
                <span>{flipped ? "ANSWER" : "QUESTION"}</span>
                <h3>
                  {flipped
                    ? "O(log n): each comparison roughly halves the remaining search space."
                    : "What is the time complexity of binary search, and why?"}
                </h3>
                <small>
                  {flipped
                    ? "Click to return to question"
                    : "Think first. Click to reveal."}
                </small>
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
