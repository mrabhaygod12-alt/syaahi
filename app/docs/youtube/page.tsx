import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Add the lecture URL",
    "Paste a youtube.com or youtu.be video link into the dashboard composer. The app attempts to retrieve available captions and passes the transcript into planning.",
  ],
  [
    "When captions are unavailable",
    "Private, age-restricted, live, or captionless videos may not work. The app does not bypass access controls. Upload an audio file you have permission to use, or paste your own transcript instead.",
  ],
  [
    "Review the transcript",
    "Captions can mishear technical terms and names. Review extracted text before generating, and compare important timestamps against the original lecture.",
  ],
  [
    "What the app understands",
    "Caption intake supplies spoken text, not every diagram or on-screen slide. Add a screenshot when visual content is essential. This version supports one attached material item at a time.",
  ],
];
export default function Guide() {
  return (
    <>
      <PageHero
        kicker="Syaahi documentation"
        title="Learn from a captioned lecture"
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
