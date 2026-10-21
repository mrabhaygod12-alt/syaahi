import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How AI Ink works",
  description:
    "What AI Ink measures, how source matching works, and the limits of both.",
  robots: { index: false, follow: false },
};

const MATCHING = [
  {
    step: "Fingerprint",
    body: "Your text is split into overlapping runs of eight words. Each run is a fingerprint — long enough that finding it elsewhere is meaningful, short enough to survive a changed comma.",
  },
  {
    step: "Search",
    body: "The most distinctive sentences become search queries. Results come back as full page text where the provider allows it, so the comparison is against the source itself rather than a summary of it.",
  },
  {
    step: "Cluster",
    body: "Where a run is found in a source, neighbouring runs are joined. Only a contiguous stretch of twelve or more words in the same order is reported. Shared vocabulary and shared subject matter are never enough.",
  },
  {
    step: "Report",
    body: "Each confirmed passage is listed with the source, the word count and its share of your document. You can read the source passage beside your own.",
  },
];

const STYLE = [
  {
    step: "Sentence rhythm",
    body: "The spread of sentence lengths, measured as the standard deviation of words per sentence. Uniform rhythm can be worth reviewing, regardless of who wrote it.",
  },
  {
    step: "Stock phrasing",
    body: "Density of phrases that carry no information — “plays a crucial role”, “in today’s world”, “it is important to note”. Counted per hundred words.",
  },
  {
    step: "Word range",
    body: "How many words are used only once. An unusually high rate often means simple words were swapped for longer synonyms.",
  },
  {
    step: "Paragraph shape",
    body: "Whether paragraphs expand and contract with their ideas, or all run to the same length.",
  },
  {
    step: "Flat emphasis",
    body: "Generic intensifiers — “highly significant”, “truly remarkable” — that replace evidence with volume.",
  },
  {
    step: "Long-word share",
    body: "The proportion of words eight letters or longer, as a check against vocabulary inflation.",
  },
];

const LIMITS = [
  "Web matching only covers what the search provider returns. Paywalled journals, closed databases and printed books are outside its reach, so a clean report is not proof of originality.",
  "Style measurements describe writing, not authorship. A careful human writer can score high; a lightly edited machine draft can score low. The numbers point you at passages to look at — they do not decide anything.",
  "The citation audit recognises common citation formats. Unusual styles may be missed, and a sentence can legitimately need no citation.",
  "Your institution may use a different system with a different corpus. Use the findings to review attribution and follow your institution’s academic integrity rules.",
];

export default function HowItWorks() {
  return (
    <main className="ink-page">
      <div className="ink-lead">
        <p className="ink-kicker">Method</p>
        <h1>What this actually measures.</h1>
        <p>
          Most integrity tools give you a number and no way to argue with it. AI
          Ink is built the other way round: every finding names the passage,
          shows the evidence, and explains the measurement in a sentence you can
          check yourself.
        </p>
      </div>

      <section style={{ marginBottom: 56 }}>
        <h2 className="ink-h2">Matching against sources</h2>
        <div className="ink-grid-2">
          {MATCHING.map((item, i) => (
            <div
              key={item.step}
              style={{
                borderTop: "1px solid var(--ink-rule)",
                paddingTop: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <span className="ink-card-n ink-figure">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--ink-serif)",
                    fontSize: 18,
                    fontWeight: 500,
                  }}
                >
                  {item.step}
                </h3>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 1.62,
                  color: "var(--ink-2)",
                }}
              >
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 56 }}>
        <h2 className="ink-h2">Writing style</h2>
        <p className="ink-note" style={{ marginBottom: 22, maxWidth: "62ch" }}>
          Six measurements, weighted into a single footprint from 0 to 100.
          Higher means more of the property being measured. Nothing here tries
          to guess whether a machine wrote your text.
        </p>
        <table className="ink-table">
          <thead>
            <tr>
              <th style={{ width: 190 }}>Measurement</th>
              <th>What it is</th>
            </tr>
          </thead>
          <tbody>
            {STYLE.map((item) => (
              <tr key={item.step}>
                <td style={{ fontWeight: 500 }}>{item.step}</td>
                <td style={{ color: "var(--ink-2)" }}>{item.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 56 }}>
        <h2 className="ink-h2">Where this stops</h2>
        <ul
          style={{
            margin: 0,
            paddingLeft: 0,
            listStyle: "none",
            maxWidth: "68ch",
          }}
        >
          {LIMITS.map((limit, i) => (
            <li
              key={limit}
              style={{
                display: "flex",
                gap: 14,
                padding: "14px 0",
                borderTop: i ? "1px solid var(--ink-rule-soft)" : 0,
                fontSize: 13.5,
                lineHeight: 1.65,
                color: "var(--ink-2)",
              }}
            >
              <span
                className="ink-card-n ink-figure"
                style={{ paddingTop: 2, minWidth: 20 }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{limit}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="ink-banner" data-tone="warn">
        AI Ink is a study tool, not a certification. Use it to find the passages
        worth rewriting and the claims worth sourcing — then do that work
        yourself.
      </div>

      <div style={{ marginTop: 24 }}>
        <Link
          href="/ink"
          className="ink-btn"
          style={{ display: "inline-block", textDecoration: "none" }}
        >
          Check a draft
        </Link>
      </div>
    </main>
  );
}
