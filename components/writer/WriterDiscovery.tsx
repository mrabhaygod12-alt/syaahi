"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import type { Story } from "@/lib/writing/stories";
import type {
  DiscoveryCheck,
  DiscoveryReport,
} from "@/lib/writing/discovery-types";
import "./discovery.css";
export default function WriterDiscovery({
  story,
  ready,
  onApply,
  onBusy,
}: {
  story: Story;
  ready: boolean;
  onApply: (s: Story) => void;
  onBusy: (value: boolean) => void;
}) {
  const [report, setReport] = useState<DiscoveryReport | null>(null),
    [checks, setChecks] = useState<DiscoveryCheck[]>([]),
    [title, setTitle] = useState(story.searchMetadata?.title || ""),
    [description, setDescription] = useState(
      story.searchMetadata?.description || "",
    ),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const stale = report?.storyUpdatedAt !== story.updatedAt;
  useEffect(() => {
    const controller = new AbortController();
    requestJson(
      `/api/writer/discovery?storyId=${encodeURIComponent(story.id)}`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (controller.signal.aborted) return;
        if (!r.response.ok) throw new Error(r.data.error);
        setChecks(r.data.checks);
        setReport(r.data.report);
        if (r.data.report && !r.data.stale) {
          setTitle(r.data.report.suggestions.title);
          setDescription(r.data.report.suggestions.description);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [story.id]);
  async function act(action: "analyze" | "apply") {
    if (busy || !ready) return;
    setBusy(true);
    onBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await requestJson(
        "/api/writer/discovery",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            storyId: story.id,
            expectedUpdatedAt: story.updatedAt,
            reportId: report?.id,
            title,
            description,
            approve: approved,
          }),
        },
        35000,
      );
      if (!r.response.ok) throw new Error(r.data.error);
      if (action === "analyze") {
        const next = r.data.report as DiscoveryReport;
        setReport(next);
        setChecks(next.checks);
        setTitle(next.suggestions.title);
        setDescription(next.suggestions.description);
        setApproved(false);
      } else {
        setReport(null);
        onApply(r.data.story);
        setApproved(false);
        setMessage(
          "Approved search metadata saved. Your article body and editorial status are unchanged.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not complete this request.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="writer-discovery">
      <p className="writer-kicker">SEO · ANSWER CLARITY · AUTHOR CONTEXT</p>
      <h2>Help the right readers find you.</h2>
      <p>
        Analyze your saved draft for accurate search metadata and clearer
        answers. You decide what to apply. These checks describe the draft; they
        do not predict search ranking or inclusion in AI answers.
      </p>
      {error && (
        <p role="alert" className="discovery-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="discovery-success">
          {message}
        </p>
      )}
      {story.searchMetadata && (
        <section
          className="discovery-search-preview"
          aria-label="Saved search metadata"
        >
          <small>APPROVED METADATA</small>
          <h3>{story.searchMetadata.title}</h3>
          <p>{story.searchMetadata.description}</p>
        </section>
      )}
      <div className="discovery-checks">
        {checks.map((c) => (
          <article key={c.id}>
            <span>{c.passed ? "✓ Present" : "Review"}</span>
            <h3>{c.label}</h3>
            <p>{c.detail}</p>
          </article>
        ))}
      </div>
      <p className="small">
        Requesting suggestions sends up to 20,000 characters from this saved
        draft to the configured AI service. Limited to five requests per hour.
        Account credits are not used.
      </p>
      <button
        className="btn dark"
        disabled={busy || !ready}
        onClick={() => act("analyze")}
      >
        {busy
          ? "Working on your draft…"
          : report
            ? "Analyze saved draft again"
            : "Suggest discovery improvements"}
      </button>
      {!ready && (
        <p role="status">Save your latest edits before using this tool.</p>
      )}
      {report && (
        <section className="discovery-proposal">
          <p className="writer-kicker">PROPOSED METADATA · REVIEW REQUIRED</p>
          {stale && (
            <p role="status">
              This report belongs to an earlier saved version. Analyze again
              before applying.
            </p>
          )}
          <label>
            Search title
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setApproved(false);
              }}
              maxLength={80}
              disabled={busy}
            />
            <small>{title.length}/80 characters</small>
          </label>
          <label>
            Search description
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setApproved(false);
              }}
              maxLength={160}
              disabled={busy}
              rows={3}
            />
            <small>{description.length}/160 characters</small>
          </label>
          <div className="discovery-search-preview">
            <small>www.syaahii.in › guides › your-story</small>
            <h3>{title || story.title}</h3>
            <p>{description || story.summary}</p>
          </div>
          <label className="discovery-approval">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
              disabled={busy || stale}
            />
            <span>
              I reviewed these fields and confirm they accurately describe my
              article.
            </span>
          </label>
          <button
            className="btn dark"
            disabled={
              busy ||
              !ready ||
              stale ||
              !approved ||
              title.trim().length < 5 ||
              description.trim().length < 20
            }
            onClick={() => act("apply")}
          >
            Apply approved search metadata
          </button>
          <h3>Topics to consider</h3>
          <p>
            {report.suggestions.topics.join(" · ") ||
              "No extra topics suggested."}
          </p>
          <h3>Questions your draft can answer</h3>
          {report.suggestions.questions.length === 0 && (
            <p>No verifiable question evidence was returned.</p>
          )}
          {report.suggestions.questions.map((q, i) => (
            <article className="discovery-evidence" key={i}>
              <h4>{q.question}</h4>
              <blockquote>{q.evidence}</blockquote>
              <small>
                Exact excerpt verified against this saved draft. No FAQ markup
                was added.
              </small>
            </article>
          ))}
          <h3>Editorial improvements</h3>
          <ul>
            {report.suggestions.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p className="small">
            Suggestions: {report.provider} / {report.model}. Review factual
            accuracy against your original sources.
          </p>
        </section>
      )}
    </div>
  );
}
