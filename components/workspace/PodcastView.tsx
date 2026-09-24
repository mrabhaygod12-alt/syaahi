"use client";
import { useEffect, useRef, useState } from "react";
import { useLesson } from "./LessonProvider";
import { lessonTitle } from "./types";
export default function PodcastView() {
  const { job, refresh } = useLesson();
  const [script, setScript] = useState(job?.podcastScript || ""),
    [depth, setDepth] = useState("quick"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [voice, setVoice] = useState("Kore"),
    [delivery, setDelivery] = useState("clear"),
    [audio, setAudio] = useState(""),
    [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (job?.podcastScript) setScript(job.podcastScript);
  }, [job?.podcastScript]);
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio);
    },
    [audio],
  );
  async function generate() {
    setBusy("Writing your audio lesson...");
    setError("");
    try {
      const r = await fetch("/api/lesson-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "podcast", lesson: job?.id, depth }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setScript(d.script);
      setAudio("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Script unavailable.");
    } finally {
      setBusy("");
    }
  }
  async function makeAudio() {
    setBusy("Creating downloadable audio...");
    setError("");
    try {
      const r = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson: job?.id, voice, delivery }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setAudio(URL.createObjectURL(await r.blob()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audio unavailable.");
    } finally {
      setBusy("");
    }
  }
  if (!job) return null;
  return (
    <div className="quiz-room">
      <span className="eyebrow">GEMINI AUDIO STUDIO</span>
      <h1>{lessonTitle(job)}</h1>
      <p className="small">
        Create a spoken lesson grounded in your notes. Review the script, listen
        with a Gemini voice, and download a WAV file for offline listening.
      </p>
      <div className="quiz-settings">
        <label>
          Gemini voice
          <select
            value={voice}
            onChange={(e) => {
              setVoice(e.target.value);
              setAudio("");
            }}
          >
            {["Kore", "Puck", "Charon", "Aoede", "Fenrir"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Delivery
          <select
            value={delivery}
            onChange={(e) => {
              setDelivery(e.target.value);
              setAudio("");
            }}
          >
            <option value="clear">Clear & calm</option>
            <option value="lively">Lively explanation</option>
            <option value="slow">Slow & patient</option>
          </select>
        </label>
        <label>
          Lesson depth
          <select value={depth} onChange={(e) => setDepth(e.target.value)}>
            <option value="quick">Quick recap</option>
            <option value="deep">Deeper explanation</option>
          </select>
        </label>
        <label>
          Playback speed
          <select
            value={rate}
            onChange={(e) => {
              setRate(Number(e.target.value));
              if (audioRef.current)
                audioRef.current.playbackRate = Number(e.target.value);
            }}
          >
            {[0.75, 1, 1.25, 1.5].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="btn dark"
        disabled={!!busy || !job.pages.length}
        onClick={generate}
      >
        {script ? "Regenerate spoken lesson" : "Create spoken lesson"}
      </button>
      {busy && <p role="status">{busy}</p>}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {script && (
        <>
          <div className="hero-actions">
            <button className="btn light" disabled={!!busy} onClick={makeAudio}>
              Generate Gemini audio
            </button>
          </div>
          {audio && (
            <div className="card">
              <audio
                ref={audioRef}
                controls
                onLoadedMetadata={() => {
                  if (audioRef.current) audioRef.current.playbackRate = rate;
                }}
                src={audio}
                style={{ width: "100%" }}
              />
              <a href={audio} download="syaahi-study-audio.wav">
                Download WAV ↓
              </a>
            </div>
          )}
          <details open>
            <summary>Read the saved script</summary>
            <div
              className="card"
              style={{ whiteSpace: "pre-wrap", marginTop: 14 }}
            >
              {script}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
