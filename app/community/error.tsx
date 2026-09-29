"use client";
export default function CommunityError({ reset }: { reset: () => void }) {
  return (
    <main className="wrap feature-section">
      <h1>Study guides are temporarily unavailable</h1>
      <p>
        We could not reach the publishing service. Please try again shortly.
      </p>
      <button className="btn dark" onClick={reset}>
        Try again
      </button>
      <a className="btn light" href="/dashboard">
        Open workspace
      </a>
    </main>
  );
}
