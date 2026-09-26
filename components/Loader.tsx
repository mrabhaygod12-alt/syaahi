"use client";
export default function Loader({
  done,
  total,
  currentTopic,
}: {
  done: number;
  total: number;
  currentTopic?: string | null;
}) {
  const ready = Math.max(0, Math.min(done, total || done));
  return (
    <section className="generation-loader" aria-busy="true">
      <div className="loader-notebook" aria-hidden="true">
        <span />
        <span />
        <span />
        <i>✦</i>
      </div>
      <p className="eyebrow">YOUR WORKSPACE IS TAKING SHAPE</p>
      <h2>
        {ready
          ? `${ready} of ${total} sections ready`
          : "Preparing your first section"}
      </h2>
      <p role="status">
        {currentTopic
          ? `Working on ${currentTopic}`
          : ready >= total && total > 0
            ? "Saving your lesson…"
            : "Your request is queued or being processed. You can return to your dashboard."}
      </p>
      {total > 0 ? (
        <progress
          max={total}
          value={ready}
          aria-label="Completed note sections"
        />
      ) : (
        <progress aria-label="Preparing lesson" />
      )}
      <p className="small">
        Progress reflects saved sections. Long sections may produce more than
        one PDF sheet.
      </p>
    </section>
  );
}
