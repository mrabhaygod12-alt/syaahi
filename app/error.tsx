"use client";

// Route-level crash boundary: no more full white-screens.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="wrap"
      style={{ padding: "64px 1.5rem", textAlign: "center" }}
    >
      <div style={{ fontSize: 44 }}>😵</div>
      <h1 style={{ fontSize: 24 }}>Something broke on this page</h1>
      <p className="small" style={{ maxWidth: 480, margin: "8px auto" }}>
        {String(error?.message ?? "Unknown error").slice(0, 200)}
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 16,
        }}
      >
        <button className="btn dark" onClick={reset}>
          Try again
        </button>
        <a className="btn light" href="/dashboard">
          Dashboard
        </a>
      </div>
    </div>
  );
}
