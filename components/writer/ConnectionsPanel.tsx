"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
import FollowWriter from "./FollowWriter";
type Writer = { slug: string; name: string; bio: string; avatar: string };
export default function ConnectionsPanel({ slug }: { slug?: string }) {
  const { user } = useAccount();
  const [mode, setMode] = useState("following"),
    [writers, setWriters] = useState<Writer[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [counts, setCounts] = useState({ followers: 0, following: 0 }),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const root = slug
    ? `/api/creators/${encodeURIComponent(slug)}/connections`
    : "/api/writer/connections";
  async function load(after = "") {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const r = await requestJson(
        `${root}?mode=${mode}${after ? `&cursor=${encodeURIComponent(after)}` : ""}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || request.current !== controller) return;
      if (!r.response.ok) throw new Error(r.data.error);
      setWriters((old) =>
        after
          ? [...old, ...r.data.writers].filter(
              (w, i, all) => all.findIndex((v) => v.slug === w.slug) === i,
            )
          : r.data.writers,
      );
      setCursor(r.data.nextCursor);
      setCounts(r.data.counts);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    setWriters([]);
    setCursor(null);
    void load();
    return () => request.current?.abort();
  }, [root, mode, user?.id]);
  return (
    <section className="writer-connections" aria-label="Writer connections">
      <div className="writer-tabs" role="tablist" aria-label="Connections">
        <button
          role="tab"
          aria-selected={mode === "following"}
          onClick={() => setMode("following")}
        >
          Following <small>{counts.following}</small>
        </button>
        <button
          role="tab"
          aria-selected={mode === "followers"}
          onClick={() => setMode("followers")}
        >
          Followers <small>{counts.followers}</small>
        </button>
      </div>
      <p className="writer-fine-print">
        Only verified public writer profiles appear here. Counts include all
        active follows.{" "}
        {!slug &&
          "Your lists are private until you enable them in Edit profile."}
      </p>
      {writers.map((w) => (
        <article className="writer-connection-card" key={w.slug}>
          <a
            className="writer-avatar"
            href={`/creators/${w.slug}`}
            aria-label={w.name}
          >
            {w.avatar ? <img src={w.avatar} alt="" /> : w.name.charAt(0)}
          </a>
          <div>
            <a href={`/creators/${w.slug}`}>
              <h3>{w.name}</h3>
            </a>
            <p>{w.bio || "A writer sharing their perspective."}</p>
            <FollowWriter slug={w.slug} onChange={() => void load()} />
          </div>
        </article>
      ))}
      {busy && <p role="status">Loading connections…</p>}
      {error && (
        <div>
          <p role="alert">{error}</p>
          <button className="btn light" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {!busy && !error && !writers.length && (
        <div className="writer-empty">
          <h2>No public writers in this view yet.</h2>
          <p>
            Follow voices that interest you and read their stories in your
            Following feed.
          </p>
          <a
            className="btn light"
            href={user?.workspace === "writer" ? "/writer" : "/community"}
          >
            Discover stories
          </a>
        </div>
      )}
      {cursor && !error && (
        <button
          className="btn light"
          disabled={busy}
          onClick={() => void load(cursor)}
        >
          Load more writers
        </button>
      )}
    </section>
  );
}
