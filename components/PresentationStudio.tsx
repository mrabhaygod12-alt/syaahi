"use client";
import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import {
  DECK_TEMPLATES,
  type DeckSlide,
  type DeckTemplate,
} from "@/lib/presentations/model";
interface DeckView {
  id: string;
  title: string;
  status: string;
  slides: DeckSlide[];
  count: number;
  template: DeckTemplate;
  updatedAt: string;
  error: string | null;
  provider: string | null;
}
export function SlidePreview({
  slide,
  template,
  index,
}: {
  slide: DeckSlide;
  template: DeckTemplate;
  index: number;
}) {
  const theme = DECK_TEMPLATES[template];
  return (
    <article
      className={`slide-preview layout-${slide.layout}`}
      style={
        {
          background: `#${theme.background}`,
          color: `#${theme.ink}`,
          "--slide-accent": `#${theme.accent}`,
        } as React.CSSProperties
      }
      aria-label={`Slide ${index + 1}: ${slide.title}`}
    >
      <div className="slide-accent" />
      <h3>{slide.title}</h3>
      {slide.subtitle && <p>{slide.subtitle}</p>}
      {slide.layout === "comparison" ? (
        <div className="slide-columns">
          {slide.columns.map((c, i) => (
            <section key={i}>
              <h4>{c.title}</h4>
              <ul>
                {c.points.map((p, j) => (
                  <li key={j}>{p}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : slide.layout === "process" ? (
        <ol className="slide-steps">
          {slide.steps.map((p, i) => (
            <li key={i}>
              <strong>{String(i + 1).padStart(2, "0")}</strong>
              {p}
            </li>
          ))}
        </ol>
      ) : slide.layout === "table" ? (
        <table>
          {slide.table.map((row, i) => (
            <tbody key={i}>
              <tr>
                {row.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            </tbody>
          ))}
        </table>
      ) : slide.layout === "chart" && slide.chart ? (
        <div className="slide-chart" aria-label={slide.chart.label}>
          {slide.chart.labels.map((label, i) => (
            <div key={i}>
              <span>{label}</span>
              <div
                style={{
                  width: `${Math.max(2, (Math.abs(slide.chart!.values[i]) / Math.max(1, ...slide.chart!.values.map(Math.abs))) * 65)}%`,
                  background: `#${theme.accent}`,
                }}
              />
              <strong>{slide.chart!.values[i]}</strong>
            </div>
          ))}
        </div>
      ) : slide.layout !== "cover" ? (
        <ol>
          {slide.bullets.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      ) : null}
      <footer>
        {slide.citations.join(" · ")}
        <span>{index + 1}</span>
      </footer>
    </article>
  );
}
export default function PresentationStudio({ id }: { id?: string }) {
  const [decks, setDecks] = useState<DeckView[]>([]),
    [deck, setDeck] = useState<DeckView | null>(null),
    [max, setMax] = useState(6),
    [prompt, setPrompt] = useState(""),
    [context, setContext] = useState(""),
    [language, setLanguage] = useState("English"),
    [count, setCount] = useState(6),
    [template, setTemplate] = useState<DeckTemplate>("editorial"),
    [busy, setBusy] = useState(false),
    [guest, setGuest] = useState(false),
    [message, setMessage] = useState(""),
    [editIndex, setEditIndex] = useState(-1),
    [edited, setEdited] = useState<DeckSlide | null>(null);
  const load = useCallback(async () => {
    const { response, data } = await requestJson(
      id ? `/api/presentations/${id}` : "/api/presentations",
    );
    if (response.status === 401) {
      setGuest(true);
      return;
    }
    if (!response.ok) throw new Error(data.error);
    if (id) setDeck(data.deck);
    else {
      setDecks(data.decks);
      setMax(data.maxSlides);
    }
  }, [id]);
  useEffect(() => {
    let alive = true;
    void load().catch((e) => alive && setMessage(e.message));
    return () => {
      alive = false;
    };
  }, [load]);
  useEffect(() => {
    if (!deck || !["queued", "working"].includes(deck.status)) return;
    let stopped = false;
    const timer = setTimeout(() => {
      if (!stopped) void load().catch((e) => setMessage(e.message));
    }, 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [deck, load]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { response, data } = await requestJson("/api/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context, language, count, template }),
      });
      if (!response.ok) throw new Error(data.error);
      location.assign(`/presentations/${data.deck.id}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not start.");
      setBusy(false);
    }
  }
  async function update(body: unknown) {
    setBusy(true);
    try {
      const { response, data } = await requestJson(`/api/presentations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(data.error);
      setDeck(data.deck);
      setEditIndex(-1);
      setEdited(null);
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  if (guest)
    return (
      <section className="card">
        <h2>Save presentations to your workspace</h2>
        <p>Sign in to generate, edit and download your decks.</p>
        <a
          className="btn dark"
          href={`/login?next=${id ? `/presentations/${id}` : "/presentations"}`}
        >
          Log in
        </a>
      </section>
    );
  return (
    <div className="presentation-studio">
      {message && <p role="status">{message}</p>}
      {id ? (
        deck ? (
          <>
            <header>
              <a href="/presentations">All presentations</a>
              <h1>{deck.title}</h1>
              <p role="status">
                {deck.status === "done"
                  ? "Ready to edit and export"
                  : `${deck.status}: ${deck.slides.length} of ${deck.count} slides saved`}
                {deck.provider && ` · Provider: ${deck.provider}`}
              </p>
              {["queued", "working"].includes(deck.status) && (
                <>
                  <progress max={deck.count} value={deck.slides.length} />
                  <p>
                    Your deck keeps generating on the server. You can close this
                    page and reopen it later.
                  </p>
                </>
              )}
              {deck.status === "done" && (
                <a
                  className="btn dark"
                  href={`/api/presentations/${deck.id}/export`}
                >
                  Download editable PPTX
                </a>
              )}
              {deck.status === "error" && (
                <div className="card">
                  <p>{deck.error}</p>
                  <button
                    className="btn dark"
                    disabled={busy}
                    onClick={() => void update({ action: "retry" })}
                  >
                    Resume remaining slides · 5 credits
                  </button>
                </div>
              )}
            </header>
            <div className="deck-slides">
              {deck.slides.map((slide, i) => (
                <section key={i}>
                  <SlidePreview
                    slide={edited && editIndex === i ? edited : slide}
                    template={deck.template}
                    index={i}
                  />
                  {deck.status === "done" && (
                    <button
                      className="btn light"
                      disabled={busy}
                      onClick={() => {
                        setEditIndex(i);
                        setEdited(structuredClone(slide));
                      }}
                    >
                      Edit slide {i + 1}
                    </button>
                  )}
                  {editIndex === i && edited && (
                    <div className="card slide-editor">
                      <label>
                        Title
                        <input
                          value={edited.title}
                          maxLength={110}
                          onChange={(e) =>
                            setEdited({ ...edited, title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Subtitle
                        <input
                          value={edited.subtitle}
                          maxLength={220}
                          onChange={(e) =>
                            setEdited({ ...edited, subtitle: e.target.value })
                          }
                        />
                      </label>
                      {slide.layout === "points" && (
                        <label>
                          Points (one per line)
                          <textarea
                            rows={5}
                            value={edited.bullets.join("\n")}
                            onChange={(e) =>
                              setEdited({
                                ...edited,
                                bullets: e.target.value.split("\n"),
                              })
                            }
                          />
                        </label>
                      )}
                      {slide.layout === "process" && (
                        <label>
                          Steps (one per line)
                          <textarea
                            rows={5}
                            value={edited.steps.join("\n")}
                            onChange={(e) =>
                              setEdited({
                                ...edited,
                                steps: e.target.value.split("\n"),
                              })
                            }
                          />
                        </label>
                      )}
                      {slide.layout === "comparison" &&
                        edited.columns.map((column, c) => (
                          <label key={c}>
                            Column {c + 1}: heading and points
                            <textarea
                              rows={5}
                              value={[column.title, ...column.points].join(
                                "\n",
                              )}
                              onChange={(e) => {
                                const values = e.target.value.split("\n"),
                                  columns = edited.columns.slice();
                                columns[c] = {
                                  title: values[0],
                                  points: values.slice(1),
                                };
                                setEdited({ ...edited, columns });
                              }}
                            />
                          </label>
                        ))}
                      {slide.layout === "table" && (
                        <label>
                          Table (cells separated by |, one row per line)
                          <textarea
                            rows={6}
                            value={edited.table
                              .map((row) => row.join(" | "))
                              .join("\n")}
                            onChange={(e) =>
                              setEdited({
                                ...edited,
                                table: e.target.value
                                  .split("\n")
                                  .map((row) =>
                                    row.split("|").map((v) => v.trim()),
                                  ),
                              })
                            }
                          />
                        </label>
                      )}
                      {slide.layout === "chart" && edited.chart && (
                        <label>
                          Chart values: label | number
                          <textarea
                            rows={6}
                            value={edited.chart.labels
                              .map(
                                (label, j) =>
                                  `${label} | ${edited.chart!.values[j]}`,
                              )
                              .join("\n")}
                            onChange={(e) => {
                              const rows = e.target.value
                                .split("\n")
                                .map((row) => row.split("|"));
                              setEdited({
                                ...edited,
                                chart: {
                                  ...edited.chart!,
                                  labels: rows.map((row) => row[0].trim()),
                                  values: rows.map((row) => Number(row[1])),
                                },
                              });
                            }}
                          />
                        </label>
                      )}
                      <label>
                        Speaker notes
                        <textarea
                          rows={5}
                          value={edited.notes}
                          maxLength={1800}
                          onChange={(e) =>
                            setEdited({ ...edited, notes: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Sources (one per line)
                        <textarea
                          value={edited.citations.join("\n")}
                          onChange={(e) =>
                            setEdited({
                              ...edited,
                              citations: e.target.value.split("\n"),
                            })
                          }
                        />
                      </label>
                      <button
                        className="btn dark"
                        disabled={busy}
                        onClick={() =>
                          void update({
                            slides: deck.slides.map((s, j) =>
                              j === i ? edited : s,
                            ),
                            expectedUpdatedAt: deck.updatedAt,
                          })
                        }
                      >
                        Save slide
                      </button>
                      <button
                        className="btn light"
                        onClick={() => {
                          setEditIndex(-1);
                          setEdited(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </section>
              ))}
            </div>
            <p className="small">
              Previews approximate PPTX layout. Fonts and line wrapping may
              differ in your presentation app. Check factual claims, charts and
              sources before presenting.
            </p>
          </>
        ) : (
          <p role="status">Opening presentation…</p>
        )
      ) : (
        <>
          <form className="card deck-form" onSubmit={create}>
            <h2>Create a presentation</h2>
            <label>
              What should your audience understand?
              <textarea
                required
                minLength={20}
                maxLength={3000}
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Explain the topic, audience, purpose, and points to cover."
              />
            </label>
            <label>
              Reference material (optional)
              <textarea
                rows={4}
                maxLength={18000}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Paste your own source text, data, and citations. Charts use supplied numbers."
              />
            </label>
            <div className="form-grid">
              <label>
                Language
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {[
                    "English",
                    "Hindi",
                    "Hinglish",
                    "German",
                    "French",
                    "Spanish",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Slides
                <input
                  type="number"
                  min={4}
                  max={max}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </label>
            </div>
            <fieldset>
              <legend>Visual template</legend>
              <div className="template-options">
                {Object.entries(DECK_TEMPLATES).map(([key, item]) => (
                  <label
                    key={key}
                    style={{
                      background: `#${item.background}`,
                      color: `#${item.ink}`,
                    }}
                  >
                    <input
                      type="radio"
                      name="deck-template"
                      checked={key === template}
                      onChange={() => setTemplate(key as DeckTemplate)}
                    />
                    <strong>{item.name}</strong>
                    <span style={{ color: `#${item.accent}` }}>
                      Topic → insight → summary
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p>
              5 credits per completed presentation. Failed generation returns
              the charge. Your plan supports up to {max} slides. Editable text,
              native tables/charts, and speaker notes; no watermark.
            </p>
            <button
              className="btn dark"
              disabled={busy || prompt.trim().length < 20}
            >
              {busy ? "Starting…" : "Generate presentation · 5 credits"}
            </button>
          </form>
          <section>
            <h2>Your presentations</h2>
            {decks.length ? (
              <div className="dashboard-story-list">
                {decks.map((d) => (
                  <a
                    className="card"
                    href={`/presentations/${d.id}`}
                    key={d.id}
                  >
                    <h3>{d.title}</h3>
                    <p>
                      {d.status} · {d.slides.length}/{d.count} slides
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <p>Your saved decks will appear here.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
