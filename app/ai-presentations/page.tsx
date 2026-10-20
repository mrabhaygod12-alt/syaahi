import ProductPage from "@/components/ProductPage";
import { pageMeta, presentationSchema } from "@/lib/seo";
import { PRESENTATION_FAQS } from "@/lib/product-facts";
export const metadata = pageMeta({
  title: "Source-based AI presentations with editable PowerPoint export",
  path: "/ai-presentations",
  description:
    "Review exact source evidence, build a cited narrative, direct interactive visual scenes and export PPTX, PDF or an offline web deck.",
});
const layouts = [
  [
    "Knowledge hub",
    "Complete bounded imports, source passages and page attribution.",
  ],
  [
    "Narrative plan",
    "Review concise scene headings and inspect the evidence before approval.",
  ],
  [
    "Universal stage",
    "Explore conceptual 3D, vector and shader scenes with device fallbacks.",
  ],
  ["Camera director", "Move through a retained 3D world in presentation mode."],
  [
    "Checked delivery",
    "Exact quotations, measured text bounds and readable contrast.",
  ],
  [
    "Portable output",
    "Editable PowerPoint, PDF and an offline interactive HTML deck.",
  ],
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
            bounded to six imported sources and 1.2 million extracted
            characters. Research adds explicitly labelled excerpts or abstracts.
            Provider context limits also apply.
          </li>
          <li>
            <strong>Review the narrative.</strong> Check titles, slide purposes,
            scene choices and the design genome. Planning does not charge
            credits, but at least five available credits are required. Save and
            reopen the plan before approving generation.
          </li>
          <li>
            <strong>Generate with structure.</strong> Separate evidence
            extraction and narrative passes prepare typed manifests. Approved
            rendering code controls typography and geometry; model-supplied code
            and coordinates are never executed.
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
        <h2 id="layout-heading">From evidence to a visual world.</h2>
        <p>
          Choose an original design genome, visual metaphor and engine. The
          source inspector keeps factual statements connected to their exact
          saved passages.
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
          Each factual card must match a saved source quotation and attribution.
          The quality gate checks contrast and text clipping in headless
          Chromium before a new deck is delivered. Private source text and
          speaker notes are excluded from audience and shared payloads.
        </p>
        <p>
          Extraction does not bypass restricted sites or paywalls. These checks
          prevent structural errors; important claims and interpretations still
          need human review.
        </p>
        <h2>What does generation cost?</h2>
        <p>
          Planning costs no credits. Explicit approval reserves five credits for
          up to ten scenes, plus two credits for each additional group of up to
          five scenes. The plan shows its exact cost. A saved-slide regeneration
          uses one credit. Failed generation preserves completed slides and
          returns the charge according to its failure rules. Free accounts can
          create up to six slides.
        </p>
        <a href="/pricing">See student plans and slide limits →</a>
      </section>
    </ProductPage>
  );
}
