"use client";
import { useState } from "react";
import { requestJson } from "@/lib/http-client";
export default function ReportNote({ lesson }: { lesson: string }) {
  const [detail, setDetail] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <details className="card">
      <summary>Report an error in this lesson</summary>
      <p>
        Describe the incorrect explanation and the source you used to check it.
        You can track the report in Support.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const r = await requestJson("/api/student/report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lesson, detail }),
            });
            if (!r.response.ok) throw new Error(r.data.error);
            setDetail("");
            setMessage(
              "Report saved. Open Support to track or reply to your ticket.",
            );
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Could not save report.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          What needs checking?
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            minLength={20}
            maxLength={3000}
            required
          />
        </label>
        <button className="btn light" disabled={busy}>
          Send error report
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <a href="/support">Open Support →</a>
    </details>
  );
}
