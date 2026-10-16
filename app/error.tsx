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
      <p className="eyebrow">LET’S GET YOU BACK</p>
      <h1 style={{ fontSize: 24 }}>This page could not open.</h1>
      <p className="small" style={{ maxWidth: 480, margin: "8px auto" }}>
        Try again, or return home and reopen your work. If the problem
        continues, contact support.
      </p>
      {error.digest && /^[a-z0-9:_-]{1,100}$/i.test(error.digest) && (
        <p className="small">Reference: {error.digest}</p>
      )}
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
        <a className="btn light" href="/">
          Home
        </a>
        <a className="btn light" href="/support">
          Contact support
        </a>
      </div>
    </div>
  );
}
