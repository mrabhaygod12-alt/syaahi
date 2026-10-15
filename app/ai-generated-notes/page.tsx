import ProductPage from "@/components/ProductPage";
import { pageMeta } from "@/lib/seo";
import { notesSchema, AI_NOTE_FAQS } from "@/lib/notes/product";
import { learningLink } from "@/lib/growth/samples";
export const metadata = pageMeta({
  title: "AI-generated notes for university study",
  path: "/ai-generated-notes",
  description:
    "Create source-based AI study notes for UG and PG computer science. Review outlines, edit illustrated notes, download PDF and practise with quizzes and flashcards.",
});
export default function Page() {
  return (
    <ProductPage
      title="AI-generated notes. Designed for understanding."
      kicker="YOUR UNIVERSITY STUDY SPACE"
      path="/ai-generated-notes"
      lede="Turn a topic, PDF or lecture into editable study notes. Syaahii connects clear explanations, visual structure and active recall for UG and PG learners."
      faqs={AI_NOTE_FAQS}
      schema={notesSchema()}
    >
      <section className="product-answer">
        <h2>What does Syaahii generate?</h2>
        <p>
          Syaahii creates structured study notes from reviewed source material
          or a topic. Its illustrated atlas combines definitions, key ideas,
          examples, process diagrams, comparisons and takeaways. You can edit
          each saved section and export a printable PDF.
        </p>
        <a className="btn dark" href="/#preview">
          Try a short topic preview →
        </a>
      </section>
      <section>
        <h2>Start with your course, not a generic prompt.</h2>
        <div className="product-feature-grid">
          {[
            "DBMS normalization with examples",
            "Operating system process scheduling",
            "Computer networks TCP and UDP",
            "Machine learning supervised and unsupervised learning",
            "Data structures binary search",
            "Software engineering testing strategies",
          ].map((topic) => (
            <article className="card" key={topic}>
              <h3>{topic}</h3>
              <p>
                Set your syllabus, level and learning goal. Review the outline
                before generating.
              </p>
              <a href={learningLink(topic)}>Prepare this topic →</a>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>Learning continues after the PDF.</h2>
        <ol className="product-process">
          <li>
            <strong>Source room:</strong> review the supplied material and
            references.
          </li>
          <li>
            <strong>Notes:</strong> edit explanations, mark sections reviewed
            and switch reading layouts.
          </li>
          <li>
            <strong>Practice:</strong> quiz yourself and revisit saved
            flashcards.
          </li>
          <li>
            <strong>Lesson chat:</strong> ask questions about the material, with
            source labels where available.
          </li>
        </ol>
        <a href="/youtube-video-to-notes">
          Make AI notes from a YouTube lecture →
        </a>
      </section>
      <section className="product-answer">
        <h2>Your sources and your judgement matter.</h2>
        <p>
          AI can be wrong. Syaahii labels source types and gives you an outline
          to check. Verify important claims, code and formulas against the
          original material. Generated notes support revision and understanding.
        </p>
        <a href="/pricing">See current student credits and plans →</a>
      </section>
    </ProductPage>
  );
}
