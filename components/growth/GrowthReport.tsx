"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
export default function GrowthReport() {
  const [report, setReport] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void requestJson("/api/admin/growth")
      .then((r) => {
        if (!r.response.ok)
          throw new Error(r.data.error || "Admin access required.");
        setReport(r.data);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="wrap feature-section">
      <p className="eyebrow">CONSENTED MEASUREMENT</p>
      <h1>Growth and activation</h1>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p role="status">Loading measured activity…</p>}
      {report && (
        <>
          <p>{report.scope}</p>
          <div className="grid grid-3">
            {[
              "visitors",
              "signup",
              "firstNote",
              "quiz",
              "flashcards",
              "paid",
              "referralShares",
            ].map((key) => (
              <article className="card" key={key}>
                <h2>{report[key]}</h2>
                <p>{key}</p>
              </article>
            ))}
          </div>
          <div className="table-scroll">
            <table>
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
          <h2>Preview CTA comparison</h2>
          <p>
            Consent-only samples. Compare denominators before drawing
            conclusions; no statistical significance is claimed.
          </p>
          {report.variants.map((v: any) => (
            <p key={v.variant}>
              {v.variant}: {v.visitors} visitors · {v.previewStarts} starts ·{" "}
              {v.previews} previews · {v.signups} signups
            </p>
          ))}
        </>
      )}
    </section>
  );
}
