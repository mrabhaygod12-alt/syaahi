"use client";
import { useEffect, useRef, useState } from "react";

const LIVE_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
const b64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
function pcm16(samples: Float32Array) {
  const output = new Uint8Array(samples.length * 2),
    view = new DataView(output.buffer);
  samples.forEach((sample, index) =>
    view.setInt16(index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true),
  );
  return output;
}
function decode(base64: string) {
  const raw = atob(base64),
    bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export default function VoiceInterview() {
  const [connecting, setConnecting] = useState(false),
    [running, setRunning] = useState(false);
  const generation = useRef(0),
    locked = useRef(false),
    ready = useRef(false);
  const nextPlayback = useRef(0),
    playback = useRef(new Set<AudioBufferSourceNode>());
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [role, setRole] = useState("Software engineering intern"),
    [status, setStatus] = useState(""),
    [transcript, setTranscript] = useState<string[]>([]);
  const socket = useRef<WebSocket | null>(null),
    context = useRef<AudioContext | null>(null),
    stream = useRef<MediaStream | null>(null),
    processor = useRef<ScriptProcessorNode | null>(null),
    active = useRef(false);
  const stop = () => {
    generation.current++;
    locked.current = false;
    ready.current = false;
    setConnecting(false);
    setRunning(false);
    if (timeout.current) clearTimeout(timeout.current);
    for (const source of playback.current) {
      try {
        source.stop();
      } catch {}
    }
    playback.current.clear();
    nextPlayback.current = 0;
    active.current = false;
    processor.current?.disconnect();
    processor.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (socket.current) {
      socket.current.onopen = null;
      socket.current.onclose = null;
      socket.current.onerror = null;
      socket.current.onmessage = null;
      socket.current.close();
    }
    socket.current = null;
    void context.current?.close().catch(() => {});
    context.current = null;
    setStatus("");
  };
  useEffect(() => () => stop(), []);
  async function play(base64: string) {
    const samples = decode(base64),
      audio = context.current;
    if (!audio) return;
    const buffer = audio.createBuffer(1, samples.length, 24000),
      channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    const when = Math.max(audio.currentTime + 0.02, nextPlayback.current);
    playback.current.add(source);
    source.onended = () => {
      playback.current.delete(source);
      source.disconnect();
    };
    source.start(when);
    nextPlayback.current = when + buffer.duration;
  }
  async function start() {
    if (locked.current) return;
    locked.current = true;
    setConnecting(true);
    const run = ++generation.current;
    try {
      setStatus("Allow microphone access to begin…");
      setTranscript([]);
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      if (generation.current !== run) {
        mic.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = mic;
      setStatus("Requesting secure voice session…");
      const tokenResponse = await fetch("/api/interview/live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        signal: AbortSignal.timeout(15000),
      });
      const tokenData = await tokenResponse.json();
      if (generation.current !== run) return;
      if (!tokenResponse.ok)
        throw new Error(tokenData.error || "Voice interviews are unavailable.");
      context.current = new AudioContext();
      await context.current.resume();
      if (generation.current !== run) return;
      const ws = new WebSocket(
        `${LIVE_ENDPOINT}?access_token=${encodeURIComponent(tokenData.token)}`,
      );
      socket.current = ws;
      ws.binaryType = "arraybuffer";
      timeout.current = setTimeout(() => {
        stop();
        setStatus("Connection timed out. Your microphone is off.");
      }, 15000);
      ws.onopen = () => {
        active.current = true;
        setStatus("Connecting to the interview coach…");
        ws.send(JSON.stringify({ setup: { model: tokenData.model } }));
        const source = context.current!.createMediaStreamSource(
          stream.current!,
        );
        const node = context.current!.createScriptProcessor(4096, 1, 1);
        processor.current = node;
        node.onaudioprocess = (event) => {
          if (ws.bufferedAmount > 256000) {
            stop();
            setStatus("Connection too slow for live audio. Please retry.");
            return;
          }
          if (
            ws.readyState === WebSocket.OPEN &&
            active.current &&
            ready.current
          )
            ws.send(
              JSON.stringify({
                realtimeInput: {
                  audio: {
                    mimeType: `audio/pcm;rate=${context.current!.sampleRate}`,
                    data: b64(pcm16(event.inputBuffer.getChannelData(0))),
                  },
                },
              }),
            );
        };
        source.connect(node);
        node.connect(context.current!.destination);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(
              typeof event.data === "string"
                ? event.data
                : new TextDecoder().decode(event.data),
            ),
            content = data.serverContent;
          if (data.error) {
            stop();
            setStatus("Voice provider rejected this session. Please retry.");
            return;
          }
          if (data.setupComplete) {
            ready.current = true;
            setRunning(true);
            setConnecting(false);
            if (timeout.current) clearTimeout(timeout.current);
            timeout.current = setTimeout(() => {
              stop();
              setStatus(
                "Your 15-minute session ended. Your microphone is off.",
              );
            }, 15 * 60000);
            setStatus("Connected. Speak naturally; use Stop when finished.");
            ws.send(
              JSON.stringify({
                realtimeInput: {
                  text: "Please introduce yourself and ask the first practice question.",
                },
              }),
            );
          }
          if (content?.interrupted) {
            for (const source of playback.current) {
              try {
                source.stop();
              } catch {}
            }
            playback.current.clear();
            nextPlayback.current = 0;
          }
          const input = content?.inputTranscription?.text,
            output = content?.outputTranscription?.text;
          if (input)
            setTranscript((items) => [...items.slice(-8), `You: ${input}`]);
          if (output)
            setTranscript((items) => [...items.slice(-8), `Coach: ${output}`]);
          for (const part of content?.modelTurn?.parts || [])
            if (part.inlineData?.data) void play(part.inlineData.data);
          if (content?.turnComplete)
            setStatus("Your turn. Continue speaking or stop this practice.");
        } catch {
          /* Ignore non-content protocol frames. */
        }
      };
      ws.onerror = () => {
        stop();
        setStatus("Voice connection failed. Your microphone is off.");
      };
      ws.onclose = () => {
        stop();
        setStatus("Voice session ended. Your microphone is off.");
      };
    } catch (error) {
      if (generation.current === run) {
        stop();
        setStatus(
          error instanceof Error
            ? error.message
            : "Voice interview could not start.",
        );
      }
    }
  }
  return (
    <section className="wrap feature-section voice-interview">
      <p className="eyebrow">VOICE MOCK INTERVIEW · BETA</p>
      <h2>Practise your answer out loud.</h2>
      <p className="small">
        Syaahi streams your microphone only to the configured voice provider
        during this session. Do not share private interview questions, identity
        documents or confidential employer information.
      </p>
      <label>
        Target role
        <input
          value={role}
          maxLength={120}
          onChange={(e) => setRole(e.target.value)}
          disabled={running || connecting}
        />
      </label>
      <div>
        {running || connecting ? (
          <button className="btn light" onClick={stop}>
            Stop voice practice
          </button>
        ) : (
          <button className="btn dark" onClick={() => void start()}>
            Start voice interview
          </button>
        )}
      </div>
      {status && (
        <p role="status" className="small">
          {status}
        </p>
      )}
      {transcript.length > 0 && (
        <div className="voice-transcript" aria-live="polite">
          {transcript.map((line, index) => (
            <p key={`${index}-${line}`}>{line}</p>
          ))}
        </div>
      )}
      <p className="small">
        Voice sessions are private practice, not a hiring decision. Typed
        practice remains available while voice access is in beta.
      </p>
    </section>
  );
}
