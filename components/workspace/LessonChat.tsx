"use client";
import LectureRecorder from "@/components/LectureRecorder";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobPage, LessonJob } from "./types";
import { lessonTitle } from "./types";
import { useLesson } from "./LessonProvider";
import { touchStudyDay } from "@/lib/study/streak";
import { useToast } from "@/components/Toasts";

// Tiny markdown renderer for answers: headings, bullets, numbered,
// **bold**, `code`, tables. Raw asterisks never leak to the student.
function Md({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];
  let table: string[][] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`b${out.length}`} className="ws-md-ul">
          {bullets.map((b, k) => (
            <li key={k}>
              <Inline t={b} />
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
    if (numbered.length) {
      out.push(
        <ol key={`n${out.length}`} className="ws-md-ul">
          {numbered.map((b, k) => (
            <li key={k}>
              <Inline t={b} />
            </li>
          ))}
        </ol>,
      );
      numbered = [];
    }
    if (table.length) {
      const [head, ...rows] = table;
      out.push(
        <table key={`t${out.length}`} className="ws-md-table">
          <thead>
            <tr>
              {head.map((c, k) => (
                <th key={k}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      table = [];
    }
  };
  lines.forEach((raw) => {
    const line = raw.trim();
    if (/^\|.*\|$/.test(line) && line.includes("|")) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c, idx, arr) => !(idx === 0 || idx === arr.length - 1) || c);
      if (cells.every((c) => /^:?-+:?$/.test(c))) return; // separator
      table.push(cells);
      return;
    }
    flush();
    if (!line) return;
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      out.push(
        <div key={out.length} className="ws-md-h">
          <Inline t={h[2]} />
        </div>,
      );
      return;
    }
    const b = line.match(/^[-*•]\s+(.*)/);
    if (b) {
      bullets.push(b[1]);
      return;
    }
    const n = line.match(/^\d+[.)]\s+(.*)/);
    if (n) {
      numbered.push(n[1]);
      return;
    }
    out.push(
      <p key={out.length} className="ws-md-p">
        <Inline t={line} />
      </p>,
    );
  });
  flush();
  return <>{out}</>;
}

function Inline({ t }: { t: string }) {
  const parts = t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, k) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <b key={k}>{p.slice(2, -2)}</b>;
        if (p.startsWith("`") && p.endsWith("`"))
          return (
            <code key={k} className="ws-md-code">
              {p.slice(1, -1)}
            </code>
          );
        return <span key={k}>{p}</span>;
      })}
    </>
  );
}

interface Msg {
  q: string;
  a: string;
  via?: string;
  model?: string;
  ms?: number;
  cites?: Array<{ page: number; topic: string }>;
}

const chatKey = (id: string) => `syaahi-chat:${id}`;
const useKey = (id: string) => `syaahi-chat-use:${id}`;
const outboxKey = (id: string) => `syaahi-chat-outbox:${id}`;

export default function LessonChat({
  job,
  variant = "panel",
  onClose,
  currentWidth,
  onSetWidth,
}: {
  job: LessonJob;
  variant?: "panel" | "overlay";
  onClose?: () => void;
  currentWidth?: number;
  onSetWidth?: (width: number) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { chatPrefill, refresh } = useLesson();
  const pages: JobPage[] = job.pages;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<Msg[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(chatKey(job.id)) ?? "[]").slice(
        -20,
      );
    } catch {
      return [];
    }
  });
  const [copied, setCopied] = useState<number | null>(null);
  const [voted, setVoted] = useState<Record<number, string>>({});
  const [tokens, setTokens] = useState<number>(
    () => Number(localStorage.getItem(useKey(job.id)) ?? 0) || 0,
  );
  const [exported, setExported] = useState(false);
  const voiceAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      voiceAudio.current?.pause();
    },
    [],
  );
  const abortRef = useRef<AbortController | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const base = `/lesson/${job.id}`;
  const topics = job.topics.slice(0, 3);

  // Persist thread + token meter across drawer closes and refreshes.
  useEffect(() => {
    try {
      localStorage.setItem(chatKey(job.id), JSON.stringify(thread.slice(-20)));
    } catch {
      /* full */
    }
  }, [thread, job.id]);
  useEffect(() => {
    try {
      localStorage.setItem(useKey(job.id), String(tokens));
    } catch {
      /* noop */
    }
  }, [tokens, job.id]);

  // Newest at the bottom, ChatGPT-style — always follow the conversation.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, busy]);

  // Autogrow the composer.
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [q]);

  // Prefill APPENDS (never overwrites a typed draft).
  const prefillNonce = useRef(0);
  useEffect(() => {
    if (chatPrefill && chatPrefill.nonce !== prefillNonce.current) {
      prefillNonce.current = chatPrefill.nonce;
      setQ((prev) =>
        prev.trim()
          ? `${prev.trim()}\n> ${chatPrefill.text}`
          : chatPrefill.text,
      );
      inputRef.current?.focus();
    }
  }, [chatPrefill]);

  // Offline outbox: queued questions auto-send when back online.
  useEffect(() => {
    const flush = () => {
      let box: string[] = [];
      try {
        box = JSON.parse(localStorage.getItem(outboxKey(job.id)) ?? "[]");
      } catch {
        /* noop */
      }
      if (!box.length || busy) return;
      try {
        localStorage.setItem(outboxKey(job.id), "[]");
      } catch {
        /* noop */
      }
      box.forEach((qq, k) => setTimeout(() => askRef.current(qq), k * 500));
    };
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, busy]);

  function bumpTokens(n: number) {
    if (n > 0) setTokens((t) => t + n);
  }

  async function askStream(
    qq: string,
    hist: Msg[],
    signal: AbortSignal,
  ): Promise<boolean> {
    const r = await fetch("/api/ask-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pages: pages.map((p) => ({ topic: p.topic, markdown: p.markdown })),
        question: `Lesson: ${lessonTitle(job)}. ${qq}`,
        language: job.language ?? "english",
        history: hist.slice(-4).map((h) => ({ q: h.q, a: h.a.slice(0, 600) })),
      }),
      signal,
    });
    if (!r.ok || !r.body) return false;
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let gotToken = false;
    let meta: any = {};
    const idx = thread.length;
    setThread((t) => [...t, { q: qq, a: "" }]);
    const pump = async (): Promise<boolean> => {
      const { done, value } = await reader.read();
      if (done) return gotToken;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          if (j.error && !gotToken) return false;
          if (j.t) {
            gotToken = true;
            const tok: string = j.t;
            setThread((t) =>
              t.map((m, k) => (k === idx ? { ...m, a: m.a + tok } : m)),
            );
          }
          if (j.usage || j.model || j.provider) meta = { ...meta, ...j };
        } catch {
          /* partial chunk */
        }
      }
      return pump();
    };
    try {
      const ok = await pump();
      if (ok) {
        if (meta.usage)
          bumpTokens(Number(meta.usage.total ?? meta.usage.cost ?? 0));
        // Fetch cites + exact meta via the sync endpoint? No — re-derive cites locally is wrong.
        // Instead do one cheap non-stream call ONLY for cites when streaming gave none.
        setThread((t) =>
          t.map((m, k) =>
            k === idx && !m.via
              ? { ...m, via: meta.provider, model: meta.model }
              : m,
          ),
        );
      } else {
        setThread((t) => t.filter((_, k) => k !== idx));
      }
      return ok;
    } catch (e: any) {
      if (!gotToken) setThread((t) => t.filter((_, k) => k !== idx));
      if (signal.aborted)
        setThread((t) =>
          t.map((m, k) => (k === idx ? { ...m, a: m.a || "(stopped)" } : m)),
        );
      return gotToken;
    }
  }

  async function askSync(qq: string, hist: Msg[]): Promise<boolean> {
    const r = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pages: pages.map((p) => ({ topic: p.topic, markdown: p.markdown })),
        question: `Lesson: ${lessonTitle(job)}. ${qq}`,
        language: job.language ?? "english",
        history: hist.slice(-4).map((h) => ({ q: h.q, a: h.a.slice(0, 600) })),
      }),
      signal: abortRef.current?.signal,
    });
    const j = await r.json();
    if (j.error && !j.answer) {
      setThread((t) => [...t, { q: qq, a: j.error }]);
      return true;
    }
    bumpTokens(Number(j.usage?.total ?? j.usage?.cost ?? 0));
    setThread((t) => [
      ...t,
      {
        q: qq,
        a: j.answer ?? "No answer.",
        via: j.provider,
        model: j.model,
        cites: j.cites,
      },
    ]);
    return true;
  }

  async function ask(question?: string) {
    const qq = (question ?? q).trim().slice(0, 500);
    if (!qq || busy) return;
    touchStudyDay();
    // Offline → queue, auto-send on reconnect.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const box = JSON.parse(localStorage.getItem(outboxKey(job.id)) ?? "[]");
        localStorage.setItem(
          outboxKey(job.id),
          JSON.stringify([...box, qq].slice(-10)),
        );
      } catch {
        /* noop */
      }
      setQ("");
      setThread((t) => [
        ...t,
        { q: qq, a: "📴 Offline — queued, will send when you reconnect." },
      ]);
      return;
    }
    setQ("");
    setBusy(true);
    abortRef.current = new AbortController();
    const hist = thread;
    try {
      const streamed = await askStream(qq, hist, abortRef.current.signal);
      if (!streamed && !abortRef.current.signal.aborted)
        await askSync(qq, hist);
    } catch {
      if (!abortRef.current?.signal.aborted)
        await askSync(qq, hist).catch(() => {
          setThread((t) => [
            ...t,
            { q: qq, a: "Network error — check connection and retry." },
          ]);
        });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }
  const askRef = useRef(ask);
  askRef.current = ask;

  async function regenerate(i: number) {
    const msg = thread[i];
    if (!msg || busy) return;
    setBusy(true);
    const hist = thread.slice(0, i);
    try {
      // Rotation gives a different model a shot at the same question.
      await askSync(`Answer again, differently: ${msg.q}`, hist);
      setThread((t) => {
        const next = [...t];
        const regen = next.pop();
        if (regen) next[i] = { ...regen, q: msg.q };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function vote(i: number, verdict: "up" | "down") {
    const msg = thread[i];
    if (!msg) return;
    setVoted((v) => ({ ...v, [i]: verdict }));
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        q: msg.q,
        a: msg.a.slice(0, 2000),
        verdict,
        provider: msg.via,
      }),
    }).catch(() => {});
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard blocked */
    }
  }

  async function exportThread() {
    if (!thread.length) return;
    const md =
      `## Chat Q&A — ${lessonTitle(job)}\n` +
      thread.map((m, k) => `### Q${k + 1}: ${m.q}\n${m.a}`).join("\n\n");
    const r = await fetch(`/api/jobs/${job.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "append-page",
        topic: "Chat Q&A",
        markdown: md,
      }),
    });
    const j = await r.json();
    if (j.ok) {
      setExported(true);
      refresh();
      setTimeout(() => setExported(false), 2500);
    }
  }

  async function speak(text: string) {
    setVoiceBusy(true);
    try {
      voiceAudio.current?.pause();
      const r = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson: job.id,
          action: "chat",
          text: text.slice(0, 1500),
          voice: "Kore",
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob());
      const player = new Audio(url);
      voiceAudio.current = player;
      player.onended = () => URL.revokeObjectURL(url);
      await player.play();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gemini voice unavailable.", true);
    } finally {
      setVoiceBusy(false);
    }
  }
  async function transcribe(file: File) {
    setVoiceBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const r = await fetch("/api/transcribe", { method: "POST", body: data });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setQ((prev) => (prev + " " + d.transcript).trim().slice(0, 500));
      inputRef.current?.focus();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Gemini transcription unavailable.",
        true,
      );
    } finally {
      setVoiceBusy(false);
    }
  }

  const last = thread[thread.length - 1];

  return (
    <aside
      className={`ws-chat ${variant === "overlay" ? "ws-chat-overlay" : ""}`}
    >
      <div className="ws-chat-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ws-chat-dot" />
          <b>Chat</b>
          <span className="small">grounded in this lesson</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onSetWidth && (
            <div className="ws-chat-size-presets" title="Adjust chat width">
              <button
                type="button"
                className={`ws-size-pill ${currentWidth && currentWidth <= 400 ? "active" : ""}`}
                onClick={() => onSetWidth(380)}
                title="Compact (380px)"
              >
                S
              </button>
              <button
                type="button"
                className={`ws-size-pill ${currentWidth && currentWidth > 400 && currentWidth <= 540 ? "active" : ""}`}
                onClick={() => onSetWidth(480)}
                title="Standard (480px)"
              >
                M
              </button>
              <button
                type="button"
                className={`ws-size-pill ${currentWidth && currentWidth > 540 ? "active" : ""}`}
                onClick={() => onSetWidth(640)}
                title="Wide (640px)"
              >
                L
              </button>
            </div>
          )}
          {onClose && (
            <button
              className="ws-icon-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="ws-chat-shortcuts">
        <button
          className="ws-shortcut popular"
          onClick={() => router.push(`${base}/quiz`)}
        >
          <span>Quizzes</span>
          <small>Test your knowledge</small>
          <em>Popular</em>
        </button>
        <div className="ws-shortcut-row">
          <button
            className="ws-shortcut"
            onClick={() => router.push(`${base}/podcast`)}
          >
            <span>Podcast</span>
            <small>Listen and learn on the go</small>
          </button>
          <button
            className="ws-shortcut"
            onClick={() => router.push(`${base}/flashcards`)}
          >
            <span>Flashcards</span>
            <small>Study with active recall</small>
          </button>
        </div>
      </div>
      <div className="ws-chat-thread" ref={threadRef}>
        {!thread.length && (
          <div className="ws-chat-empty">
            <h2>Hey, I&apos;m Syaahi</h2>
            <p>I can work with you on this lesson and answer any questions.</p>
            <div className="ws-chips">
              {topics.map((t) => (
                <button
                  key={t}
                  className="ws-chip"
                  onClick={() => ask(`Explain "${t}" simply`)}
                >
                  Explain “{t.slice(0, 28)}”
                </button>
              ))}
              <button
                className="ws-chip"
                onClick={() => ask("Quiz me on this lesson")}
              >
                Quiz me
              </button>
            </div>
            <p className="small" style={{ marginTop: 10 }}>
              Tip: select any text in your notes → “Ask ✦”.
            </p>
          </div>
        )}
        {thread.map((h, i) => (
          <div key={i} className="ws-msg">
            <div className="ws-msg-q">{h.q}</div>
            <div className="ws-msg-a">
              {h.a ? <Md text={h.a} /> : <span className="small">…</span>}
              {h.cites && h.cites.length > 0 && (
                <div className="ws-cites">
                  {h.cites.map((c) => (
                    <button
                      key={c.page}
                      className="ws-cite"
                      onClick={() =>
                        router.push(`${base}/notes#page-${c.page}`)
                      }
                    >
                      📄 p.{c.page + 1} · {c.topic.slice(0, 30)}
                    </button>
                  ))}
                </div>
              )}
              {h.a && !h.a.startsWith("📴") && (
                <div className="ws-msg-tools">
                  <button
                    className="ws-tiny"
                    onClick={() => copy(`${h.q}\n\n${h.a}`, i)}
                  >
                    {copied === i ? "Copied ✓" : "Copy"}
                  </button>
                  <button className="ws-tiny" onClick={() => speak(h.a)}>
                    Listen
                  </button>
                  <button
                    className="ws-tiny"
                    disabled={busy}
                    onClick={() => regenerate(i)}
                    title="Explain again"
                  >
                    ↻
                  </button>
                  <button
                    className={`ws-tiny ${voted[i] === "up" ? "on" : ""}`}
                    onClick={() => vote(i, "up")}
                    title="Helpful"
                  >
                    👍
                  </button>
                  <button
                    className={`ws-tiny ${voted[i] === "down" ? "on" : ""}`}
                    onClick={() => vote(i, "down")}
                    title="Not helpful"
                  >
                    👎
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
              padding: 8,
            }}
          >
            <div className="ws-typing">
              <span />
              <span />
              <span />
            </div>
            <button
              className="ws-tiny"
              onClick={() => abortRef.current?.abort()}
            >
              ■ Stop
            </button>
          </div>
        )}
        {!busy && last && last.a && !last.a.startsWith("📴") && (
          <div className="ws-followups">
            <button
              className="ws-chip"
              onClick={() => ask(`Give an example for: ${last.q}`)}
            >
              Iska example?
            </button>
            <button
              className="ws-chip"
              onClick={() => router.push(`${base}/quiz`)}
            >
              Quiz me on this
            </button>
            <button className="ws-chip" onClick={exportThread}>
              {exported ? "Added ✓" : "＋ Add to notes"}
            </button>
          </div>
        )}
      </div>
      <div className="ws-prompt-wrap">
        <form
          className="ws-prompt-card"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <textarea
            ref={inputRef}
            className="ws-prompt-textarea"
            autoFocus
            value={q}
            rows={2}
            onChange={(e) => setQ(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="Ask anything about this lesson or paste questions…"
            maxLength={500}
          />
          <div className="ws-prompt-footer">
            <div className="ws-prompt-tools">
              <LectureRecorder
                onFile={(file) => void transcribe(file)}
                disabled={busy || voiceBusy}
              />
              {voiceBusy && (
                <span role="status" className="small ws-voice-pill">
                  <span className="pulsing-mic" /> Listening…
                </span>
              )}
            </div>
            <div className="ws-prompt-actions">
              <span className="ws-prompt-counter">{q.length}/500</span>
              <button
                type="submit"
                className="ws-prompt-send-btn"
                disabled={busy || !q.trim()}
                aria-label="Send message"
                title="Send (Enter)"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
      {tokens > 0 && (
        <div
          className="small"
          style={{ textAlign: "center", padding: "4px 0 8px" }}
        >
          This chat used ~{(tokens / 1000).toFixed(1)}k tokens
        </div>
      )}
    </aside>
  );
}
