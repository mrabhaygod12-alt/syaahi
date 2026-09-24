import { CtaBand, Faq } from "@/components/site";
export default function Home() {
  return (
    <>
      <section className="public-hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">LESS CLUTTER. MORE UNDERSTANDING.</span>
            <h1>
              From information
              <br />
              to <em>“I get it.”</em>
            </h1>
            <p>
              Turn your lectures, screenshots, and questions into thoughtful
              notes. Then practise until the ideas stick.
            </p>
            <div className="hero-actions">
              <a className="btn dark" href="/dashboard">
                Create your first lesson ↗
              </a>
              <a className="btn light" href="/how-it-works">
                See how it works
              </a>
            </div>
            <span className="small">
              21 welcome credits (7 tokens) · Choose your page target · Keep your PDFs
            </span>
          </div>
          <div className="note-showcase">
            <div className="note-label">A SMALL IDEA, CLEARLY EXPLAINED</div>
            <h3>Why does binary search work?</h3>
            <p>
              Start with a sorted list. Compare the middle item with your
              target.
            </p>
            <p>
              Too small? Keep the right half.
              <br />
              Too big? Keep the left half.
            </p>
            <p>
              <span className="note-insight">
                Each step cuts the problem in half.
              </span>
            </p>
            <p>1,024 items → at most 11 comparisons</p>
            <div className="note-label">
              ILLUSTRATIVE NOTE · COMPUTER SCIENCE
            </div>
          </div>
        </div>
      </section>
      <section className="wrap feature-section">
        <span className="eyebrow">ONE CONNECTED STUDY LOOP</span>
        <h2>Good notes are just the beginning.</h2>
        <div className="feature-grid">
          {[
            [
              "01",
              "Bring what you have",
              "A topic, a screenshot, a PDF, an audio file, or a captioned YouTube lecture. Review extracted text before using it.",
            ],
            [
              "02",
              "Shape your understanding",
              "Choose a page target and edit the outline. See whether the plan uses your material, retrieved sources, or general knowledge.",
            ],
            [
              "03",
              "Put it into practice",
              "Open your lesson to read notes, ask questions, practise quizzes, and review flashcards. Export a readable, selectable-text PDF.",
            ],
          ].map(([n, t, p]) => (
            <article key={n}>
              <span className="feature-number">{n}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <Faq
        items={[
          {
            q: "Do I need a video to get started?",
            a: "No. Enter a topic or upload your material. Topic research currently retrieves Wikipedia references when available; the outline labels when no external source was found.",
          },
          {
            q: "Will my notes be squeezed into a fixed page?",
            a: "No. Long content continues on another A4 sheet. Your target controls the outline size; final PDF sheet count depends on content and layout.",
          },
          {
            q: "How are credits used?",
            a: "One third of a token is reserved per planned section. Completed sections consume their reservation; failed or unfinished sections are refunded. Extra PDF continuation sheets do not cost extra.",
          },
        ]}
      />
      <CtaBand />
    </>
  );
}
