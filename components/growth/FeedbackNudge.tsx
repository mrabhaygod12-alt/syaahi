"use client";
import { useEffect, useState } from "react";
export default function FeedbackNudge({
  owner,
  lesson,
  ready,
}: {
  owner: string;
  lesson: string;
  ready: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);
  const key = `syaahi-feedback-invite:${owner}:${lesson}`;
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "dismissed");
    } catch {
      setDismissed(false);
    }
  }, [key]);
  if (!ready || dismissed) return null;
  return (
    <aside className="feedback-nudge" aria-label="Optional feedback">
      <div>
        <strong>Did these notes help you understand?</strong>
        <p>Tell us what worked and what needs improvement.</p>
      </div>
      <a href="/feedback" className="btn light">
        Share feedback
      </a>
      <button
        type="button"
        className="btn light"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(key, "dismissed");
          } catch {}
        }}
      >
        Not now
      </button>
    </aside>
  );
}
