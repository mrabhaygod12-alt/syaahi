"use client";
import type { RichNode } from "@/lib/writing/document";
import StoryDocument from "./StoryDocument";

import { useEffect, useState } from "react";

interface Story {
  id: string;
  title: string;
  summary: string;
  authorName: string;
  body: string;
  document?: RichNode;
}
interface Report {
  id: string;
  storyId: string;
  storySlug: string;
  reason: string;
  details: string;
  status: "open" | "dismissed" | "actioned";
  createdAt: string;
  resolutionNote?: string | null;
}
interface ModerationEvent {
  storyId: string;
  title: string;
  action: string;
  at: string;
  actor: string | null;
  note: string | null;
}

export default function PublicationReview() {
  const [stories, setStories] = useState<Story[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [audit, setAudit] = useState<ModerationEvent[]>([]);
  const [reportFilter, setReportFilter] = useState("open");
  const [note, setNote] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    try {
      const [reviewResponse, moderationResponse] = await Promise.all([
        fetch("/api/admin/stories"),
        fetch("/api/admin/moderation"),
      ]);
      const review = await reviewResponse.json();
      const moderation = await moderationResponse.json();
      if (!reviewResponse.ok)
        throw new Error(review.error || "Could not load review queue.");
      if (!moderationResponse.ok)
        throw new Error(moderation.error || "Could not load moderation queue.");
      setStories(review.stories || []);
      setReports(moderation.reports || []);
      setAudit(moderation.audit || []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load review queue.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);

  async function decide(id: string, action: "publish" | "changes") {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, note: note[id] || "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Review failed.");
      setStories((old) => old.filter((story) => story.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed.");
    } finally {
      setBusy("");
    }
  }

  async function moderate(
    report: Report,
    action: "dismiss" | "takedown" | "restore",
  ) {
    setBusy(report.id);
    setMessage("");
    try {
      const body =
        action === "restore"
          ? {
              storyId: report.storyId,
              action,
              note: note[report.id] || "Restored after moderation review.",
            }
          : { reportId: report.id, action, note: note[report.id] || "" };
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Moderation action failed.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Moderation action failed.",
      );
    } finally {
      setBusy("");
    }
  }

  const openReports = reports.filter((report) => report.status === "open");
  const filteredReports = reports.filter((report) =>
    reportFilter === "all" ? true : report.status === reportFilter,
  );
  return (
    <main className="wrap feature-section publication-review">
      <header>
        <p className="eyebrow">EDITORIAL &amp; SAFETY</p>
        <h1>Publication review</h1>
        <p className="small">
          Review submissions, record decisions, and take down public guides when
          a substantiated report requires it.
        </p>
      </header>
      {message && (
        <p className="inline-error" role="alert">
          {message}
        </p>
      )}
      <section aria-labelledby="review-queue">
        <h2 id="review-queue">Editorial queue</h2>
        {stories.map((story) => (
          <article className="interactive-panel" key={story.id}>
            <p className="eyebrow">SUBMITTED · {story.authorName}</p>
            <h3>{story.title}</h3>
            <p>{story.summary}</p>
            <StoryDocument document={story.document} fallback={story.body} />
            <label>
              Editorial note
              <input
                value={note[story.id] || ""}
                maxLength={1000}
                placeholder="Explain the decision or requested changes"
                onChange={(event) =>
                  setNote((current) => ({
                    ...current,
                    [story.id]: event.target.value,
                  }))
                }
              />
            </label>
            <div className="hero-actions">
              <button
                className="btn dark"
                disabled={busy === story.id}
                onClick={() => void decide(story.id, "publish")}
              >
                Publish reviewed guide
              </button>
              <button
                className="btn light"
                disabled={busy === story.id}
                onClick={() => void decide(story.id, "changes")}
              >
                Request changes
              </button>
            </div>
          </article>
        ))}
        {!stories.length && (
          <p className="card">No submitted guides in the review queue.</p>
        )}
      </section>
      <section className="moderation-queue" aria-labelledby="report-queue">
        <p className="eyebrow">COMMUNITY REPORTS</p>
        <h2 id="report-queue">Open reports ({openReports.length})</h2>
        <label className="small">
          Filter reports{" "}
          <select
            value={reportFilter}
            onChange={(event) => setReportFilter(event.target.value)}
          >
            <option value="open">Open</option>
            <option value="dismissed">Dismissed</option>
            <option value="actioned">Actioned</option>
            <option value="all">All reports</option>
          </select>
        </label>
        {filteredReports
          .filter((report) => report.status === "open")
          .map((report) => (
            <article className="interactive-panel" key={report.id}>
              <p className="eyebrow">
                {report.reason.toUpperCase()} ·{" "}
                {new Date(report.createdAt).toLocaleString()}
              </p>
              <h3>Guide: {report.storySlug}</h3>
              <p>{report.details}</p>
              <label>
                Moderation note <small>Required for a takedown</small>
                <input
                  value={note[report.id] || ""}
                  maxLength={1000}
                  placeholder="Record the evidence and decision"
                  onChange={(event) =>
                    setNote((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="hero-actions">
                <button
                  className="btn light"
                  disabled={busy === report.id}
                  onClick={() => void moderate(report, "dismiss")}
                >
                  Dismiss report
                </button>
                <button
                  className="btn danger"
                  disabled={busy === report.id}
                  onClick={() => void moderate(report, "takedown")}
                >
                  Take down guide
                </button>
              </div>
            </article>
          ))}
        {!openReports.length && (
          <p className="card">No open community reports.</p>
        )}
        <details className="card">
          <summary>
            Resolved reports ({reports.length - openReports.length})
          </summary>
          {reports
            .filter((report) => report.status !== "open")
            .map((report) => (
              <div className="resolved-report" key={report.id}>
                <b>{report.storySlug}</b> · {report.status}
                {report.resolutionNote ? ` : ${report.resolutionNote}` : ""}
                {report.status === "actioned" && (
                  <button
                    className="text-button"
                    disabled={busy === report.id}
                    onClick={() => void moderate(report, "restore")}
                  >
                    Restore guide
                  </button>
                )}
              </div>
            ))}
        </details>
        <details className="card moderation-audit">
          <summary>Formal moderation audit log ({audit.length})</summary>
          <p className="small">
            Records action, time, administrator ID, and the decision note. This
            log is retained with the guide record.
          </p>
          {audit.map((event) => (
            <div
              className="resolved-report"
              key={`${event.storyId}:${event.at}:${event.action}`}
            >
              <b>{event.action.replaceAll("_", " ")}</b> · {event.title} ·{" "}
              {new Date(event.at).toLocaleString()}
              {event.note ? ` : ${event.note}` : ""}
            </div>
          ))}
          {!audit.length && (
            <p className="small">No editorial or moderation events yet.</p>
          )}
        </details>
      </section>
    </main>
  );
}
