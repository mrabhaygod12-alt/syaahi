"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
export default function AdminReviews() {
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState("");
  async function load() {
    try {
      const { response, data } = await requestJson("/api/admin/reviews");
      if (!response.ok || !Array.isArray(data.reviews))
        throw new Error(data.error || "Could not load the review queue.");
      setItems(data.reviews);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reviews.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <main className="wrap feature-section admin-content">
      <p className="eyebrow">TRUST & FEEDBACK</p>
      <h1>Review real experiences.</h1>
      <p>
        Check authenticity, relevance and privacy before publishing. Both
        positive and negative feedback are welcome.
      </p>
      {error && <p role="alert">{error}</p>}
      {!loaded && !error && <p role="status">Loading review queue…</p>}
      {loaded && !items.length && (
        <section className="admin-panel">No submitted feedback yet.</section>
      )}
      <div className="admin-card-grid">
        {items.map((item) => (
          <article className="admin-panel" key={item.id}>
            <h2>{item.displayName}</h2>
            <p>
              {item.stars}/5 · {item.status} · Verified product user
            </p>
            <blockquote
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {item.text}
            </blockquote>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                const body = new FormData(e.currentTarget);
                setBusy(item.id);
                setError("");
                try {
                  const { response, data } = await requestJson(
                    "/api/admin/reviews",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: item.id,
                        revision: item.revision,
                        action: body.get("action"),
                        reason: body.get("reason"),
                      }),
                    },
                  );
                  if (!response.ok) throw new Error(data.error);
                  await load();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Moderation failed.",
                  );
                } finally {
                  setBusy("");
                }
              }}
            >
              <label>
                Decision
                <select name="action">
                  <option value="publish">Publish</option>
                  <option value="reject">Reject / withdraw</option>
                </select>
              </label>
              <label>
                Moderation reason
                <input required name="reason" maxLength={400} />
              </label>
              <button className="btn dark" disabled={!!busy}>
                {busy === item.id ? "Saving…" : "Save decision"}
              </button>
            </form>
            <details>
              <summary>Moderation history</summary>
              {item.moderation?.map((event: any, i: number) => (
                <p key={i}>
                  {event.action} · {event.at} · {event.reason}
                </p>
              ))}
            </details>
          </article>
        ))}
      </div>
    </main>
  );
}
