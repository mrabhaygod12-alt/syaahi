import StudyDemo from "@/components/StudyDemo";
import LandingReveal from "@/components/LandingReveal";
import FeatureJourney from "@/components/FeatureJourney";
import { CtaBand, Faq } from "@/components/site";
import { pageMeta, jsonLd, SITE } from "@/lib/seo";
export const metadata = pageMeta({
  title: "AI Study Notes, Handwritten PDFs & Flashcards",
  path: "/",
  description:
    "Syaahi at syaahii.in turns topics, PDFs and supported lectures into handwritten-style notes, quizzes and flashcards. Preview the study workflow and create your own notes.",
});
export default function Home() {
  return (
    <>
      <LandingReveal />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "@id": `${SITE.url}/#application`,
            name: "Syaahi",
            alternateName: "Syaahii",
            url: `${SITE.url}/`,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web browser",
            description: SITE.description,
            publisher: { "@id": `${SITE.url}/#organization` },
            featureList: [
              "Handwritten-style study notes",
              "PDF export",
              "Lesson quizzes",
              "Flashcards",
              "AI lesson tutor",
            ],
          }),
        }}
      />
      <section className="public-hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">SYAAHI · YOUR AI STUDY WORKSPACE</p>
            <h1>
              Make room for
              <br />
              <em>understanding.</em>
            </h1>
            <p>
              Syaahi turns your topics, PDFs and supported lectures into
              handwritten-style notes, quizzes and flashcards. Learn one idea at
              a time, and practise what matters.
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
              19 welcome credits after email verification · Review your plan
              before generation
            </p>
          </div>
          <div
            className="hero-learning-visual"
            aria-label="Illustrative study workflow"
          >
            <div className="floating-source">▤ Your lecture</div>
            <div className="hero-paper">
              <span className="eyebrow">A NOTE WORTH KEEPING</span>
              <p className="hero-paper-title" aria-hidden="true">
                Understand.
                <br />
                Recall.
                <br />
                Apply.
              </p>
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
      <FeatureJourney />
      <section className="wrap trust-note" aria-labelledby="about-syaahi">
        <h2 id="about-syaahi">What is Syaahi?</h2>
        <p>
          Syaahi is an AI study workspace at <strong>syaahii.in</strong>. Bring
          your course material, review an editable outline and create
          notebook-style notes. Export a PDF, ask questions about a lesson, or
          practise with quizzes and flashcards. Notes are private by default; AI
          explanations should be checked against your original sources.
        </p>
        <p>
          <a href="/how-it-works">See the complete workflow</a>
          {" · "}
          <a href="/examples">Read a sample note</a>
          {" · "}
          <a href="/pricing">Compare credit packs</a>
        </p>
      </section>
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
      <section
        className="wrap all-tools-section"
        aria-labelledby="all-tools-title"
      >
        <div className="all-tools-heading">
          <div>
            <p className="eyebrow">EXPLORE THE FULL WORKSPACE</p>
            <h2 id="all-tools-title">More than a note generator.</h2>
          </div>
          <p>
            Each feature has a clear purpose: help you understand material,
            practise it, and return to it with the original context intact.
          </p>
        </div>
        <div className="all-tools-grid">
          {[
            [
              "✦",
              "Syaahi AI tutor",
              "Ask a lesson-specific question, request a simpler explanation, or work through an example.",
              "/features",
            ],
            [
              "▤",
              "Source transparency",
              "Review the original material and labels that distinguish supplied text from researched context.",
              "/docs/getting-started",
            ],
            [
              "↻",
              "Adaptive recall",
              "Use quizzes and flashcards to identify weak concepts and plan another review.",
              "/how-it-works",
            ],
            [
              "⇩",
              "Notebook-style PDFs",
              "Choose a note template, keep long content readable, and export a printable A4 PDF.",
              "/examples",
            ],
            [
              "◌",
              "Study languages",
              "Choose English, Hindi, Hinglish, German, French, or Spanish when you create notes.",
              "/dashboard",
            ],
            [
              "▦",
              "Course-pack starters",
              "Begin from a private university-course outline, then verify it against your current syllabus before generating notes.",
              "/course-packs",
            ],
            [
              "↗",
              "Interview practice",
              "Reopen a mock interview, respond to follow-ups, and download a preparation report.",
              "/interview",
            ],
            [
              "◎",
              "Private collaboration",
              "Keep lessons private by default and decide when classmates can view or edit them.",
              "/docs",
            ],
            [
              "✎",
              "Reviewed study guides",
              "Write privately, submit for editorial review, and discover community guides after approval.",
              "/community",
            ],
          ].map(([icon, title, copy, href]) => (
            <a className="all-tools-card" href={href} key={title}>
              <span aria-hidden="true">{icon}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <b>
                Explore <i aria-hidden="true">→</i>
              </b>
            </a>
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
      <section className="wrap feature-section">
        <p className="eyebrow">LEARN WITH PEOPLE, NOT JUST PROMPTS</p>
        <h2>Practice your explanation. Share what you learn.</h2>
        <div className="retention-grid">
          <article className="retention-card">
            <span className="feature-number">↗</span>
            <h3>Role-aware interview practice</h3>
            <p>
              Add an optional target role and job requirements, then receive
              structured AI coaching on your answer. It remains practice, not a
              hiring decision.
            </p>
            <a href="/interview">Start a mock interview →</a>
          </article>
          <article className="retention-card">
            <span className="feature-number">✎</span>
            <h3>Write a guide students can use</h3>
            <p>
              Create a private draft, submit it to the editorial queue, and
              publish only after review. This keeps community guides useful and
              trustworthy.
            </p>
            <a href="/write">Open Writer Studio →</a>
          </article>
          <article className="retention-card">
            <span className="feature-number">◎</span>
            <h3>Discover reviewed guides</h3>
            <p>
              Read study guides that have passed editorial review, alongside
              your own private lesson workspace.
            </p>
            <a href="/community">Browse the community →</a>
          </article>
        </div>
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
            a: "New accounts receive 19 credits after email verification. One token equals 3 credits. Each generated note section uses one credit; extra PDF continuation sheets do not cost additional credits. Review your outline before starting.",
          },
          {
            q: "Does completing a lesson prove mastery?",
            a: "Completion records your progress. Repeated recall and independent practice are better evidence that you understand the topic.",
          },
          {
            q: "Are my materials private?",
            a: "Lessons are private by default unless shared. Configured AI services process supplied material. Read our privacy policy for the details.",
          },
          {
            q: "Can I choose the language for my notes?",
            a: "Yes. Choose a language while creating a lesson: English, Hindi, Hinglish, German, French, or Spanish. Your selected study language is saved as a preference for your next lesson.",
          },
          {
            q: "Can I return after closing my browser?",
            a: "After you sign in, your lessons and account are stored in your workspace. Keep your browser session active and use the same account to reopen saved lessons on another device.",
          },
          {
            q: "What happens if note generation is interrupted?",
            a: "The workspace shows the generation status and lets you resume or retry a partially completed lesson. You can continue from the failed section instead of starting the whole lesson again.",
          },
          {
            q: "Can I share or publish my work?",
            a: "Lessons stay private unless you share them. Study guides begin as private drafts; guides become public only after they are submitted and pass editorial review.",
          },
          {
            q: "Does Syaahi replace a teacher or original source?",
            a: "No. It helps organise and practise material. Check important claims against your syllabus, teacher, and original sources before relying on them.",
          },
        ]}
      />
      <CtaBand />
    </>
  );
}
