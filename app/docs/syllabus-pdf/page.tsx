import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Text-based PDFs",
    "Upload a PDF up to 10 MB. Text is extracted locally on the server. The planner uses up to 100,000 characters of extracted context, selecting relevant excerpts for individual note sections.",
  ],
  [
    "Scanned documents",
    "Image-only PDFs cannot be read by the text parser. Upload a relevant page as a PNG, JPEG, or WebP screenshot up to 8 MB. Screenshot text extraction uses the configured Gemini vision model.",
  ],
  [
    "Check extraction",
    "The source review lets you correct missed words or reading order. OCR marks uncertainty where possible, but you should check equations and tables yourself.",
  ],
  [
    "Audio",
    "Audio uploads use the configured speech transcription provider. Recording quality, language, and background noise affect the result. Review the returned transcript before generating.",
  ],
  [
    "Your privacy",
    "Relevant source text is sent to configured AI providers to create notes. Screenshots and audio are sent to the provider that performs extraction. Avoid uploading personal, confidential, or restricted information.",
  ],
];
export default function Guide() {
  return (
    <>
      <PageHero
        kicker="Syaahi documentation"
        title="Bring documents and screenshots"
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
