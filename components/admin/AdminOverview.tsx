"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import ProviderCatalog from "./ProviderCatalog";
export default function AdminOverview() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    requestJson("/api/admin/overview")
      .then((r) => {
        if (!r.response.ok) throw new Error(r.data.error);
        setData(r.data);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="wrap feature-section admin-content">
      <p className="eyebrow">SYAAHI ADMINISTRATION</p>
      <h1>A clear view of your platform.</h1>
      <p>
        Review work, resolve issues and manage access through protected, audited
        controls.
      </p>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Loading control room…</p>
      ) : (
        <>
          <div className="admin-stat-grid">
            {[
              ["Waiting for review", data.reviewQueue],
              ["Open content reports", data.openReports],
              ["Active support tickets", data.activeTickets],
              ["Feedback to review", data.pendingReviews],
            ].map(([name, n]) => (
              <section key={name} className="admin-panel">
                <strong>{n}</strong>
                <p>{name}</p>
                <small>Bounded operational queue; not an all-time total</small>
              </section>
            ))}
          </div>
          <div className="admin-card-grid">
            {[
              [
                "People & access",
                "/admin/users",
                "Search accounts, inspect activity and manage roles.",
                data.scopes.users,
              ],
              [
                "Editorial desk",
                "/admin/publications",
                "Review submissions and reported published content.",
                data.scopes.editorial,
              ],
              [
                "Payment operations",
                "/admin/payments",
                "Inspect orders, verified payments and subscriptions.",
                data.scopes.payments,
              ],
              [
                "Support inbox",
                "/admin/support",
                "Assign, reply, prioritize and resolve tickets.",
                data.scopes.support,
              ],
              [
                "Consent-based growth",
                "/admin/growth",
                "View aggregate funnel and retention measurements.",
                data.scopes.editorial,
              ],
              [
                "Security & sessions",
                "/admin/security",
                "Verify your authenticator and revoke devices.",
                true,
              ],
            ]
              .filter((x) => x[3])
              .map(([name, href, text]) => (
                <a
                  className="admin-panel"
                  href={href as string}
                  key={href as string}
                >
                  <h2>{name}</h2>
                  <span>{text}</span>
                </a>
              ))}
          </div>
          {data.services && (
            <div className="admin-card-grid">
              <section className="admin-panel">
                <h2>Processing service</h2>
                <div className="admin-service-row">
                  <span>Video jobs waiting / active</span>
                  <strong>{data.services.videoQueue}</strong>
                </div>
                <div className="admin-service-row">
                  <span>Worker mode</span>
                  <span className="admin-status-chip">
                    {data.services.worker.mode}
                  </span>
                </div>
                <p>
                  {data.services.worker.mode === "external"
                    ? data.services.worker.heartbeatFresh
                      ? "A worker heartbeat was seen within the last 10 minutes."
                      : "No recent worker heartbeat. Check the worker before expecting queued work to progress."
                    : "Embedded processing runs while the web service is awake. A dedicated worker is recommended for reliable long-running work."}
                </p>
                <div className="admin-service-row">
                  <span>No-caption video fallback</span>
                  <b>
                    {data.services.videoReadingConfigured
                      ? "Configured"
                      : "Needs Gemini key"}
                  </b>
                </div>
              </section>
              <section className="admin-panel">
                <h2>AI routing</h2>
                <p>
                  Configuration is not a live model health check. Rate limits
                  and account access still apply.
                </p>
                {data.services.providers.length ? (
                  data.services.providers.map((p: any) => (
                    <div className="admin-service-row" key={p.id}>
                      <span>
                        <b>{p.type}</b>
                        <br />
                        <small>{p.model}</small>
                      </span>
                      <span className="admin-status-chip">{p.status}</span>
                    </div>
                  ))
                ) : (
                  <p>No eligible AI provider configured.</p>
                )}
              </section>
            </div>
          )}
          {data.services?.gateways && (
            <ProviderCatalog providers={data.services.gateways} />
          )}
          {data.scopes.users && (
            <section className="admin-panel">
              <h2>Recent administration activity</h2>
              {data.audit.length === 0 ? (
                <p>No administration events recorded yet.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Actor / target</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.audit.map((e: any) => (
                        <tr key={e.id}>
                          <td>{new Date(e.at).toLocaleString()}</td>
                          <td>{e.action}</td>
                          <td>
                            {e.actor.slice(0, 8)} / {e.target.slice(0, 8)}
                          </td>
                          <td>{e.detail || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
