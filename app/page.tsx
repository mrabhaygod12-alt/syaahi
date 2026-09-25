import LandingReveal from "@/components/LandingReveal";
import { CtaBand, Faq } from "@/components/site";
export default function Home() {
  return (
    <>
      <LandingReveal />
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
              21 welcome credits (7 tokens) · Automatic page planning · Keep
              your PDFs
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

      {/* Curriculum & Board Coverage Strip */}
      <section
        className="curriculum-strip"
        aria-label="Curriculum and exam coverage"
      >
        <div className="wrap curriculum-wrap">
          <span className="curriculum-label">Exam Ready For:</span>
          <div className="curriculum-tags">
            <span className="curriculum-tag">
              <em>🏫</em> CBSE Class 10 & 12
            </span>
            <span className="curriculum-tag">
              <em>🎯</em> JEE Main & Advanced
            </span>
            <span className="curriculum-tag">
              <em>🩺</em> NEET Medical
            </span>
            <span className="curriculum-tag">
              <em>🏛️</em> UPSC Civil Services
            </span>
            <span className="curriculum-tag">
              <em>🎓</em> University Semesters
            </span>
            <span className="curriculum-tag">
              <em>💻</em> B.Tech / BCA / CS
            </span>
            <span className="curriculum-tag">
              <em>💼</em> CA / Commerce
            </span>
          </div>
        </div>
      </section>

      {/* 4-in-1 Study Ecosystem */}
      <section className="wrap feature-section" style={{ paddingTop: 48 }}>
        <span className="eyebrow">YOUR COMPLETE STUDY DESK</span>
        <h2>Four ways to master any concept.</h2>
        <p style={{ color: "#6e675f", maxWidth: 640 }}>
          Move between reading, practice, recall, and listening in one connected
          lesson workspace.
        </p>
        <div className="pillars-grid">
          <div className="pillar-card">
            <span className="pillar-icon">📄</span>
            <h3>Handwritten A4 Notes</h3>
            <p>
              Classic blue ink on ruled paper with red margins, golden highlight
              headers, formula boxes, and key takeaway anchors. Downloadable as
              high-res printable PDFs.
            </p>
            <span className="pillar-tag">Printable PDF</span>
          </div>
          <div className="pillar-card">
            <span className="pillar-icon">📝</span>
            <h3>Interactive Adaptive Quizzes</h3>
            <p>
              Test active recall with multiple-choice questions, hints, and
              step-by-step reasoning grounded strictly in your syllabus.
            </p>
            <span className="pillar-tag">Self-Testing</span>
          </div>
          <div className="pillar-card">
            <span className="pillar-icon">🗂️</span>
            <h3>Active Recall Flashcards</h3>
            <p>
              Flip cards for high-yield definitions, formulas, and historical
              facts. Review an entire chapter before walking into the exam room.
            </p>
            <span className="pillar-tag">Spaced Repetition</span>
          </div>
          <div className="pillar-card">
            <span className="pillar-icon">🎙️</span>
            <h3>Conversational Audio Podcast</h3>
            <p>
              Listen to a spoken explanation built from your lesson notes.
              Revisit the main ideas while commuting or taking a break.
            </p>
            <span className="pillar-tag">Audio Learning</span>
          </div>
        </div>
      </section>

      {/* Comparison: Syaahi vs Generic ChatGPT */}
      <section className="wrap comparison-section">
        <span className="eyebrow">WHY SYAAHI</span>
        <h2>Built for exam retention, not just text generation.</h2>
        <div className="retention-grid">
          {[
            [
              "01",
              "Understand the idea",
              "Follow short explanations and worked examples in your guided lesson. Ask questions when something is unclear.",
            ],
            [
              "02",
              "Retrieve it from memory",
              "Check your understanding with a checkpoint, then revisit ideas through quizzes and flashcards.",
            ],
            [
              "03",
              "Keep a useful reference",
              "Return to your source material and export notebook-style PDFs for revision. Check important facts against your course materials.",
            ],
          ].map(([n, title, copy]) => (
            <article className="retention-card" key={n}>
              <span className="feature-number">{n}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works workflow */}
      <section className="wrap feature-section">
        <span className="eyebrow">ONE CONNECTED STUDY LOOP</span>
        <h2>Good notes are just the beginning.</h2>
        <div className="feature-grid">
          {[
            [
              "01",
              "Bring what you have",
              "A topic, a textbook screenshot, a PDF syllabus, voice lecture audio, or a captioned YouTube video. Review extracted text before starting.",
            ],
            [
              "02",
              "Shape your understanding",
              "Review the suggested page count and edit your outline. See whether the plan uses your material, retrieved external sources, or general knowledge.",
            ],
            [
              "03",
              "Put it into practice",
              "Open your lesson workspace to read notes, ask questions in AI chat, solve quizzes, and listen to podcasts. Export clean PDFs anytime.",
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

      {/* Comprehensive FAQs */}
      <Faq
        items={[
          {
            q: "Can I convert YouTube lectures or handwritten class photos into notes?",
            a: "Yes! Paste any YouTube video link (with captions), upload photos of handwritten notes, lecture recordings, syllabus PDFs, or Word documents. Syaahi transcribes, analyzes, and organizes them automatically.",
          },
          {
            q: "Are the generated notes downloadable as high-quality printable PDFs?",
            a: "Absolutely. Every note is formatted on standard A4 dimensions with real ruled lines, margins, and crisp typography. You can print them on paper or import them into iPad note-taking apps like GoodNotes or Notability.",
          },
          {
            q: "How is Syaahi different from ChatGPT or NotebookLM?",
            a: "While generic AI tools output long walls of plain text, Syaahi produces a complete exam workspace: authentic handwritten-style notes with topper callouts, interactive quizzes, active recall flashcards, and dual-host audio podcasts.",
          },
          {
            q: "What are Welcome Credits & Tokens? Is Syaahi free to try?",
            a: "Every new user receives 21 welcome credits (equivalent to 7 full study tokens) immediately upon signup. You can create full lessons, practice quizzes, and download your PDFs without entering a credit card.",
          },
          {
            q: "Will my notes be cut off if a topic is very long?",
            a: "Never. Long content automatically continues onto extra A4 continuation sheets without consuming extra credits or tokens. Your token reserve covers the conceptual section; continuation pages are always free.",
          },
          {
            q: "How does the study podcast work?",
            a: "Syaahi generates a spoken study script from your lesson notes and synthesizes audio so you can revise while traveling or taking a break.",
          },
          {
            q: "Can I ask questions or chat with my notes?",
            a: "Yes! Every lesson has an integrated AI Study Chat grounded strictly in your generated notes. You can select any text to ask questions, request real-world examples, or get custom quiz questions.",
          },
          {
            q: "Are my uploaded notes, syllabi, and study data private?",
            a: "Your lessons are private by default unless you share them. Configured AI services process your material to produce study content; their data policies also apply. Read our privacy policy for details.",
          },
        ]}
      />
      <CtaBand />
    </>
  );
}
