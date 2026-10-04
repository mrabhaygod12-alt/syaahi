import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Getting Started with Syaahi",
  description:
    "Create an account, verify your email and choose a learning or writing workspace. Generate notes and presentations, or draft and submit an article.",
  path: "/docs/getting-started",
});
import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Start with an account",
    "Create an account with an email address and a password of at least 10 characters. New accounts receive 19 welcome credits after email verification. Lessons, presentations and drafts are private to your account by default.",
  ],
  [
    "Choose your starting workspace",
    "Select Learn & create for notes, presentations and recall practice, or Write & publish for articles, drafts and editorial feedback. This saves your starting dashboard; the same account can switch between both.",
  ],
  [
    "Write an article",
    "Open Writer Studio from the writing dashboard. Add a title, headings, text, links and images you own. Preview and save the draft before submitting for editorial review. Approved articles receive a public URL and creator attribution.",
  ],
  [
    "Create a presentation",
    "Open AI presentations and describe your topic, audience and relevant source material. Choose a language, template and slide count. A completed deck costs five credits. Review and edit the saved slides before exporting PPTX.",
  ],
  [
    "Bring a question or material",
    "Open the dashboard and enter a topic. Add a PDF, screenshot, or audio file using Add material, or paste a YouTube URL. Review the extracted text, particularly OCR from screenshots.",
  ],
  [
    "Review before generating",
    "Choose the target number of note sections, language, and depth. Open the outline, check its evidence label, and edit one section per line. The displayed credit count updates with your outline.",
  ],
  [
    "Use your lesson",
    "Open Notes for the PDF preview. Use Source to inspect material, Quiz and Flashcards for retrieval practice, and the chat panel for questions grounded in the notes.",
  ],
  [
    "Export and return",
    "Download your PDF from Notes. A long section can span multiple A4 sheets without additional credits. Your saved lesson remains in the dashboard.",
  ],
];
export default function Guide() {
  return (
    <>
      <PageHero
        kicker="Syaahi documentation"
        title="Start learning, creating or writing"
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
        <p className="small">Updated 4 October 2026</p>
      </Prose>
    </>
  );
}
