"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
export default function GrowthReport() {
  const [report, setReport] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [updatedAt, setUpdatedAt] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await requestJson("/api/admin/growth");
      if (!r.response.ok)
        throw new Error(r.data.error || "Admin access required.");
      setReport(r.data);
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the growth report.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => clearInterval(timer);
  }, []);
  return (
    <main className="wrap feature-section admin-content">
      <AdminPageHeader
        eyebrow="CONSENTED MEASUREMENT"
        title="Growth and activation."
        description="Review consented product events and retention cohorts. Counts reflect recorded events and are not estimates of total reach."
        actions={
          <button
            className="btn light"
            type="button"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Refreshing…" : "Refresh report"}
          </button>
        }
      />
      {updatedAt && (
        <p className="admin-page-note" role="status">
          Updated {new Date(updatedAt).toLocaleTimeString()} · refreshes every 60 seconds
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!report && !error && (
        <p role="status" aria-busy={loading}>Loading measured activity…</p>
      )}
      {report && (
        <>
          <p>{report.scope}</p>
          <div className="admin-stat-grid admin-growth-grid">
            {[
              "visitors",
              "signup",
              "firstNote",
              "quiz",
              "flashcards",
              "paid",
              "referralShares",
            ].map((key) => (
              <article className="admin-panel" key={key}>
                <span>{key.replace(/([A-Z])/g, " $1")}</span>
                <strong>{Number(report[key] || 0).toLocaleString()}</strong>
                <small>Recorded events</small>
              </article>
            ))}
          </div>
          <section className="admin-panel">
            <h2>Signup retention</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Signup retention</th>
                    <th>Eligible</th>
                    <th>Returned on day</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.retention).map(([day, value]) => {
                    const r = value as any;
                    return (
                      <tr key={day}>
                        <td>{day}</td>
                        <td>{r.eligible}</td>
                        <td>{r.returned}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-panel">
            <h2>Preview CTA comparison</h2>
            <p>
              Compare consented samples with their denominators. This report
              does not claim statistical significance.
            </p>
            <div className="admin-variant-list">
              {report.variants.map((v: any) => (
                <article key={v.variant}>
                  <strong>{v.variant}</strong>
                  <span>{v.visitors} visitors</span>
                  <span>{v.previewStarts} starts</span>
                  <span>{v.previews} previews</span>
                  <span>{v.signups} signups</span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
