import { PageHero, CtaBand } from "@/components/site";
const features = [
  [
    "Flexible input",
    "Start from a topic, PDF, screenshot, audio file, or captioned YouTube video. Review extracted text first.",
  ],
  [
    "An editable study plan",
    "Set a page target, language, and depth. Adjust section titles and see the credit cost before generating.",
  ],
  [
    "Visible evidence",
    "See whether material was supplied, references were retrieved, or a plan relies on general knowledge.",
  ],
  [
    "A connected lesson",
    "Keep notes, source text, quizzes, flashcards, and questions in one workspace.",
  ],
  [
    "Notes you can improve",
    "Edit a section in Markdown, change its presentation, and export a selectable-text PDF.",
  ],
  [
    "Interview coaching",
    "Practise timed questions across three tracks and receive specific AI feedback on your answer.",
  ],
];
export default function Features() {
  return (
    <>
      <PageHero
        kicker="Built for understanding"
        title="A complete loop from source to self-test."
        lede="Practical tools that keep your material and your learning together."
      />
      <section className="wrap feature-section">
        <div className="feature-grid">
          {features.map(([t, p]) => (
            <article key={t}>
              <h2 style={{ fontSize: 25 }}>{t}</h2>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
