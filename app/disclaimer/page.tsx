import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "AI can make mistakes",
    "Generated explanations, answers, diagrams, and summaries may omit context or contain errors. Verify important definitions, formulas, citations, and code against the original material and trusted references.",
  ],
  [
    "Sources are not a guarantee",
    "A retrieved source label means source material was fetched. It is not independent verification of every generated statement. Source-grounded chat is instructed to stay within the notes, but its answers still require judgement.",
  ],
  [
    "Extraction has limits",
    "Screenshots may contain unreadable text. PDF extraction may lose reading order. Captions and speech recognition may mishear words. Review the extracted source text before asking the app to build notes.",
  ],
  [
    "Practice is feedback",
    "Quizzes, flashcards, and interview coaching support revision. They do not measure intelligence, guarantee examination coverage, or predict a hiring decision. Use them to identify topics to revisit.",
  ],
  [
    "Professional decisions",
    "The application is not a medical, legal, financial, or safety-critical advisory service. Seek a qualified professional for decisions that require one. Availability and output speed depend on configured infrastructure and provider capacity.",
  ],
];
export default function Policy() {
  return (
    <>
      <PageHero
        kicker="Trust & transparency"
        title="Accuracy & limitations"
        lede="Know what the study assistant can\u2014and cannot\u2014establish."
      />
      <Prose>
        <p className="small">
          Updated 21 September 2026 · Current installation
        </p>
        {sections.map(([title, body], i) => (
          <section key={title}>
            <H>
              {i + 1}. {title}
            </H>
            <p>{body}</p>
          </section>
        ))}
        <p>
          Questions? <a href="/support">Contact the operator</a>.
        </p>
      </Prose>
    </>
  );
}
