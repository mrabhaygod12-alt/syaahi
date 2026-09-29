import { pageMeta } from "@/lib/seo";
import { CtaBand, PageHero } from "@/components/site";

export const metadata = pageMeta({
  title: "Study Tools: Notes, Quizzes, Flashcards & AI Practice",
  description:
    "Explore Syaahi handwritten-style study notes, source-aware lessons, quizzes, flashcards, lesson chat, mock interview practice, private sharing and reviewed study guides.",
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
    "Draft a study guide privately, keep version history, and submit it for editorial review when it is ready.",
    "/write",
  ],
  [
    "12",
    "Reviewed community guides",
    "Discover public guides only after review, with a clear route back to the creator and the original guide.",
    "/community",
  ],
] as const;

export default function Features() {
  return (
    <>
      <PageHero
        kicker="A connected learning workspace"
        title="Tools that follow the way you actually study."
        lede="Bring in material, shape it into a lesson, practise recall, and return when you need it. Every tool has a clear place in the study loop."
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
