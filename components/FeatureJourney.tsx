const stages = [
  [
    "01",
    "Capture",
    "Start with a topic, document, image, recording or supported lecture.",
  ],
  [
    "02",
    "Shape",
    "Review the outline, sources and learning goal before a lesson is created.",
  ],
  [
    "03",
    "Recall",
    "Use explanations, quizzes and flashcards to find what needs another pass.",
  ],
  [
    "04",
    "Keep",
    "Return to the lesson, export notes, or share access when you choose.",
  ],
] as const;

export default function FeatureJourney() {
  return (
    <section
      className="wrap feature-journey"
      aria-labelledby="study-journey-title"
    >
      <div className="feature-journey-intro" data-journey-heading>
        <p className="eyebrow">ONE CONNECTED STUDY LOOP</p>
        <h2 id="study-journey-title">
          Every tool knows where your learning started.
        </h2>
        <p>
          Syaahi keeps the source, generated lesson and practice tools
          connected, so you can move from a difficult idea to a useful review
          session without losing context.
        </p>
      </div>
      <div className="feature-journey-grid">
        {stages.map(([number, title, copy]) => (
          <article data-journey-card key={title}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <a className="journey-link" href="/how-it-works">
        See the full study workflow <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
