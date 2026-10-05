import { pageMeta } from "@/lib/seo";
import { CtaBand, PageHero } from "@/components/site";

export const metadata = pageMeta({
  title: "Learning & Writing Tools: Notes, Presentations and Articles",
  description:
    "Explore Syaahi tools for students, teachers, professionals and writers: notes, editable AI presentations, recall practice, rich drafting and reviewed publication.",
  path: "/features",
});

const features = [
  [
    "01",
    "Flexible input",
    "Start from a topic, PDF, screenshot, audio file, or supported public YouTube video. Review extracted text before it is used.",
    "/dashboard",
  ],
  [
    "02",
    "An editable study plan",
    "Choose note language, target length and depth. Edit the outline and see the credit cost before generation starts.",
    "/dashboard",
  ],
  [
    "03",
    "Source transparency",
    "See whether material came from your upload, retrieved references, or general context. Keep the source alongside the lesson.",
    "/docs/getting-started",
  ],
  [
    "04",
    "Notebook-style PDF",
    "Create readable notes with templates and continuation sheets, then download a printable A4 PDF without squeezing long content.",
    "/examples",
  ],
  [
    "05",
    "Lesson-aware AI tutor",
    "Ask for a simpler explanation, a worked example, or a hint while keeping the current lesson and its sources in view.",
    "/features",
  ],
  [
    "06",
    "Quizzes and flashcards",
    "Turn a completed lesson into active recall. Use explanations, practice weak concepts, and return for another review.",
    "/how-it-works",
  ],
  [
    "07",
    "Durable generation",
    "See provider and progress status while notes are created. Resume or retry an interrupted lesson from the failed point.",
    "/docs/generating-notes",
  ],
  [
    "08",
    "Study languages",
    "Generate study material in English, Hindi, Hinglish, German, French, or Spanish from the creation controls.",
    "/dashboard",
  ],
  [
    "09",
    "Private sharing",
    "Lessons stay private by default. Share access deliberately with a classmate and control the access you grant.",
    "/docs",
  ],
  [
    "10",
    "Mock interview practice",
    "Use role templates, follow-up questions, answer feedback, saved sessions, and downloadable preparation reports.",
    "/interview",
  ],
  [
    "11",
    "Writer Studio",
    "Write articles and guides with headings, links and uploaded images. Save private drafts, keep revisions and submit for editorial review.",
    "/writing",
  ],
  [
    "12",
    "Reviewed community articles",
    "Discover public articles and guides after review, with creator attribution, bookmarking and content reports.",
    "/community",
  ],
  [
    "13",
    "Editable AI presentations",
    "Describe a classroom, learning or professional topic. Supply references, edit the slides and export native PowerPoint text, charts and speaker notes.",
    "/presentations",
  ],
  [
    "14",
    "Two workspaces in one account",
    "Choose Learn & create or Write & publish as your starting dashboard and switch between them with the same account.",
    "/writing",
  ],
] as const;

export default function Features() {
  return (
    <>
      <PageHero
        kicker="Learning and writing on Syaahi"
        title="From understanding an idea to explaining it."
        lede="Create notes and presentations, practise a topic, or develop an article for readers. Students, teachers, professionals and writers can use both workspaces with one account."
      />
      <section
        className="wrap feature-directory"
        aria-labelledby="feature-directory-title"
      >
        <div className="feature-directory-intro">
          <div>
            <p className="eyebrow">EXPLORE ALL FEATURES</p>
            <h2 id="feature-directory-title">
              From first source to final review.
            </h2>
          </div>
          <p>
            Use only the parts that help your routine. Generated material should
            be checked against your original source, syllabus, or teacher.
          </p>
        </div>
        <div className="feature-directory-grid">
          {features.map(([number, title, copy, href]) => (
            <a className="feature-directory-card" href={href} key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <b>
                Open feature <i aria-hidden="true">→</i>
              </b>
            </a>
          ))}
        </div>
      </section>
      <section className="wrap feature-safety-note">
        <div className="product-link-row">
          <a href="/writing/features">Writer and publishing tools</a>
          <a href="/ai-presentations">Presentation design engine</a>
          <a href="/syaahi">What is Syaahi?</a>
        </div>
        <p className="eyebrow">A STUDY AID, NOT A SHORTCUT</p>
        <h2>Keep the evidence close.</h2>
        <p>
          Syaahi helps you organise and practise material. It does not replace
          independent judgement. Check important information, especially for
          exams, applications and professional decisions.
        </p>
        <a href="/privacy">Read how your study material is handled →</a>
      </section>
      <CtaBand />
    </>
  );
}
