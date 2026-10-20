"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize2, BookOpen } from "lucide-react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "../WorkspaceProvider";
import SlideCanvas from "./SlideCanvas";
import type { Deck } from "@/lib/presentations/store";
import "./presentation-studio.css";
import "./hybrid/studio.css";
export default function SharedDeck({ token }: { token: string }) {
  const { user } = useAccount(),
    [deck, setDeck] = useState<Deck | null>(null),
    [active, setActive] = useState(0),
    [comments, setComments] = useState<any[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pulse, setPulse] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const { response, data } = await requestJson(
          `/api/presentations/share/${token}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        setDeck(data.deck);
        setComments(data.comments || []);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) {
          setDeck(null);
          setError((e as Error).message);
        }
      }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [token, pulse]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      )
        return;
      if (e.key === "ArrowRight")
        setActive((i) => Math.min((deck?.slides.length || 1) - 1, i + 1));
      if (e.key === "ArrowLeft") setActive((i) => Math.max(0, i - 1));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [deck?.slides.length]);
  const slide = deck?.slides[active];
  return (
    <main className="cv-shared">
      <header className="cv-shared-header">
        <div>
          <a href="/presentations" className="cv-eyebrow">
            SYAAHI / PRESENTATIONS
          </a>
          <h1>{deck?.title || "Shared presentation"}</h1>
          <p>Read-only deck · private sources and speaker notes stay private</p>
        </div>
        <button
          className="cv-button subtle"
          onClick={() =>
            void document.querySelector(".cv-shared-stage")?.requestFullscreen()
          }
          disabled={!slide}
        >
          <Maximize2 size={15} />
          Fullscreen
        </button>
      </header>
      {error && (
        <p className="cv-error" role="alert">
          {error}
        </p>
      )}
      {slide && deck && (
        <>
          <div className="cv-shared-stage">
            <SlideCanvas
              slide={slide}
              template={deck.template}
              brand={deck.brand}
              language={deck.language}
              index={active}
              imageBase={`/api/presentations/share/${token}/images/`}
            />
          </div>
          <nav
            className="cv-director-timeline"
            aria-label="Shared deck navigation"
          >
            <button
              className="cv-button subtle"
              aria-label="Previous slide"
              disabled={!active}
              onClick={() => setActive((i) => i - 1)}
            >
              <ArrowLeft size={16} />
              Previous
            </button>
            <div>
              <label htmlFor="shared-scene">
                <BookOpen size={13} />
                Scene {active + 1} of {deck.slides.length}
              </label>
              <input
                id="shared-scene"
                aria-label="Choose shared scene"
                type="range"
                min="0"
                max={deck.slides.length - 1}
                value={active}
                onChange={(e) => setActive(Number(e.target.value))}
              />
            </div>
            <button
              className="cv-button subtle"
              aria-label="Next slide"
              disabled={active === deck.slides.length - 1}
              onClick={() => setActive((i) => i + 1)}
            >
              Next
              <ArrowRight size={16} />
            </button>
          </nav>
          <section className="cv-discussion">
            <h2>Discuss this scene</h2>
            {comments
              .filter((c) => c.slide === slide.id)
              .map((c) => (
                <article key={c.id}>
                  <b>{c.name}</b>
                  <p>{c.text}</p>
                  <small>{new Date(c.at).toLocaleString()}</small>
                </article>
              ))}
            {user ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    const { response, data } = await requestJson(
                      `/api/presentations/share/${token}`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          slide: slide.id,
                          text,
                          event: crypto.randomUUID(),
                        }),
                      },
                    );
                    if (!response.ok) throw new Error(data.error);
                    setText("");
                    setPulse((p) => p + 1);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Comment on scene {active + 1}
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={1000}
                    rows={3}
                  />
                </label>
                <p className="cv-fineprint">
                  Your name and comment are visible to people with this link.
                </p>
                <button className="cv-button" disabled={busy || !text.trim()}>
                  Post comment
                </button>
              </form>
            ) : (
              <a
                className="cv-button"
                href={`/login?next=${encodeURIComponent(`/presentations/shared/${token}`)}`}
              >
                Sign in to comment
              </a>
            )}
          </section>
        </>
      )}
    </main>
  );
}
