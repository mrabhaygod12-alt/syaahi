"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { VoiceSession } from "@/lib/interview/voice";

export default function VoiceSessionHistory({ id }: { id?: string }) {
  const [items, setItems] = useState<
    Array<{
      id: string;
      role: string;
      createdAt: string;
      reviewed: boolean;
      turns: number;
    }>
  >([]);
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    requestJson(
      `/api/interview/voice${id ? `/${encodeURIComponent(id)}` : ""}`,
      { signal: controller.signal },
    )
      .then(({ response, data }) => {
        if (!response.ok)
          throw new Error(data.error || "Could not load saved voice practice.");
        if (!controller.signal.aborted) {
          if (id) setSession(data.session);
          else setItems(data.sessions);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, reload]);
  async function act(method: "POST" | "DELETE") {
    if (busy) return;
    if (
      method === "DELETE" &&
      !window.confirm("Delete this saved transcript and coaching report?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestJson(
        `/api/interview/voice/${encodeURIComponent(id!)}`,
        { method },
        method === "POST" ? 110000 : 20000,
      );
      if (!response.ok) throw new Error(data.error || "Request failed.");
      if (method === "DELETE") window.location.assign("/interview/sessions");
      else setSession(data.session);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="wrap feature-section voice-report">
      <style>{`@media print { header,footer,nav,.no-print { display:none!important } .voice-report { max-width:none!important;padding:0!important } .voice-report article { break-inside:avoid } }`}</style>
      <div className="no-print">
        <a href="/interview">← Voice interview practice</a>
        {id && (
          <>
            {" "}
            · <a href="/interview/sessions">Saved sessions</a>
          </>
        )}
      </div>
      <h1>{id ? "Voice practice report" : "Your saved voice practice"}</h1>
      <p>
        Private study feedback. Transcripts can contain recognition errors;
        scores are practice cues, not hiring assessments.
      </p>
      {loading && <p role="status">Loading saved practice…</p>}
      {error && (
        <div className="no-print" role="alert">
          <p>{error}</p>
          <button className="btn light" onClick={() => setReload((n) => n + 1)}>
            Reload
          </button>
        </div>
      )}
      {!id && !loading && !error && (
        <>
          <p>
            Save up to 20 sessions. Delete older sessions when you no longer
            need them.
          </p>
          {items.length ? (
            <div className="steps-grid">
              {items.map((item) => (
                <article className="interactive-panel" key={item.id}>
                  <h2>{item.role}</h2>
                  <p>
                    {new Date(item.createdAt).toLocaleString()} · {item.turns}{" "}
                    transcript turns
                  </p>
                  <p>
                    {item.reviewed
                      ? "Coaching report ready"
                      : "Transcript saved"}
                  </p>
                  <a
                    className="btn dark"
                    href={`/interview/sessions/${item.id}`}
                  >
                    Reopen session
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <p>
              No voice sessions saved yet. After speaking with the coach, stop
              the session and choose Save privately.
            </p>
          )}
        </>
      )}
      {session && (
        <>
          <h2>{session.role}</h2>
          <p>Saved {new Date(session.createdAt).toLocaleString()}</p>
          <div className="hero-actions no-print">
            {!session.report && (
              <button
                className="btn dark"
                disabled={busy}
                onClick={() => void act("POST")}
              >
                {busy ? "Preparing coaching…" : "Create coaching report"}
              </button>
            )}
            <button
              className="btn light"
              disabled={busy}
              onClick={() => window.print()}
            >
              Print / save PDF
            </button>
            <button
              className="btn light"
              disabled={busy}
              onClick={() => void act("DELETE")}
            >
              Delete session
            </button>
          </div>
          {!session.report && (
            <p>
              Requesting coaching sends this saved transcript to Syaahi’s
              configured AI provider. You can print the transcript without
              generating coaching.
            </p>
          )}
          {session.report && (
            <section>
              <h2>Practice feedback</h2>
              <p>{session.report.summary}</p>
              <div className="steps-grid">
                {session.report.rubric.map((row) => (
                  <article className="interactive-panel" key={row.criterion}>
                    <h3>
                      {row.criterion} ·{" "}
                      {row.score === null
                        ? "Insufficient evidence"
                        : `${row.score}/4`}
                    </h3>
                    <p>{row.reason}</p>
                  </article>
                ))}
              </div>
              {(
                [
                  ["Strengths", session.report.strengths],
                  ["Next practice steps", session.report.nextSteps],
                  ["Follow-up questions", session.report.followUps],
                ] as const
              ).map(([title, list]) => (
                <section key={title}>
                  <h3>{title}</h3>
                  <ul>
                    {list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>
          )}
          <section>
            <h2>Saved transcript</h2>
            {session.turns.map((turn, index) => (
              <article key={index}>
                <h3>{turn.speaker === "learner" ? "You" : "Coach"}</h3>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {turn.text}
                </p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
