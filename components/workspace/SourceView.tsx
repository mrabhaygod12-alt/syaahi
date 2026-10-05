"use client";
import { useLesson } from "./LessonProvider";
import { lessonTitle, ytId } from "./types";

export default function SourceView() {
  const { job } = useLesson();
  if (!job) return null;
  const vid = ytId(job.sourceUrl);
  const timestamped = (job.context || "")
    .split("\n")
    .filter((line) => /^\[T:\d+(?:\.\d+)?\]/.test(line))
    .slice(0, 500);
  const passages = Array.from(
    new Set(job.pages.flatMap((p) => p.markdown.match(/\[P\d+C\d+\]/g) || [])),
  ).slice(0, 100);
  const researchExcerpt =
    job.sourceKind === "topic" &&
    Boolean(
      job.referenceLinks?.some((reference) => reference.kind === "source"),
    );
  const retrievedReferences =
    job.referenceLinks?.filter((reference) => reference.kind === "source") ??
    [];
  const suggestedReading =
    job.referenceLinks?.filter((reference) => reference.kind === "search") ??
    [];
  return (
    <div className="source-room">
      <h1>Source</h1>
      {job.documentId && (
        <p>
          <a href={`/documents/${job.documentId}`}>
            Open private textbook pages and verify citations →
          </a>
        </p>
      )}
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
        <p className="small">
          <b>Evidence:</b> {retrievedReferences.length} retrieved reference
          {retrievedReferences.length === 1 ? "" : "s"} used for planning ·{" "}
          {suggestedReading.length} external reading suggestion
          {suggestedReading.length === 1 ? "" : "s"} not ingested into this
          lesson.
        </p>
      </div>
      {!!job.sourceScans?.length && (
        <section className="card">
          <h2>Scan preparation & learner review</h2>
          <p className="small">
            Saved extraction metadata describes the material used for this
            lesson. Learner review is not an OCR accuracy guarantee. Original
            images are not stored by this extraction flow.
          </p>
          {job.sourceScans.map((s) => (
            <p key={s.id}>
              {s.name} · rotated {s.rotation}° · crop {s.crop.width}% ×{" "}
              {s.crop.height}% · {s.width} × {s.height} pixels ·{" "}
              {s.unclearCount} unreadable markers ·{" "}
              {s.reviewed ? "reviewed by learner" : "review pending"}
            </p>
          ))}
        </section>
      )}
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
      {vid && !!timestamped.length && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Caption jump points</h2>
          <p>
            These jump points use timestamps supplied with the source captions.
            Check the video to confirm their timing and transcription.
          </p>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            {timestamped.map((line, i) => {
              const match = line.match(/^\[T:(\d+(?:\.\d+)?)\]\s*(.*)$/)!;
              const seconds = Math.floor(Number(match[1]));
              return (
                <p key={i}>
                  <a
                    href={`https://www.youtube.com/watch?v=${vid}&t=${seconds}s`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {Math.floor(seconds / 60)}:
                    {String(seconds % 60).padStart(2, "0")} ↗
                  </a>{" "}
                  {match[2]}
                </p>
              );
            })}
          </div>
        </section>
      )}
      {job.documentId && !!passages.length && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Passages cited in your notes</h2>
          <p>
            Open the physical PDF page and match the exact passage label. A
            label indicates a reference, not a guarantee that the generated
            claim is correct.
          </p>
          {passages.map((label) => (
            <a
              className="btn light"
              key={label}
              href={`/documents/${job.documentId}?page=${label.match(/P(\d+)/)![1]}`}
            >
              {label} ↗
            </a>
          ))}
        </section>
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
              Built from a typed topic : no uploaded file or YouTube link.
            </p>
          </div>
        )
      )}
      {!!retrievedReferences.length && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Retrieved references</h2>
          <div className="reference-list">
            {retrievedReferences.map((reference) => (
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
            These public references supplied context while the lesson was
            planned. Check them alongside your prescribed material for important
            work.
          </p>
        </section>
      )}
      {!!suggestedReading.length && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Suggested further reading</h2>
          <p className="small">
            These are topic-specific searches. Syaahi did not fetch or train on
            their pages for this lesson.
          </p>
          <div className="reference-list">
            {suggestedReading.map((reference) => (
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
