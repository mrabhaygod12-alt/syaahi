import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Page target versus printed sheets",
    "The target sets the desired outline size. The planner may recommend fewer sections when the material is narrow. One section consumes one credit. Printable sheet count depends on length, font, and layout; long material continues instead of shrinking.",
  ],
  [
    "Sources and evidence",
    "For topics without supplied material, Find sources retrieves Wikipedia references when available. A retrieved label means source text was fetched, not that every claim has been independently verified. No source found is labelled general knowledge.",
  ],
  [
    "Edit the outline",
    "Each line is a note section. Remove duplication, use specific topics, and check that your syllabus is represented. You can plan up to 24 sections per lesson.",
  ],
  [
    "Generation and recovery",
    "The server reserves credits before a job starts. Sections save as they finish. If a provider fails, unfinished reservations are returned. Resume reserves credits only for missing sections. Do not repeatedly submit the same outline.",
  ],
  [
    "Accuracy checks",
    "Compare definitions, dates, code, formulas, and source interpretations with your material. AI can omit context or make errors even when a source is supplied.",
  ],
];
export default function Guide() {
  return (
    <>
      <PageHero
        kicker="Syaahi documentation"
        title="Plan notes with intention"
        lede="Practical guidance for the current application."
      />
      <Prose>
        <a href="/docs">← All guides</a>
        {sections.map(([title, body]) => (
          <section key={title}>
            <H>{title}</H>
            <p>{body}</p>
          </section>
        ))}
        <p className="small">Updated 22 September 2026</p>
      </Prose>
    </>
  );
}
