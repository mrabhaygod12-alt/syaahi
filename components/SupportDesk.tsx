"use client";
import { useEffect, useState } from "react";
interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  messages?: Array<{ by: string; text: string; at: string }>;
}
export default function SupportDesk() {
  const [tickets, setTickets] = useState<Ticket[]>([]),
    [current, setCurrent] = useState<Ticket | null>(null),
    [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [category, setCategory] = useState("generation"),
    [reply, setReply] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [guest, setGuest] = useState(false),
    [admin, setAdmin] = useState(false);
  async function load() {
    const r = await fetch("/api/support");
    if (r.status === 401) {
      setGuest(true);
      return;
    }
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setTickets(d.tickets);
    setAdmin(d.admin);
  }
  useEffect(() => {
    load().catch(() => setError("Could not load your support inbox."));
  }, []);
  async function act(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCurrent(d.ticket);
      setReply("");
      await load();
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
          onClick={() => {
            load().catch(() => setError("Refresh failed."));
            if (current)
              fetch("/api/support?id=" + current.id)
                .then((r) => r.json())
                .then((d) => d.ticket && setCurrent(d.ticket))
                .catch(() => {});
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
      {guest ? (
        <a className="btn dark" href="/login?next=/support">
          Sign in to contact support
        </a>
      ) : (
        <div className="support-grid">
          <aside className="card">
            <h3>Your tickets</h3>
            {!tickets.length && <p>No tickets yet.</p>}
            {tickets.map((t) => (
              <button
                className="ticket-row"
                key={t.id}
                onClick={async () => {
                  const r = await fetch("/api/support?id=" + t.id);
                  const d = await r.json();
                  if (r.ok) setCurrent(d.ticket);
                  else setError(d.error);
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
                      <b>{m.by === "support" ? "Support team" : "Learner"}</b>
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
                  <button className="btn dark" disabled={busy}>
                    Send reply
                  </button>{" "}
                  <button
                    type="button"
                    className="btn light"
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action:
                          current.status === "resolved" ? "reopen" : "resolve",
                        id: current.id,
                      })
                    }
                  >
                    {current.status === "resolved"
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
                    await act({ action: "create", subject, message, category })
                  ) {
                    setSubject("");
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
                    {[
                      "generation",
                      "account",
                      "payment",
                      "privacy",
                      "other",
                    ].map((c) => (
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
      )}
    </section>
  );
}
