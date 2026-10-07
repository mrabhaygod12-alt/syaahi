"use client";
import { useEffect, useState, useRef } from "react";
import { requestJson } from "@/lib/http-client";
interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  messages?: Array<{ by: string; text: string; at: string }>;
}
export default function SupportDesk({
  workspace = "student",
}: {
  workspace?: "student" | "writer";
}) {
  const endpoint =
    workspace === "writer" ? "/api/writer/support" : "/api/support";
  const requestId = useRef<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]),
    [current, setCurrent] = useState<Ticket | null>(null),
    [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [category, setCategory] = useState(
      workspace === "writer" ? "writing" : "generation",
    ),
    [reply, setReply] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [loaded, setLoaded] = useState(false),
    [guest, setGuest] = useState(false),
    [admin, setAdmin] = useState(false);
  async function load() {
    const { response: r, data: d } = await requestJson(endpoint);
    if (r.status === 401) {
      setGuest(true);
      setCurrent(null);
      setTickets([]);
      setAdmin(false);
      setLoaded(false);
      return;
    }
    if (!r.ok)
      throw new Error(d.error || "Could not load your inbox. Please retry.");
    if (!Array.isArray(d.tickets))
      throw new Error("Could not load your inbox. Please retry.");
    setGuest(false);
    setLoaded(true);
    setTickets(d.tickets);
    setAdmin(!!d.admin);
  }
  async function openTicket(id: string) {
    const { response, data } = await requestJson(
      endpoint + "?id=" + encodeURIComponent(id),
    );
    if (!response.ok || !data.ticket)
      throw new Error(
        data.error || "Could not open this ticket. Please retry.",
      );
    setCurrent(data.ticket);
  }
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load your inbox. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function act(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const { response: r, data: d } = await requestJson(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(d.error);
      setCurrent(d.ticket);
      setReply("");
      // Saving succeeded even if the following inbox refresh is interrupted.
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save ticket.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="support-desk">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {admin ? "OPERATOR INBOX" : "YOUR SUPPORT INBOX"}
          </p>
          <h2>Keep the conversation together.</h2>
        </div>
        <button
          className="btn light"
          disabled={loading || busy}
          onClick={async () => {
            await refresh();
            if (current) {
              try {
                await openTicket(current.id);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not refresh ticket.",
                );
              }
            }
          }}
        >
          Refresh inbox
        </button>
      </div>
      <p>
        Messages are saved inside Syaahi. Check this inbox for replies; email
        notifications are not enabled. Never include passwords, OTPs or card
        details.
      </p>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading your support inbox…</p>}
      {guest ? (
        <a
          className="btn dark"
          href={
            workspace === "writer"
              ? "/login?workspace=writer&next=/writer/support"
              : "/login?workspace=student&next=/support"
          }
        >
          Sign in to contact support
        </a>
      ) : loaded ? (
        <div className="support-grid">
          <aside className="card">
            <h3>Your tickets</h3>
            {!tickets.length && <p>No tickets yet.</p>}
            {tickets.map((t) => (
              <button
                className="ticket-row"
                key={t.id}
                onClick={async () => {
                  setError("");
                  try {
                    await openTicket(t.id);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Could not open ticket.",
                    );
                  }
                }}
              >
                <b>{t.subject}</b>
                <span>
                  {t.category} · {t.status}
                </span>
              </button>
            ))}
          </aside>
          <div>
            {current ? (
              <section className="card">
                <button className="btn light" onClick={() => setCurrent(null)}>
                  New ticket
                </button>
                <h3>{current.subject}</h3>
                <p className="small">
                  {current.id} · {current.status}
                </p>
                <div className="ticket-messages">
                  {current.messages?.map((m, i) => (
                    <article
                      key={i}
                      className={m.by === "support" ? "support-reply" : ""}
                    >
                      <b>
                        {m.by === "support"
                          ? "Support team"
                          : workspace === "writer"
                            ? "Writer"
                            : "Learner"}
                      </b>
                      <time>{new Date(m.at).toLocaleString()}</time>
                      <p>{m.text}</p>
                    </article>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act({
                      action: "reply",
                      id: current.id,
                      message: reply,
                    });
                  }}
                >
                  <label>
                    Your reply
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      minLength={2}
                      maxLength={4000}
                      required
                      rows={4}
                    />
                  </label>
                  <button
                    className="btn dark"
                    disabled={busy || current.status === "closed"}
                  >
                    Send reply
                  </button>{" "}
                  <button
                    type="button"
                    className="btn light"
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action: ["resolved", "closed"].includes(current.status)
                          ? "reopen"
                          : "resolve",
                        id: current.id,
                      })
                    }
                  >
                    {["resolved", "closed"].includes(current.status)
                      ? "Reopen ticket"
                      : "Mark resolved"}
                  </button>
                </form>
              </section>
            ) : (
              <form
                className="card support-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act({
                      action: "create",
                      subject,
                      message,
                      category,
                      requestId:
                        requestId.current ||
                        (requestId.current = crypto.randomUUID()),
                    })
                  ) {
                    setSubject("");
                    requestId.current = null;
                    setMessage("");
                  }
                }}
              >
                <h3>How can we help?</h3>
                <label>
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {(workspace === "writer"
                      ? [
                          "writing",
                          "publishing",
                          "account",
                          "payment",
                          "privacy",
                          "other",
                        ]
                      : ["generation", "account", "payment", "privacy", "other"]
                    ).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Subject
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    minLength={5}
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  What happened?
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    minLength={20}
                    maxLength={4000}
                    required
                    rows={6}
                  />
                </label>
                <button className="btn dark" disabled={busy}>
                  {busy ? "Saving…" : "Create support ticket"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
