"use client";
import { useEffect, useRef, useState } from "react";
export default function LectureRecorder({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const [active, setActive] = useState(false),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    cancelled = useRef(false);
  useEffect(
    () => () => {
      cancelled.current = true;
      recorder.current?.state === "recording" && recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(
      () =>
        setSeconds((s) => {
          if (s >= 899) recorder.current?.stop();
          return s + 1;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [active]);
  async function start() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "This browser cannot record audio. Upload an audio file instead.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const type = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const r = new MediaRecorder(
        stream.current,
        type ? { mimeType: type } : undefined,
      );
      recorder.current = r;
      const parts: BlobPart[] = [];
      let bytes = 0;
      cancelled.current = false;
      r.ondataavailable = (e) => {
        if (e.data.size) {
          parts.push(e.data);
          bytes += e.data.size;
          if (bytes > 8 * 1024 * 1024 && r.state === "recording") r.stop();
        }
      };
      r.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setActive(false);
        if (!cancelled.current) {
          const blob = new Blob(parts, { type: r.mimeType });
          onFile(
            new File(
              [blob],
              `lecture-recording.${r.mimeType.includes("mp4") ? "m4a" : "webm"}`,
              { type: r.mimeType },
            ),
          );
        }
      };
      r.start(1000);
      setSeconds(0);
      setActive(true);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(e instanceof Error ? e.message : "Microphone access failed.");
    }
  }
  return (
    <span className="recorder">
      <button
        type="button"
        className="attach-btn"
        disabled={disabled && !active}
        onClick={() => (active ? recorder.current?.stop() : void start())}
      >
        {active
          ? `■ Stop ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : "◉ Record"}
      </button>
      {active && (
        <button
          type="button"
          className="attach-btn"
          onClick={() => {
            cancelled.current = true;
            recorder.current?.stop();
          }}
        >
          Cancel
        </button>
      )}
      {error && (
        <span role="alert" className="small">
          {error}
        </span>
      )}
    </span>
  );
}
