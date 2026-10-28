import ProductPage from "@/components/ProductPage";
import { pageMeta, SITE, jsonLd, faqSchema } from "@/lib/seo";
export const metadata = pageMeta({
  title: "AI Ink: research paper similarity and citation checker",
  path: "/ai-ink",
  description:
    "Check PDF and DOCX research papers against your private source index, review source similarity and missing references, verify DOI metadata and improve writing with AI Ink by Syaahii.",
});
const faqs = [
  {
    q: "Can AI Ink find lightly changed source wording?",
    a: "A bounded three-word-overlap review flags some similar sentences with wording differences in the sources actually compared. Candidate passages are shown beside their source excerpt and remain separate from the exact-match percentage. This lexical heuristic does not establish semantic equivalence or detect every paraphrase or translation.",
  },
  {
    q: "What does AI Ink check in research papers?",
    a: "AI Ink compares text with supplied sources, an account-private source index and optional retrieved web results. Reports include matching passages, citation-format checks, reference-list issues and explainable writing patterns. Similarity requires context and does not establish plagiarism by itself.",
  },
  {
    q: "Can I check a PDF or Word document?",
    a: "AI Ink imports searchable PDFs and DOCX files up to 10 MB. Extracted submissions need 200–120,000 characters. Scanned PDFs need OCR first, and older .doc files are unsupported. The preview shows extracted text rather than the original page layout.",
  },
  {
    q: "Can AI Ink compare a book chapter?",
    a: "You can add a chapter passage that you have permission to use as a private comparison source. Each indexed source supports 200–60,000 characters and at most 12,000 words. AI Ink does not automatically access copyrighted books or paywalled publisher collections.",
  },
  {
    q: "How does the private source index work?",
    a: "AI Ink stores eight-word source fingerprints with your account. A scan retrieves candidate sources and confirms contiguous matching text before reporting evidence. Reports show indexed, candidate and compared counts. The index currently supports twenty private sources, with up to ten candidates compared per scan budget.",
  },
  {
    q: "Are submitted papers shared with other students?",
    a: "AI Ink does not automatically add submissions to a shared student repository. Private reports belong to their account. Sources enter the private index only through the source-index tool. Removing a source does not remove excerpts already saved in an older report.",
  },
  {
    q: "Can I exclude quotations and the bibliography?",
    a: "Report filters can exclude recognized bibliography sections, paired quotations, selected sources and short matching runs. Filters recalculate the visible similarity while retaining the original report evidence. Unclosed quotation marks do not cause the remainder of a paper to be excluded.",
  },
  {
    q: "Does a low similarity score prove originality?",
    a: "No. A low score only describes matching text in the sources actually compared. Missing sources, inaccessible books and paraphrased ideas can remain undetected. A high score can also include legitimate quotations. Read the evidence and apply your institution’s academic-integrity policy.",
  },
  {
    q: "Can AI Ink identify missing reference entries?",
    a: "AI Ink links supported numbered and author–year citations to recognized reference-list entries. It flags unresolved citations, duplicate reference entries and references with no linked supported citation. These are review prompts; unusual citation styles and complex layouts can require manual checking.",
  },
  {
    q: "What does Crossref DOI verification actually confirm?",
    a: "With your opt-in, AI Ink sends up to eight DOI identifiers to Crossref and displays returned bibliographic metadata. A found record confirms a registry match, not the accuracy of your argument. An unavailable service or missing record is not proof of a fabricated reference.",
  },
  {
    q: "Does AI Ink verify every Scopus-indexed journal?",
    a: "Scopus verification requires a configured Elsevier API key and approved commercial access. Without that integration, reports explicitly show Scopus as not configured. Crossref DOI metadata is not Scopus indexing, a journal-quality rating, or permission to access publisher full text.",
  },
  {
    q: "Is AI Ink an AI-writing authorship detector?",
    a: "AI Ink’s current writing measurements describe phrasing, repetition and rhythm. They are not calibrated probabilities of AI authorship. AI Ink does not certify that a paper is human-written and does not promise to bypass another system’s detector or academic-integrity review.",
  },
  {
    q: "Does AI Ink have Turnitin database access?",
    a: "No. AI Ink is an independent Syaahii tool and is not affiliated with Turnitin. Turnitin’s licensed publications and submitted-paper repository are not available through this implementation. AI Ink reports its own comparison sources and limits rather than claiming equivalent database coverage.",
  },
  {
    q: "Can I improve passages after reviewing matches?",
    a: "A finding can open its specific passage in the editing desk. Choose a writing mode, compare original and revised text, and explicitly accept the edit. Preserve attribution when paraphrasing, and verify facts and meaning before using any AI-generated revision.",
  },
  {
    q: "Which student plan includes the AI Ink tool?",
    a: "A verified student account with a recorded purchased student pack or active paid subscription can use AI Ink. Free signup and referral wallet credits do not unlock this paid feature. Current student prices and payment terms are listed on the plans page.",
  },
  {
    q: "Can optimization guarantee Google or AI-search rankings?",
    a: "No. AI Ink’s public page provides accessible product facts, canonical metadata, structured answers and a sitemap entry. Search engines and answer engines independently choose what to crawl, index and cite. These improvements make the product easier to understand without guaranteeing a ranking.",
  },
];
export default function Page() {
  return (
    <ProductPage
      title="Research with care. Write with confidence."
      kicker="AI INK BY SYAAHII"
      path="/ai-ink"
      lede="A document review workspace for research papers, review articles and book chapters. Compare source passages, inspect references and shape a clearer next draft."
      schema={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "AI Ink by Syaahii",
        url: `${SITE.url}/ai-ink`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web browser",
        description:
          "Private source similarity, citation review and guided editing for student research documents.",
        featureList: [
          "PDF and DOCX import",
          "Private source fingerprint index",
          "Reversible similarity filters",
          "Shared-phrasing review with source excerpts",
          "Reference-list checks",
          "Opt-in Crossref DOI metadata verification",
          "Guided passage editing",
        ],
        dateModified: "2026-10-28",
        publisher: { "@type": "Organization", name: "Syaahii", url: SITE.url },
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(faqs)) }}
      />
      <section className="product-answer">
        <p className="small">Reviewed 28 October 2026</p>
        <h2>What is AI Ink?</h2>
        <p>
          AI Ink is Syaahii’s private document-review tool for source
          similarity, reference checking and guided writing improvement.
        </p>
        <a className="btn dark" href="/ink">
          Open AI Ink →
        </a>{" "}
        <a className="btn light" href="/pricing">
          Student plans
        </a>
      </section>
      <section>
        <h2>A closer look at your research.</h2>
        <div className="product-feature-grid">
          {[
            {
              title: "Compare your sources",
              body: "Upload a paper or chapter, add your references, and inspect exact matched passages.",
            },
            {
              title: "Build a private index",
              body: "Keep comparison sources on your account and reuse them across new drafts.",
            },
            {
              title: "Review your references",
              body: "Find unresolved citations and duplicate entries, with optional DOI metadata checks.",
            },
            {
              title: "Improve a passage",
              body: "Compare suggested edits beside the original. You choose what to keep.",
            },
          ].map((x) => (
            <article className="card" key={x.title}>
              <h3>{x.title}</h3>
              <p>{x.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="product-answer">
        <h2>Coverage is part of the report.</h2>
        <p>
          Source similarity is measured against the material actually compared.
          AI Ink does not provide a plagiarism verdict or calibrated
          AI-authorship detection.
        </p>
        <p>
          Twenty private sources, up to ten retrieved candidates per scan
          budget, and up to eight DOI lookups per opted-in report. Limits are
          visible so a partial check cannot look like a complete database
          search.
        </p>
        <a href="/ink/how-it-works">Read the method and privacy details →</a>
      </section>
      <section>
        <h2>Research and methodology</h2>
        <p>
          Turnitin distinguishes text similarity from plagiarism decisions. AI
          Ink follows that distinction and keeps evidence visible for your
          review. Scholarly metadata is checked separately from document text.
        </p>
        <ul>
          <li>
            <a href="https://helpcenter.turnitin.com/hc/en-us/articles/27811925295501-Does-Turnitin-check-for-plagiarism-and-what-is-a-good-Similarity-score">
              Turnitin: similarity and human judgment
            </a>
          </li>
          <li>
            <a href="https://www.crossref.org/documentation/retrieve-metadata/rest-api/">
              Crossref: what metadata the registry exposes
            </a>
          </li>
          <li>
            <a href="https://dev.elsevier.com/sc_apis.html">
              Elsevier: Scopus API access and commercial licensing
            </a>
          </li>
        </ul>
      </section>
      <section>
        <h2>Questions about paper and reference checks</h2>
        {faqs.map((f, i) => (
          <details
            className="card"
            key={f.q}
            id={`ai-ink-faq-${i + 1}`}
            style={{ marginTop: 10 }}
          >
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
      <section className="product-answer">
        <h2>One study space, from notes to research.</h2>
        <p>
          Create your study notes, organise source material and review research
          drafts in the same student account.
        </p>
        <a href="/ai-generated-notes">AI-generated study notes</a> ·{" "}
        <a href="/ai-presentations">Presentation studio</a> ·{" "}
        <a href="/ink">Document review</a>
      </section>
    </ProductPage>
  );
}
