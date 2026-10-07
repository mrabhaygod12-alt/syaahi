"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import {
  TICKET_STATUSES,
  type SupportTicket,
  type TicketIndex,
} from "@/lib/support-types";
export default function AdminSupport() {
  const [tickets, setTickets] = useState<TicketIndex[]>([]),
    [ticket, setTicket] = useState<SupportTicket | null>(null),
    [agents, setAgents] = useState<{ id: string; name: string }[]>([]),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [workspace, setWorkspace] = useState("all"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    const r = await requestJson(
      `/api/admin/support?q=${encodeURIComponent(q)}&status=${status}&workspace=${workspace}`,
    );
    if (!r.response.ok) throw new Error(r.data.error);
    setTickets(r.data.tickets);
    setAgents(r.data.agents);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const id = new URLSearchParams(location.search).get("ticket");
    if (id && id.length <= 80) void open(id);
  }, []);
  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await requestJson(
        `/api/admin/support?id=${encodeURIComponent(id)}`,
      );
      if (!r.response.ok) throw new Error(r.data.error);
      setTicket(r.data.ticket);
      setAgents(r.data.agents);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ticket.");
    } finally {
      setBusy(false);
    }
  }
  async function act(action: string, value: Record<string, unknown> = {}) {
    if (!ticket || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await requestJson("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticket.id,
          revision: ticket.revision || 0,
          action,
          message,
          ...value,
        }),
      });
      if (!r.response.ok) throw new Error(r.data.error);
      setTicket(r.data.ticket);
      if (["reply", "note"].includes(action)) setMessage("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update ticket.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="wrap feature-section admin-content">
      <p className="eyebrow">SUPPORT OPERATIONS</p>
      <h1>Help people move forward.</h1>
      <p>
        Manage student and writer conversations. Internal notes stay private to
        verified support administrators.
      </p>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          load()
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Search tickets
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={120}
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Workspace
          <select
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
          >
            <option value="all">Both workspaces</option>
            <option>student</option>
            <option>writer</option>
          </select>
        </label>
        <button className="btn dark" disabled={busy}>
          Search
        </button>
      </form>
      <div className="admin-support-grid">
        <section className="admin-panel">
          <h2>Latest tickets</h2>
          <p className="small">
            Up to 100 matching tickets. Refine the search for older
            conversations.
          </p>
          {tickets.length === 0 && <p>No tickets match this view.</p>}
          <ul className="admin-ticket-list">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  disabled={busy}
                  aria-pressed={ticket?.id === t.id}
                  onClick={() => open(t.id)}
                >
                  <strong>{t.subject}</strong>
                  <span>
                    {t.workspace || "student"} · {t.status} ·{" "}
                    {t.priority || "normal"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-panel">
          {!ticket ? (
            <>
              <h2>Select a conversation.</h2>
              <p>
                Open a ticket to reply, assign a teammate or track resolution.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">
                {ticket.workspace} · {ticket.category}
              </p>
              <h2>{ticket.subject}</h2>
              <p className="small">
                Ticket {ticket.id} · revision {ticket.revision || 0}
              </p>
              <div className="admin-filters">
                <label>
                  Status
                  <select
                    disabled={busy}
                    value={ticket.status}
                    onChange={(e) => act("status", { status: e.target.value })}
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    disabled={busy}
                    value={ticket.priority || "normal"}
                    onChange={(e) =>
                      act("priority", { priority: e.target.value })
                    }
                  >
                    {["normal", "high", "urgent"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Assigned to
                  <select
                    disabled={busy}
                    value={ticket.assignedTo || ""}
                    onChange={(e) =>
                      act("assign", { assignedTo: e.target.value || null })
                    }
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-conversation">
                {ticket.messages.map((m, i) => (
                  <article key={i}>
                    <strong>
                      {m.by === "support" ? "Support reply" : "User message"}
                    </strong>
                    <time>{new Date(m.at).toLocaleString()}</time>
                    <p>{m.text}</p>
                  </article>
                ))}
              </div>
              <label>
                Reply or private note
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={4000}
                  rows={4}
                />
              </label>
              <div className="admin-actions">
                <button
                  className="btn dark"
                  disabled={
                    busy ||
                    message.trim().length < 2 ||
                    ticket.status === "closed"
                  }
                  onClick={() => act("reply")}
                >
                  Send support reply
                </button>
                <button
                  className="btn light"
                  disabled={busy || message.trim().length < 2}
                  onClick={() => act("note")}
                >
                  Save internal note
                </button>
                <button
                  className="btn light"
                  disabled={busy}
                  onClick={() => open(ticket.id)}
                >
                  Reload ticket
                </button>
              </div>
              <details>
                <summary>
                  Internal notes ({ticket.internalNotes?.length || 0})
                </summary>
                {ticket.internalNotes?.map((n, i) => (
                  <article className="admin-internal-note" key={i}>
                    <time>{new Date(n.at).toLocaleString()}</time>
                    <p>{n.text}</p>
                  </article>
                ))}
              </details>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
