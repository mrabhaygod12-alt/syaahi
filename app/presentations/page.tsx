import PresentationStudio from "@/components/PresentationStudio";
import { Faq } from "@/components/site";
import { pageMeta, jsonLd, faqSchema } from "@/lib/seo";
export const metadata = pageMeta({
  title: "AI Presentations: Editable PowerPoint from Your Brief",
  description:
    "Create classroom, learning or professional presentations from your brief and references. Edit slides and download PPTX with native text, charts and speaker notes.",
  path: "/presentations",
});
const answers = [
  {
    q: "Are Syaahi presentations editable?",
    a: "Yes. Exported PPTX uses native text, tables and charts with speaker notes, without a watermark.",
  },
  {
    q: "How much does a presentation cost?",
    a: "A completed deck costs five credits. The slide limit depends on your plan. Failed jobs return the charge.",
  },
];
export default function Page() {
  return (
    <div className="container">
      <p className="eyebrow">From brief to slides</p>
      <h1>Explain your topic. Build a presentation you can edit.</h1>
      <p>
        Choose your audience, language and template. Review every slide before
        downloading a PowerPoint file. Your presentations stay private.
      </p>
      <PresentationStudio />
      <section className="card">
        <h2>How it works</h2>
        <ol>
          <li>
            Describe your topic and audience; paste relevant references or data.
          </li>
          <li>Choose a slide count and visual template.</li>
          <li>
            Watch saved progress, reopen the deck, and edit its copy or sources.
          </li>
          <li>
            Download editable PPTX with speaker notes, without a watermark.
          </li>
        </ol>
        <h2>Can I use my own data?</h2>
        <p>
          Yes. Paste source material and numeric data into the reference field.
          The model is instructed to use supplied numbers for charts and avoid
          invented citations. Check its output before sharing.
        </p>
        <h2>What if generation stops?</h2>
        <p>
          Completed slides remain saved. A failed job returns its five-credit
          charge; a retry reserves five credits and continues from the next
          slide.
        </p>
      </section>
      <Faq items={answers} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(faqSchema(answers)),
        }}
      />
    </div>
  );
}
