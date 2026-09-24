import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Start with an account",
    "Create an account with an email address and a password of at least 10 characters. New accounts receive 5 welcome note sections. Your lessons are private to your signed-in account.",
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
        title="Your first study workspace"
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
        <p className="small">Updated 22 September 2026</p>
      </Prose>
    </>
  );
}
