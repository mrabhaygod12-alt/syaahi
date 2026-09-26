import StudyDemo from "@/components/StudyDemo";
import LandingReveal from "@/components/LandingReveal";
import { CtaBand, Faq } from "@/components/site";
export default function Home() {
  return (
    <>
      <LandingReveal />
      <section className="public-hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">YOUR MATERIAL. YOUR WAY OF LEARNING.</p>
            <h1>
              Make room for
              <br />
              <em>understanding.</em>
            </h1>
            <p>
              Bring a topic, lecture or document. Build notebook-style notes,
              learn one idea at a time, and practise what matters.
            </p>
            <div className="hero-actions">
              <a className="btn dark" href="/dashboard">
                Create a study workspace →
              </a>
              <a className="btn light" href="#try-demo">
                Try a sample
              </a>
            </div>
            <p className="small">
              21 welcome credits · Review your plan before generation
            </p>
          </div>
          <div
            className="hero-learning-visual"
            aria-label="Illustrative study workflow"
          >
            <div className="floating-source">▤ Your lecture</div>
            <div className="hero-paper">
              <span className="eyebrow">A NOTE WORTH KEEPING</span>
              <h3>
                Understand.
                <br />
                Recall.
                <br />
                Apply.
              </h3>
              <div className="paper-lines">
                <i />
                <i />
                <i />
              </div>
              <p>One concept at a time.</p>
            </div>
            <div className="floating-check">✓ Check your understanding</div>
          </div>
        </div>
      </section>
      <StudyDemo />
      <section className="wrap feature-section">
        <p className="eyebrow">FROM SOURCE TO STUDY SESSION</p>
        <h2>A clear path through your material.</h2>
        <div className="retention-grid">
          {[
            [
              "01",
              "Bring your source",
              "Upload a document, screenshot or audio recording. Public YouTube videos are checked for study suitability; unavailable captions can use a labelled video digest when supported.",
            ],
            [
              "02",
              "Review before creating",
              "Check the extracted material, adjust your learning goal and edit the suggested outline. See the credit cost before starting.",
            ],
            [
              "03",
              "Learn, then return",
              "Move through explanations and worked examples. Check your understanding, save progress and revisit flashcards when they are due.",
            ],
          ].map(([n, t, p]) => (
            <article key={n} className="retention-card">
              <span className="feature-number">{n}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="wrap feature-section">
        <p className="eyebrow">YOUR COMPLETE STUDY DESK</p>
        <h2>Tools with a place in your routine.</h2>
        <div className="product-bento">
          <article className="pillar-card bento-wide">
            <div>
              <p className="eyebrow">NOTES YOU CAN KEEP</p>
              <h3>A notebook, ready to print.</h3>
              <p>
                Blue handwriting, clear headings and useful flowcharts. Choose a
                template and export an A4 PDF, with long sections continuing
                onto additional sheets.
              </p>
              <a href="/examples">Explore note examples →</a>
            </div>
            <div className="mini-note" aria-hidden="true">
              <h4>Algorithms</h4>
              <p>A finite sequence of steps.</p>
              <span>Input → Process → Output</span>
              <p>Clear. Ordered. Useful.</p>
            </div>
          </article>
          {[
            [
              "↗",
              "A tutor beside your lesson",
              "Ask for a simpler explanation, a worked example or a hint without leaving the current section.",
              "/features",
            ],
            [
              "↻",
              "A reason to come back",
              "Review due flashcards and revisit concepts you find difficult. Your review schedule follows your responses.",
              "/how-it-works",
            ],
            [
              "♫",
              "Take the explanation with you",
              "Generate spoken study audio from your notes. Audio availability depends on the configured service.",
              "/features",
            ],
            [
              "▤",
              "Study together",
              "Invite a classmate to a lesson, discuss ideas and control their viewing or editing access.",
              "/docs",
            ],
          ].map(([icon, title, copy, href]) => (
            <article className="pillar-card" key={title}>
              <span className="bento-symbol" aria-hidden="true">
                {icon}
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <a href={href}>See how it works →</a>
            </article>
          ))}
        </div>
      </section>
      <section className="wrap trust-note">
        <h2>Useful AI starts with honest limits.</h2>
        <p>
          Generated material can contain mistakes. Check important facts against
          your source, syllabus or teacher. Syaahi labels source material and
          keeps your original notes available for review.
        </p>
        <a href="/about">Meet the people building Syaahi →</a>
      </section>
      <Faq
        items={[
          {
            q: "What can I study from?",
            a: "Start with a topic, document, screenshot, audio recording or supported public YouTube video. Review extracted material before generation.",
          },
          {
            q: "What if a YouTube video has no captions?",
            a: "When supported, Syaahi can request an AI-extracted video digest. This is labelled separately from a transcript. If the video cannot be read reliably, upload an audio recording or transcript you can use.",
          },
          {
            q: "How are credits used?",
            a: "New accounts receive 21 credits. One token equals 3 credits. Each generated note section uses one credit; extra PDF continuation sheets do not cost additional credits. Review your outline before starting.",
          },
          {
            q: "Does completing a lesson prove mastery?",
            a: "Completion records your progress. Repeated recall and independent practice are better evidence that you understand the topic.",
          },
          {
            q: "Are my materials private?",
            a: "Lessons are private by default unless shared. Configured AI services process supplied material. Read our privacy policy for the details.",
          },
        ]}
      />
      <CtaBand />
    </>
  );
}
