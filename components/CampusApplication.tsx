"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
export default function CampusApplication({
  kind = "ambassador",
}: {
  kind?: "ambassador" | "institution";
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [items, setItems] = useState<
    Array<{ id: string; kind: string; institution: string; status: string }>
  >([]);
  async function refresh() {
    const { response, data } = await requestJson("/api/campus");
    if (response.ok) setItems(data.applications);
  }
  useEffect(() => {
    void refresh().catch(() => {});
  }, []);
  return (
    <section className="card">
      <h2>
        {kind === "ambassador"
          ? "Apply for the campus pilot"
          : "Request an institution pilot"}
      </h2>
      <p>
        Applications are reviewed by the Syaahi team. Submitting does not create
        a university partnership or guarantee paid work, access, or credits.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          const form = new FormData(event.currentTarget);
          try {
            const { response, data } = await requestJson("/api/campus", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                kind,
                institution: form.get("institution"),
                programme: form.get("programme"),
                seats: Number(form.get("seats") || 1),
                message: form.get("message"),
                consent: form.get("consent") === "on",
              }),
            });
            if (response.status === 401) {
              window.location.assign(
                `/login?next=${kind === "ambassador" ? "/campus" : "/enterprise"}`,
              );
              return;
            }
            if (!response.ok) throw new Error(data.error);
            setMessage("Application saved. You can track its status here.");
            await refresh();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Application failed.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Institution
          <input name="institution" required minLength={3} maxLength={160} />
        </label>
        <label>
          Course or department
          <input name="programme" maxLength={160} />
        </label>
        {kind === "institution" && (
          <label>
            Expected learners
            <input
              name="seats"
              type="number"
              min={1}
              max={10000}
              defaultValue={30}
              required
            />
          </label>
        )}
        <label>
          Your proposal
          <textarea
            name="message"
            minLength={30}
            maxLength={2000}
            required
            rows={5}
            placeholder="Describe the course, learners, materials you can use, and how you would run a small pilot."
          />
        </label>
        <label>
          <input name="consent" type="checkbox" required /> I agree to
          application-related contact at my account email.
        </label>
        <button className="btn dark" disabled={busy}>
          {busy ? "Saving…" : "Submit application"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {items
        .filter((item) => item.kind === kind)
        .map((item) => (
          <p key={item.id}>
            <b>{item.institution}</b> : {item.status}
          </p>
        ))}
    </section>
  );
}
