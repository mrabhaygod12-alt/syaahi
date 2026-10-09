"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "./WorkspaceProvider";
import type { GuideEngagement } from "@/lib/writing/engagement";
import "./writer/social-workspace.css";
export default function PublicationActions({ slug }: { slug: string }) {
  const { user, loading } = useAccount();
  const key = `${slug}:${user?.id || "guest"}`;
  const identity = useRef(key);
  identity.current = key;
  const request = useRef<AbortController | null>(null),
    locked = useRef<string | null>(null),
    pendingTip = useRef<{ key: string; id: string } | null>(null);
  const [saved, setSaved] = useState<{
      key: string;
      value: GuideEngagement;
    } | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const data = !loading && saved?.key === key ? saved.value : null;
  const operation = useRef<AbortController | null>(null);
  const path = `/api/publications/${encodeURIComponent(slug)}/engagement`;
  async function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError("");
    try {
      const r = await requestJson(path, { signal: controller.signal });
      if (controller.signal.aborted || identity.current !== key) return;
      if (!r.response.ok) throw new Error(r.data.error);
      setSaved({ key, value: r.data as GuideEngagement });
    } catch (e) {
      if (!controller.signal.aborted && identity.current === key)
        setError((e as Error).message);
    }
  }
  useEffect(() => {
    setSaved(null);
    setBusy("");
    setMessage("");
    setError("");
    locked.current = null;
    pendingTip.current = null;
    if (!loading) void load();
    const refresh = (e: Event) => {
      if ((e as CustomEvent).detail === slug) void load();
    };
    window.addEventListener("syaahi-story-activity", refresh);
    return () => {
      request.current?.abort();
      operation.current?.abort();
      window.removeEventListener("syaahi-story-activity", refresh);
    };
  }, [key, loading]);
  async function act(action: "upvote" | "bookmark" | "tip", value?: boolean) {
    if (locked.current || !data) return;
    if (!user) {
      location.assign(`/login?next=${encodeURIComponent(`/guides/${slug}`)}`);
      return;
    }
    locked.current = key;
    setBusy(action);
    setMessage("");
    setError("");
    const controller = new AbortController();
    operation.current = controller;
    if (action === "tip" && pendingTip.current?.key !== key)
      pendingTip.current = { key, id: crypto.randomUUID() };
    try {
      const r = await requestJson(path, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "tip"
            ? { action, credits: 1, requestId: pendingTip.current!.id }
            : { action, value },
        ),
      });
      if (controller.signal.aborted || identity.current !== key) return;
      if (r.response.status === 401) {
        location.assign(
          `/login?workspace=${user.workspace || "student"}&next=${encodeURIComponent(`/guides/${slug}`)}`,
        );
        return;
      }
      if (!r.response.ok)
        throw new Error(r.data.error || "Could not update this story.");
      setSaved({ key, value: r.data as GuideEngagement });
      if (action === "tip") {
        pendingTip.current = null;
        setMessage("Sent 1 study credit to the creator.");
      }
    } catch (e) {
      if (!controller.signal.aborted && identity.current === key)
        setError((e as Error).message);
    } finally {
      if (identity.current === key) {
        locked.current = null;
        setBusy("");
      }
    }
  }
  async function edit() {
    if (!data?.viewer?.ownStoryId || locked.current) return;
    locked.current = key;
    setBusy("edit");
    setError("");
    const controller = new AbortController();
    operation.current = controller;
    try {
      const owned = await requestJson(
        `/api/stories?id=${encodeURIComponent(data.viewer.ownStoryId)}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || identity.current !== key) return;
      if (!owned.response.ok) throw new Error(owned.data.error);
      const story = owned.data.stories[0];
      const r = await requestJson("/api/writer/publishing", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: story.id,
          expectedUpdatedAt: story.updatedAt,
          action: "revise",
        }),
      });
      if (controller.signal.aborted || identity.current !== key) return;
      if (!r.response.ok) throw new Error(r.data.error);
      location.assign(`/write?draft=${encodeURIComponent(r.data.story.id)}`);
    } catch (e) {
      if (!controller.signal.aborted && identity.current === key)
        setError((e as Error).message);
    } finally {
      if (identity.current === key) {
        locked.current = null;
        setBusy("");
      }
    }
  }
  return (
    <section
      id="story-activity"
      className="publication-actions"
      aria-label="Story engagement"
    >
      {data ? (
        <div className="story-activity-counts">
          <span>{data.upvotes} likes</span>
          <a href="#story-responses">{data.comments} comments</a>
          <span title="Approximate page views, including repeat visits">
            {data.views.toLocaleString()} views
          </span>
        </div>
      ) : (
        !error && (
          <p role="status" className="small">
            Loading story activity…
          </p>
        )
      )}
      <div className="story-action-row">
        <button
          className="btn light"
          aria-pressed={!!data?.viewer?.upvoted}
          disabled={!!busy || !data}
          onClick={() => void act("upvote", !data?.viewer?.upvoted)}
        >
          {data?.viewer?.upvoted ? "♥ Liked" : "♡ Like"}
        </button>
        <a className="btn light" href="#story-responses">
          Comment
        </a>
        <button
          className="btn light"
          aria-pressed={!!data?.viewer?.bookmarked}
          disabled={!!busy || !data}
          onClick={() => void act("bookmark", !data?.viewer?.bookmarked)}
        >
          {data?.viewer?.bookmarked ? "Saved" : "Save story"}
        </button>
        <button
          className="btn light"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `${location.origin}/guides/${slug}`,
              );
              setMessage("Story link copied.");
            } catch {
              setMessage(`Share this story: ${location.origin}/guides/${slug}`);
            }
          }}
        >
          Share
        </button>
        <details className="writer-story-more">
          <summary aria-label="More story options">···</summary>
          <div>
            {data?.viewer?.ownStoryId && (
              <>
                <button
                  className="writer-text-button"
                  disabled={!!busy}
                  onClick={() => void edit()}
                >
                  Edit private revision
                </button>
                <a href="/writer/stats">Story stats</a>
                <a href="/writer/stories">Manage publication</a>
              </>
            )}
            <a href="#story-responses">View responses</a>
            <a href="#story-report">Report a concern</a>
            <button
              className="writer-text-button"
              disabled={!!busy || !data}
              onClick={() => void act("tip")}
            >
              Tip 1 existing credit
            </button>
            <small>
              Tips transfer existing credits and cannot be reversed
              automatically.
            </small>
          </div>
        </details>
      </div>
      {error && (
        <div>
          <p role="alert" className="small">
            {error}
          </p>
          {!data && (
            <button className="btn light" onClick={() => void load()}>
              Retry activity
            </button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="small">
          {message}
        </p>
      )}
    </section>
  );
}
