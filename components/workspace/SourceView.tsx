"use client";
import { useLesson } from "./LessonProvider";
import { lessonTitle, ytId } from "./types";

export default function SourceView() {
  const { job } = useLesson();
  if (!job) return null;
  const vid = ytId(job.sourceUrl);
  const researchExcerpt =
    job.sourceKind === "topic" &&
    Boolean(job.referenceLinks?.some((reference) => reference.kind === "source"));
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
        researchExcerpt ? (
          <details className="card" style={{ marginTop: 16 }}>
            <summary>Review the research excerpt used for planning</summary>
            <p
              className="small"
              style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, marginTop: 12 }}
            >
              {job.context}
            </p>
          </details>
        ) : (
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Transcript / document excerpt</h2>
            <p
              className="small"
              style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
            >
              {job.context}
            </p>
          </div>
        )
      ) : (
        !vid && (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="small">
              Built from a typed topic — no uploaded file or YouTube link.
            </p>
          </div>
        )
      )}
      {!!job.referenceLinks?.length && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>References and further reading</h2>
          <div className="reference-list">
            {job.referenceLinks.map((reference) => (
              <a
                key={`${reference.kind}:${reference.url}`}
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {reference.title} ↗
              </a>
            ))}
          </div>
          <p className="small">
            Wikipedia excerpts can ground your notes. Further-reading searches
            open externally and are not ingested into this lesson.
          </p>
        </section>
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
