"use client";

// Turbo-style staged loader: the message always matches the real phase —
// planning/reading only before the first page lands, writing while pages
// stream in, polishing on the last stretch. (The old fraction math showed
// "Planning page topics…" with 2 of 6 pages already ready.)
export default function Loader({
  done,
  total,
  currentTopic,
}: {
  done: number;
  total: number;
  currentTopic?: string | null;
}) {
  const frac = total ? done / total : 0;
  const stage =
    done <= 0
      ? total > 1
        ? "Planning page topics…"
        : "Reading your source…"
      : frac >= 1
        ? "Polishing ink…"
        : currentTopic
          ? `Writing: ${currentTopic.slice(0, 60)}`
          : "Writing handwritten pages…";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2dbd2",
        borderRadius: 16,
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 44,
          marginBottom: 8,
          animation: "bob 1.6s ease-in-out infinite",
        }}
      >
        ✒️
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".15em",
          color: "#7c3aed",
          marginBottom: 4,
        }}
      >
        <span style={{ animation: "pulse 2s ease-in-out infinite" }}>✦</span>
        Writing your lesson
        <span
          style={{
            animation: "pulse 2s ease-in-out infinite",
            animationDelay: ".5s",
          }}
        >
          ✦
        </span>
      </div>
      <h2 style={{ margin: "4px 0 8px", fontSize: 22, fontWeight: 700 }}>
        {done > 0 ? `${done} of ${total} pages ready` : "Lesson in progress"}
      </h2>
      <p className="small" style={{ fontSize: 14 }}>
        {stage}
      </p>

      {/* Progress bar */}
      <div
        style={{
          background: "#f0ebe3",
          borderRadius: 999,
          height: 8,
          marginTop: 16,
          maxWidth: 400,
          marginLeft: "auto",
          marginRight: "auto",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(6, frac * 100)}%`,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #7c3aed, #2563eb)",
            transition: "width .6s ease",
          }}
        />
      </div>

      <style>{`
        @keyframes bob { 0%,100%{transform:translateY(0) rotate(-6deg)} 50%{transform:translateY(-10px) rotate(6deg)} }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
      `}</style>
    </div>
  );
}
