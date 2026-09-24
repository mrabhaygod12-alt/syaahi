import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "A shared layout",
    "The preview and export use the same HTML document, embedded handwriting fonts, and pagination logic. Text remains selectable in the PDF.",
  ],
  [
    "Content comes first",
    "The renderer respects code indentation, formats supported equations, wraps table cells, and flows long material onto continuation sheets. It does not stretch a screenshot to fill A4.",
  ],
  [
    "Style controls",
    "Choose the note template in the lesson toolbar. Handwriting font and paper controls are available in Notes. Hindi text uses Kalam for Devanagari coverage.",
  ],
  [
    "Print settings",
    "Use A4 paper and actual size or 100% scale in your PDF viewer. Printer margins and colour reproduction depend on your printer. Extra continuation sheets are included in the export at no additional credit cost.",
  ],
];
export default function Guide() {
  return (
    <>
      <PageHero
        kicker="Syaahi documentation"
        title="Readable notes, dependable PDFs"
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
