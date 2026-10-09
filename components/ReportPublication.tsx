"use client";

import { useState } from "react";

const reasons = [
  ["spam", "Spam or promotion"],
  ["misleading", "Misleading or inaccurate"],
  ["harmful", "Harmful content"],
  ["copyright", "Copyright concern"],
  ["privacy", "Privacy concern"],
  ["other", "Other concern"],
] as const;

export default function ReportPublication({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] =
    useState<(typeof reasons)[number][0]>("misleading");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reason, details }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not submit report.");
      setMessage("Report received. A moderator will review it.");
      setDetails("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not submit report.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="story-report"
      className="publication-report"
      aria-label="Report this guide"
    >
      <button
        className="text-button"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? "Close report form" : "Report a concern"}
      </button>
      {open && (
        <div className="publication-report-form">
          <p className="small">
            Reports are reviewed by Syaahi moderators. Please describe the issue
            without including sensitive personal information.
          </p>
          <label>
            Reason
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as typeof reason)
              }
            >
              {reasons.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            What should the reviewer check?
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              minLength={12}
              maxLength={1200}
              rows={4}
              placeholder="Explain the specific issue and where it appears."
            />
          </label>
          {message && (
            <p
              className={
                message.includes("received") ? "small" : "inline-error"
              }
              role="status"
            >
              {message}
            </p>
          )}
          <button
            className="btn light"
            type="button"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Sending…" : "Send report"}
          </button>
        </div>
      )}
    </section>
  );
}
