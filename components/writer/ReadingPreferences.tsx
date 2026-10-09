"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { ReadingPreferences as Preferences } from "@/lib/writing/recommendation-types";
import { suggestedInterests } from "@/lib/writing/recommendation-types";
import { useWriter } from "./WriterShell";
export default function ReadingPreferences() {
  const { profile } = useWriter();
  const [saved, setSaved] = useState<Preferences | null>(null),
    [topics, setTopics] = useState(""),
    [muted, setMuted] = useState(""),
    [history, setHistory] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setSaved(null);
    setError("");
    requestJson("/api/writer/preferences", { signal: controller.signal })
      .then((r) => {
        if (controller.signal.aborted) return;
        if (!r.response.ok) throw new Error(r.data.error);
        setSaved(r.data.preferences);
        setTopics(r.data.preferences.topics.join(", "));
        setMuted(r.data.preferences.mutedTopics.join(", "));
        setHistory(r.data.preferences.useReadingHistory);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [profile.owner]);
  const values = (s: string) => [
    ...new Set(
      s
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  return (
    <section className="writer-preferences" id="reading-preferences">
      <p className="writer-kicker">CURATE YOUR READING</p>
      <h2>Make room for your interests.</h2>
      <p>
        Your feed blends chosen topics, writers you follow and fresh
        perspectives. Your preferences stay private.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!saved && !error && <p role="status">Loading reading preferences…</p>}
      {saved && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const r = await requestJson("/api/writer/preferences", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  topics: values(topics),
                  mutedTopics: values(muted),
                  mutedCreators: saved.mutedCreators,
                  useReadingHistory: history,
                  expectedUpdatedAt: saved.updatedAt,
                }),
              });
              if (!r.response.ok) throw new Error(r.data.error);
              setSaved(r.data.preferences);
              setTopics(r.data.preferences.topics.join(", "));
              setMuted(r.data.preferences.mutedTopics.join(", "));
              setMessage(
                "Reading preferences saved. Your next For you feed will use these choices.",
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not save preferences.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
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
