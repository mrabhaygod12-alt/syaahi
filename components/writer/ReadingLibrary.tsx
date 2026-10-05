"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
export default function ReadingLibrary() {
  const { user, loading } = useAccount();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    if (loading) return;
    void requestJson("/api/writer/reading")
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error);
        if (!cancelled) setData(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading]);
  return (
    <section className="writer-primary reading-library">
      <p className="writer-kicker">YOUR READING LIFE</p>
      <h1>Continue a thought</h1>
      <p>
        Your saved reading position, personal highlights and followed writers.
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Opening your library…</p>}
      <h2>Following</h2>
      <div className="reading-following">
        {data?.writers.map((w: any) => (
          <a key={w.slug} href={`/creators/${w.slug}`}>
            {w.name} →
          </a>
        ))}
      </div>
      {data && !data.writers.length && (
        <p>Follow a writer from their public profile.</p>
      )}
      <h2>Recent reading</h2>
      {data?.reading.map((r: any) => (
        <article key={r.slug}>
          <a href={`/guides/${r.slug}`}>
            <h3>{r.title}</h3>
          </a>
          <p>
            {Math.round(r.fraction * 100)}% reached · {r.highlights.length}{" "}
            private highlights
          </p>
          {r.highlights.map((h: any) => (
            <blockquote key={h.id}>
              {h.quote}
              {h.note && <small>{h.note}</small>}
            </blockquote>
          ))}
        </article>
      ))}
      {data && !data.reading.length && (
        <p>
          Your signed-in reading will appear here.{" "}
          <a href="/community">Discover stories →</a>
        </p>
      )}
    </section>
  );
}
