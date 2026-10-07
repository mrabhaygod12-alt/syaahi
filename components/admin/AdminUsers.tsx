"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { ManagedUser } from "@/lib/admin/accounts";
export default function AdminUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([]),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("all"),
    [detail, setDetail] = useState<any>(null),
    [name, setName] = useState(""),
    [status, setStatus] = useState("active"),
    [role, setRole] = useState("none"),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  async function load() {
    const r = await requestJson(
      `/api/admin/users?q=${encodeURIComponent(q)}&status=${filter}`,
    );
    if (!r.response.ok) throw new Error(r.data.error);
    setUsers(r.data.users);
    setLoaded(true);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await requestJson(
        `/api/admin/users?id=${encodeURIComponent(id)}`,
      );
      if (!r.response.ok) throw new Error(r.data.error);
      setDetail(r.data);
      setName(r.data.user.name);
      setStatus(r.data.user.control.status);
      setRole(r.data.user.control.role || "none");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not inspect user.");
    } finally {
      setBusy(false);
    }
  }
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      const r = await requestJson("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detail.user.id,
          version: detail.user.control.version,
          action,
          name,
          role,
          status,
          reason,
        }),
      });
      if (!r.response.ok) throw new Error(r.data.error);
      await open(detail.user.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save change.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="wrap feature-section admin-content">
      <p className="eyebrow">PEOPLE & ACCESS</p>
      <h1>Manage accounts with context.</h1>
      <p>
        Role and access changes revoke every session for the affected account.
        Removal here is reversible; saved work and payment records remain.
      </p>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      <section className="admin-panel">
        <form
          className="admin-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            load()
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <input
            aria-label="Search users"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={120}
            placeholder="Name, email or account ID"
          />
          <select
            aria-label="Account status filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["all", "active", "suspended", "deleted"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button className="btn dark" disabled={busy}>
            Search accounts
          </button>
        </form>
        {!loaded ? (
          <p role="status">Loading accounts…</p>
        ) : users.length === 0 ? (
          <p>No matching accounts.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Workspace</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                      <br />
                      {u.email}
                      <br />
                      <small>
                        {u.verified ? "Verified" : "Awaiting verification"}
                      </small>
                    </td>
                    <td>{u.workspace}</td>
                    <td>{u.control.status}</td>
                    <td>{u.control.role || "Configured permissions"}</td>
                    <td>
                      <button
                        className="btn light"
                        disabled={busy}
                        onClick={() => open(u.id)}
                      >
                        Inspect account
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small">
              Up to 100 matching accounts; narrow the search for older records.
            </p>
          </div>
        )}
      </section>
      {detail && (
        <div className="admin-detail">
          <section className="admin-panel">
            <h2>{detail.user.name}</h2>
            <p>{detail.user.email}</p>
            <label>
              Account name
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Access
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deleted">Removed, recoverable</option>
              </select>
            </label>
            <label>
              Administrator role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {["none", "admin", "editor", "support", "billing"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Reason for this change
              <textarea
                value={reason}
                minLength={5}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="admin-toolbar">
              {[
                ["Save name", "edit"],
                ["Apply access", "access"],
                ["Apply role", "role"],
              ].map(([label, action]) => (
                <button
                  className="btn light"
                  key={action}
                  disabled={busy || reason.trim().length < 5}
                  onClick={() => act(action)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
          <section className="admin-panel">
            <h2>Account activity</h2>
            <p>
              {detail.activity.credits} credits ·{" "}
              {detail.activity.orders.length} recent orders ·{" "}
              {detail.activity.stories.length} stories ·{" "}
              {detail.activity.tickets.length} support tickets
            </p>
            <h3>Subscription</h3>
            {detail.activity.subscription ? (
              <p>
                {detail.activity.subscription.tier} ·{" "}
                {detail.activity.subscription.status} · ₹
                {(detail.activity.subscription.amount / 100).toFixed(2)}/month
                {detail.activity.subscription.currentEnd > 0 && (
                  <>
                    {" "}
                    · current cycle ends{" "}
                    {new Date(
                      detail.activity.subscription.currentEnd * 1000,
                    ).toLocaleDateString()}
                  </>
                )}
                {detail.activity.subscription.cancelScheduled &&
                  " · cancellation scheduled"}
              </p>
            ) : (
              <p>No saved monthly subscription.</p>
            )}
            <h3>Recent payment orders</h3>
            {detail.activity.orders.map((o: any) => (
              <p key={o.id}>
                {o.pack} · {o.currency} {(o.amount / 100).toFixed(2)} ·{" "}
                {o.paid ? "Captured" : "Awaiting captured payment"}
              </p>
            ))}
            <h3>Writing</h3>
            {detail.activity.stories.map((s: any) => (
              <p key={s.id}>
                {s.title} · {s.status}
                {s.slug && (
                  <>
                    {" "}
                    · <a href={`/guides/${s.slug}`}>Read published story</a>
                  </>
                )}
              </p>
            ))}
            <h3>Support</h3>
            {detail.activity.tickets.map((t: any) => (
              <p key={t.id}>
                <a href={`/admin/support?ticket=${t.id}`}>{t.subject}</a> ·{" "}
                {t.status}
              </p>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
