import type { ReactNode } from "react";

// Shared professional page kit: deep scrollable pages, consistent hero,
// readable prose, FAQ block and CTA band. Used by ALL marketing/legal/docs pages.
export function PageHero({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: string;
  lede?: string;
}) {
  return (
    <section className="page-hero">
      <div className="wrap">
        <p
          className="small"
          style={{
            textTransform: "uppercase",
            letterSpacing: ".18em",
            fontWeight: 700,
          }}
        >
          {kicker}
        </p>
        <h1 style={{ fontSize: 40, margin: "8px 0 12px", lineHeight: 1.15 }}>
          {title}
        </h1>
        {lede && (
          <p style={{ color: "#6f6a63", fontSize: 17, maxWidth: 640 }}>
            {lede}
          </p>
        )}
      </div>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 16 }}>
      <article style={{ maxWidth: 760, lineHeight: 1.75, fontSize: 16 }}>
        {children}
      </article>
    </div>
  );
}

export function H({ children }: { children: ReactNode }) {
  return <h2 style={{ marginTop: 32 }}>{children}</h2>;
}

export function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="wrap" style={{ paddingBottom: 24 }}>
      <div style={{ maxWidth: 760 }}>
        <h2>Common questions</h2>
        {items.map((f) => (
          <details key={f.q} className="card" style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              {f.q}
            </summary>
            <p className="small" style={{ marginTop: 8, fontSize: 14 }}>
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function CtaBand() {
  return (
    <div className="wrap" style={{ paddingBottom: 48 }}>
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          background: "#1f1f1f",
          color: "#fff",
          borderColor: "#1f1f1f",
        }}
      >
        <div>
          <b>Ready to make your first handwritten PDF?</b>
          <div className="small" style={{ color: "#c9c4bb" }}>
            5 welcome credits · One credit per generated section
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn light" href="/library">
            Browse library
          </a>
          <a
            className="btn"
            style={{
              background: "#f0c06a",
              borderColor: "#f0c06a",
              color: "#1f1f1f",
            }}
            href="/dashboard"
          >
            Generate notes
          </a>
        </div>
      </div>
    </div>
  );
}

export function Updated({ date }: { date: string }) {
  return (
    <p className="small">
      Last updated: {date}. Syaahi is a study aid — always verify important
      facts from textbooks.
    </p>
  );
}
