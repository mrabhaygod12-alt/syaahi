"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import SlideCanvas from "./SlideCanvas";
import type { Deck } from "@/lib/presentations/store";
import "./presentation-studio.css";
import { useAccount } from "../WorkspaceProvider";
export default function SharedDeck({ token }: { token: string }) {
  const { user } = useAccount();
  const [comments, setComments] = useState<any[]>([]),
    [text, setText] = useState(""),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [pulse, setPulse] = useState(0);
  const [deck, setDeck] = useState<Deck | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const load = () =>
      void requestJson(`/api/presentations/share/${token}`)
        .then(({ response, data }) => {
          if (!response.ok) throw new Error(data.error);
          if (alive) {
            setDeck(data.deck);
            setComments(data.comments || []);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) {
            setDeck(null);
            setError(e.message);
          }
        });
    load();
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token, pulse]);
  return (
    <section className="deck-workbench">
      <header className="studio-header">
        <h1>{deck?.title || "Shared presentation"}</h1>
        <p>Read-only slide view · private notes are excluded</p>
      </header>
      <div className="studio-centre">
        {error && <p role="alert">{error}</p>}
        {deck?.slides.map((s, i) => (
          <div key={s.id || i} style={{ marginBottom: 24 }}>
            <SlideCanvas
              slide={s}
              language={deck.language}
              template={deck.template}
              brand={deck.brand}
              index={i}
              imageBase={`/api/presentations/share/${token}/images/`}
            />
            <details>
              <summary>
                Discussion · {comments.filter((c) => c.slide === s.id).length}{" "}
                comments
              </summary>
              {comments
                .filter((c) => c.slide === s.id)
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
                            slide: s.id,
                            text,
                            event: crypto.randomUUID(),
                          }),
                        },
                      );
                      if (!response.ok) throw new Error(data.error);
                      setText("");
                      setPulse((n) => n + 1);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Could not post comment.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Comment on slide {i + 1}
                    <textarea
                      value={selected === s.id ? text : ""}
                      maxLength={1000}
                      onFocus={() => {
                        if (selected !== s.id) {
                          setText("");
                          setSelected(s.id!);
                        }
                      }}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </label>
                  <p>
                    Your name and comment are visible to people with this link.
                  </p>
                  <button disabled={busy || selected !== s.id || !text.trim()}>
                    Post comment
                  </button>
                </form>
              ) : (
                <p>
                  <a
                    href={`/login?next=${encodeURIComponent("/presentations/shared/" + token)}`}
                  >
                    Sign in to comment
                  </a>
                </p>
              )}
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}
