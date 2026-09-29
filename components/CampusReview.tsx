"use client";
import { useEffect, useState } from "react";
import type { CampusApplication } from "@/lib/campus/applications";
import { requestJson } from "@/lib/http-client";
export default function CampusReview() {
  const [items, setItems] = useState<CampusApplication[]>([]),
    [filter, setFilter] = useState("submitted"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const { response, data } = await requestJson("/api/admin/campus");
    if (!response.ok) throw new Error(data.error);
    setItems(data.applications);
  }
  useEffect(() => {
    void load().catch((error) => setError(error.message));
  }, []);
  return (
    <main className="wrap feature-section">
      <h1>Campus and institution applications</h1>
      <label>
        Status
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {["all", "submitted", "reviewing", "accepted", "declined"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {items
        .filter((item) => filter === "all" || item.status === filter)
        .map((item) => (
          <article key={item.id} className="card">
            <h2>{item.institution}</h2>
            <p>
              {item.kind} · {item.name} · {item.email} · {item.seats} learner(s)
            </p>
            <p>{item.programme}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{item.message}</p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                setBusy(true);
                setError("");
                const form = new FormData(event.currentTarget);
                try {
                  const { response, data } = await requestJson(
                    "/api/admin/campus",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: item.id,
                        status: form.get("status"),
                        note: form.get("note"),
                      }),
                    },
                  );
                  if (!response.ok) throw new Error(data.error);
                  await load();
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : "Review failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <select name="status" aria-label="Review decision">
                <option value="reviewing">Reviewing</option>
                <option value="accepted">Accepted for pilot discussion</option>
                <option value="declined">Declined</option>
              </select>
              <textarea
                name="note"
                aria-label="Internal review note"
                minLength={12}
                maxLength={1200}
                required
              />
              <button className="btn dark" disabled={busy}>
                Save decision
              </button>
            </form>
            <details>
              <summary>Review history</summary>
              {item.history.map((entry, i) => (
                <p key={i}>
                  {entry.at} · {entry.status} · {entry.actor}
                  <br />
                  {entry.note}
                </p>
              ))}
            </details>
          </article>
        ))}
    </main>
  );
}
