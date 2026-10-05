import ProductPage from "@/components/ProductPage";
import { pageMeta, presentationSchema } from "@/lib/seo";
import { PRESENTATION_FAQS } from "@/lib/product-facts";
export const metadata = pageMeta({
  title: "Source-based AI presentations with editable PowerPoint export",
  path: "/ai-presentations",
  description:
    "Create a source-based narrative, review the plan, preview and edit six slide layouts, then export editable PPTX, PDF or PNG with Syaahi Presentation Studio.",
});
const layouts = [
  ["Hero headline", "One decisive takeaway with breathing room."],
  ["Bento grid", "A primary idea and two supporting cards."],
  ["Metric trio", "Three source-supported numerical statistics."],
  ["Split comparison", "Two choices, approaches or perspectives."],
  ["Linear stepper", "A sequence of three or four phases."],
  ["Attributed quote", "A verbatim source quotation and attribution."],
];
export default function Page() {
  return (
    <ProductPage
      title="Build a story your audience can follow."
      kicker="SYAAHI AI PRESENTATION STUDIO"
      path="/ai-presentations"
      lede="Start with a brief and sources. Review a saved narrative before generation, then refine the slides in a dedicated workspace."
      schema={presentationSchema()}
      faqs={PRESENTATION_FAQS}
    >
      <section className="product-answer">
        <h2>From source material to editable slides.</h2>
        <ol className="product-process">
          <li>
            <strong>Bring the evidence.</strong> Add accessible public article
            links, pasted material or owned lessons and PDFs. Imports are
            bounded to six sources and 48,000 characters.
          </li>
          <li>
            <strong>Review the narrative.</strong> Check titles, slide purposes,
            layout choices and the theme. Planning is free. Save and reopen the
            plan before approving generation.
          </li>
          <li>
            <strong>Generate with structure.</strong> Separate slot-filling and
            editorial passes prepare concise copy. Fixed layouts control
            typography and geometry; the AI does not position boxes.
          </li>
          <li>
            <strong>Preview, edit and present.</strong> Refine content, review
            evidence and keep detail in private speaker notes. Use presentation
            controls or export native editable PPTX, slide PDF and PNG.
          </li>
        </ol>
        <a className="btn dark" href="/presentations/new">
          Open Presentation Studio
        </a>
      </section>
      <section aria-labelledby="layout-heading">
        <h2 id="layout-heading">Six layouts, nine original themes.</h2>
        <p>
          The palette and visual layout are separate choices. Short copy and
          shared design tokens keep spacing consistent.
        </p>
        <div className="product-feature-grid">
          {layouts.map(([title, body], i) => (
            <article className="card product-layout-card" key={title}>
              <div
                className={`product-layout-art layout-art-${i}`}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="product-answer">
        <h2>Know what the source supports.</h2>
        <p>
          Metric layouts require three source-supported numbers in the plan and
          exact excerpts in the generated slide. Quotes must match original
          source text. Private source text and speaker notes are excluded from
          audience and shared payloads.
        </p>
        <p>
          Extraction does not bypass restricted sites or paywalls. These checks
          prevent structural errors; important claims and interpretations still
          need human review.
        </p>
        <h2>What does generation cost?</h2>
        <p>
          Planning costs no credits. Explicit approval reserves five credits per
          deck. A saved-slide regeneration uses one credit. Failed generation
          preserves completed slides and returns the charge according to its
          failure rules. Free accounts can create up to six slides.
        </p>
        <a href="/pricing">See student plans and slide limits →</a>
      </section>
    </ProductPage>
  );
}
