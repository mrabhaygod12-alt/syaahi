// Private workspace skeleton while a route streams in.
// Visiting a page does not create a note-generation job.
export default function Loading() {
  return (
    <div className="wrap" style={{ padding: "64px 1.5rem", minHeight: "50vh" }}>
      <p role="status" aria-live="polite">
        Opening Syaahi…
      </p>
      <div aria-hidden="true" style={{ maxWidth: 620, marginTop: 32 }}>
        {["65%", "100%", "85%"].map((width, i) => (
          <div
            key={width}
            style={{
              width,
              height: i === 0 ? 36 : 16,
              marginBottom: 20,
              borderRadius: 8,
              background: "#e8ece3",
            }}
          />
        ))}
      </div>
    </div>
  );
}
