"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { ReadingPreferences as Preferences } from "@/lib/writing/recommendation-types";
import { suggestedInterests } from "@/lib/writing/recommendation-types";
import { useWriter } from "./WriterShell";

export default function ReadingPreferences() {
  const { profile } = useWriter();
  const owner = useRef(profile.owner);
  owner.current = profile.owner;
  const pending = useRef<AbortController | null>(null),
    query = useRef<AbortController | null>(null);
  const [saved, setSaved] = useState<Preferences | null>(null),
    [topics, setTopics] = useState(""),
    [muted, setMuted] = useState(""),
    [creators, setCreators] = useState<string[]>([]),
    [writerURL, setWriterURL] = useState(""),
    [history, setHistory] = useState(false),
    [busy, setBusy] = useState(false),
    [fetching, setFetching] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const activeSaved = saved?.owner === profile.owner ? saved : null;
  const apply = (p: Preferences) => {
    setSaved(p);
    setTopics(p.topics.join(", "));
    setMuted(p.mutedTopics.join(", "));
    setCreators(p.mutedCreators);
    setHistory(p.useReadingHistory);
    setWriterURL("");
  };
  const load = useCallback(async () => {
    if (pending.current) return;
    query.current?.abort();
    const controller = new AbortController();
    query.current = controller;
    setFetching(true);
    setError("");
    setMessage("");
    try {
      const r = await requestJson("/api/writer/preferences", {
        signal: controller.signal,
      });
      if (controller.signal.aborted || owner.current !== profile.owner) return;
      if (!r.response.ok) throw new Error(r.data.error);
      apply(r.data.preferences);
    } catch (e) {
      if (!controller.signal.aborted && owner.current === profile.owner)
        setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted && owner.current === profile.owner)
        setFetching(false);
    }
  }, [profile.owner]);
  useEffect(() => {
    setSaved(null);
    setBusy(false);
    setMessage("");
    void load();
    return () => {
      query.current?.abort();
      pending.current?.abort();
      pending.current = null;
    };
  }, [load]);
  const values = (s: string) => [
    ...new Set(
      s
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const validResponse = (controller: AbortController) =>
    !controller.signal.aborted && owner.current === profile.owner;
  async function addWriter() {
    if (pending.current || fetching || !activeSaved) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let slug = writerURL.trim().toLowerCase().replace(/^@/, "");
      if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
        const url = new URL(writerURL.trim(), location.origin);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          !["syaahii.in", "www.syaahii.in", location.host].includes(url.host) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          throw new Error("Use a Syaahi writer profile URL or handle.");
        const match = url.pathname.match(/^\/creators\/([a-z0-9-]{1,120})\/?$/);
        if (!match)
          throw new Error("Use a Syaahi writer profile URL or handle.");
        slug = match[1];
      }
      if (creators.includes(slug))
        throw new Error("This writer is already in your muted list.");
      if (creators.length >= 30)
        throw new Error(
          "Keep up to 30 muted writers. Unmute one before adding another.",
        );
      const r = await requestJson(`/api/creators/${encodeURIComponent(slug)}`, {
        signal: controller.signal,
      });
      if (!validResponse(controller)) return;
      if (!r.response.ok)
        throw new Error("This public writer profile is unavailable.");
      setCreators([...creators, slug]);
      setWriterURL("");
      setMessage(
        "Writer added to your list. Save reading preferences to apply it.",
      );
    } catch (e) {
      if (validResponse(controller)) setError((e as Error).message);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current || fetching || !activeSaved) return;
    query.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await requestJson("/api/writer/preferences", {
        method: "PATCH",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: values(topics),
          mutedTopics: values(muted),
          mutedCreators: creators,
          useReadingHistory: history,
          expectedUpdatedAt: activeSaved.updatedAt,
        }),
      });
      if (!validResponse(controller)) return;
      if (!r.response.ok) throw new Error(r.data.error);
      apply(r.data.preferences);
      setMessage(
        "Reading preferences saved. Your next For you feed will use these choices.",
      );
    } catch (e) {
      if (validResponse(controller))
        setError(
          e instanceof Error ? e.message : "Could not save preferences.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section className="writer-preferences" id="reading-preferences">
      <p className="writer-kicker">CURATE YOUR READING</p>
      <h2>Make room for your interests.</h2>
      <p>
        Your feed blends chosen topics, writers you follow and fresh
        perspectives. Your preferences stay private.
      </p>
      {error && (
        <div>
          <p role="alert">{error}</p>
          <button
            className="btn light"
            disabled={busy || fetching}
            onClick={() => void load()}
          >
            Reload saved preferences
          </button>
          {activeSaved && (
            <small>Reload replaces the unsaved choices in this form.</small>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {fetching && <p role="status">Loading reading preferences…</p>}
      {activeSaved && (
        <form onSubmit={(e) => void save(e)}>
          <fieldset disabled={busy || fetching}>
            <label>
              Topics you enjoy
              <input
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                maxLength={350}
                placeholder="databases, computer science, research"
              />
              <small>Up to ten topics, separated by commas.</small>
            </label>
            <div className="writer-interest-options">
              {suggestedInterests.map((t) => (
                <button
                  type="button"
                  key={t}
                  aria-pressed={values(topics).includes(t)}
                  onClick={() =>
                    setTopics(
                      values(topics).includes(t)
                        ? values(topics)
                            .filter((v) => v !== t)
                            .join(", ")
                        : [...values(topics), t].slice(0, 10).join(", "),
                    )
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <label>
              Topics to show less
              <input
                value={muted}
                onChange={(e) => setMuted(e.target.value)}
                maxLength={350}
                placeholder="Topics you'd prefer to skip"
              />
              <small>
                Reviewed stories carrying these exact topic tags are excluded
                from your feed.
              </small>
            </label>
            <div className="writer-muted-authors">
              <h3>Writers to show less</h3>
              <p>
                Muted writers stay out of your signed-in feed. Their public
                pages remain available, and your following choices stay the
                same.
              </p>
              <label>
                Writer profile URL or handle
                <input
                  value={writerURL}
                  onChange={(e) => setWriterURL(e.target.value)}
                  maxLength={220}
                  placeholder="https://www.syaahii.in/creators/writer-handle"
                />
              </label>
              <button
                className="btn light"
                type="button"
                disabled={!writerURL.trim()}
                onClick={() => void addWriter()}
              >
                Add writer
              </button>
              <small>
                Up to 30 public writers. Changes apply when you save.
              </small>
              {creators.length ? (
                <ul>
                  {creators.map((slug) => (
                    <li key={slug}>
                      <a href={`/creators/${encodeURIComponent(slug)}`}>
                        {slug}
                      </a>
                      <button
                        className="writer-text-button"
                        type="button"
                        aria-label={`Unmute ${slug}`}
                        onClick={() => {
                          setCreators(creators.filter((s) => s !== slug));
                          setMessage(
                            "Writer removed from your list. Save reading preferences to apply it.",
                          );
                        }}
                      >
                        Unmute
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small">No muted writers.</p>
              )}
            </div>
            <label className="writer-history-choice">
              <input
                type="checkbox"
                checked={history}
                onChange={(e) => setHistory(e.target.checked)}
              />
              <span>
                Use my saved reading history to refine recommendations.
                <small>
                  Off by default. Turning this off stops using history for
                  recommendations; your saved position and highlights remain in
                  your private library.
                </small>
              </span>
            </label>
            <button className="btn dark">
              {busy ? "Saving…" : "Save reading preferences"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
