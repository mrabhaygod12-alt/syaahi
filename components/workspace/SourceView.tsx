"use client";
import { useLesson } from "./LessonProvider";
import { lessonTitle, ytId } from "./types";

export default function SourceView() {
  const { job } = useLesson();
  if (!job) return null;
  const vid = ytId(job.sourceUrl);
  return (
    <div className="source-room">
      <h1>Source</h1>
      <p className="small">
        Original inputs for <b>{lessonTitle(job)}</b>
      </p>
      <div className="card" style={{ marginTop: 12 }}>
        <p>
          <b>Mode:</b>{" "}
          {job.sourceKind ||
            (vid ? "youtube" : job.context ? "upload/paste" : "topic")}
        </p>
        {job.sourceName && (
          <p>
            <b>Name:</b> {job.sourceName}
          </p>
        )}
        <p>
          <b>Planned pages:</b> {job.plannedTotal ?? job.total} ·{" "}
          <b>Generated:</b> {job.pages.length}
        </p>
        {job.planNote && <p className="small">{job.planNote}</p>}
        {job.brief && (
          <p>
            <b>Student brief:</b> {job.brief}
          </p>
        )}
      </div>
      {vid && (
        <div style={{ marginTop: 16 }}>
          <div className="yt-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${vid}`}
              title="Lesson video"
              loading="lazy"
              allowFullScreen
            />
          </div>
          <p className="small" style={{ marginTop: 8 }}>
            <a href={job.sourceUrl ?? "#"} target="_blank" rel="noreferrer">
              Watch on YouTube ↗
            </a>
          </p>
        </div>
      )}
      {job.context ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Transcript / document excerpt</h2>
          <p
            className="small"
            style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
          >
            {job.context}
          </p>
        </div>
      ) : (
        !vid && (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="small">
              Built from a typed topic — no uploaded file or YouTube link.
            </p>
          </div>
        )
      )}
      <h2 style={{ marginTop: 20 }}>Topics</h2>
      <ol>
        {job.topics.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </div>
  );
}
