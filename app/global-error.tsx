"use client";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "sans-serif",
          padding: 32,
          color: "#243b31",
          background: "#f7f8f5",
        }}
      >
        <main style={{ maxWidth: 540, margin: "15vh auto" }}>
          <p>Syaahii</p>
          <h1>Let’s try that again.</h1>
          <p>
            The application could not load. Reload it, or contact support if
            this continues.
          </p>
          <button
            onClick={reset}
            style={{ padding: "12px 20px", marginRight: 20 }}
          >
            Try again
          </button>
          <a href="/support">Contact support</a>
        </main>
      </body>
    </html>
  );
}
