"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import NotePage from "./NotePage";
import { DEFAULT_STYLE } from "@/lib/handwriting/options";
type Shared = {
  title: string;
  role: "viewer" | "editor";
  pages: Array<{ topic: string; markdown: string }>;
};
export default function SharedLesson({ token }: { token: string }) {
  const [lesson, setLesson] = useState<Shared | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (alive) setLesson(d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [token]);
  async function join() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", token }),
      });
      if (r.status === 401) {
        setLogin(true);
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.assign(`/lesson/${d.lesson}/notes`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not open this invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="container"
      style={{ maxWidth: 1000, padding: "48px 24px" }}
    >
      <p className="eyebrow">Shared learning</p>
      <h1>{lesson?.title || "A lesson to explore together"}</h1>
      {error && <p role="alert">{error}</p>}
      {!lesson && !error && <p>Opening this share link…</p>}
      {lesson && (
        <>
          <p>
            {lesson.pages.length} sections ·{" "}
            {lesson.role === "editor"
              ? "Editor invitation"
              : "Read-only invitation"}
            . The owner can revoke this link at any time.
          </p>
          <button className="btn dark" disabled={busy} onClick={join}>
            {busy ? "Joining…" : "Open in my workspace"}
          </button>
          {login && (
            <p>
              <Link
                href={`/login?next=${encodeURIComponent("/share/" + token)}`}
              >
                Sign in to join this lesson
              </Link>
            </p>
          )}
          <div className="pages-col" style={{ marginTop: 32 }}>
            {lesson.pages.map((p, i) => (
              <section key={i}>
                <h2>{p.topic}</h2>
                <NotePage
                  markdown={p.markdown}
                  style={DEFAULT_STYLE}
                  footer={`Shared lesson · Section ${i + 1}`}
                  seedKey={`share-${i}`}
                />
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
