import Link from "next/link";
import { ArrowRight, FileText, Link2, PenLine, Quote } from "lucide-react";
export default function HowItWorks() {
  return (
    <main className="ink-page">
      <div className="ink-lead" data-ink-reveal>
        <p className="ink-kicker">THE METHOD</p>
        <h1>
          Evidence you can
          <br />
          actually read.
        </h1>
        <p>One document. Clear findings. A better next draft.</p>
      </div>
      <div className="ink-method-grid" data-ink-reveal>
        {[
          {
            Icon: FileText,
            title: "01. Bring your document",
            body: "Upload a searchable PDF or DOCX, or paste text. Work with 200–120,000 characters per check.",
          },
          {
            Icon: Link2,
            title: "02. Compare your sources",
            body: "Add references from your library or paste a source. Optional web search sends selected excerpts to the configured search provider.",
          },
          {
            Icon: Quote,
            title: "03. Read the evidence",
            body: "Review matched passages beside their sources, check attribution and see explainable writing patterns.",
          },
          {
            Icon: PenLine,
            title: "04. Shape your next draft",
            body: "Choose a passage, try an editing mode, and compare both versions before accepting a change.",
          },
        ].map(({ Icon, title, body }) => (
          <section className="ink-method-card" key={title}>
            <Icon size={25} />
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <section
        className="ink-method-details"
        aria-label="Coverage and privacy"
        data-ink-reveal
      >
        {[
          {
            title: "What does similarity measure?",
            body: "The share of your draft’s words in matching runs of at least twelve words, against the sources actually compared. Shared keywords alone do not count. Duplicate sources cannot inflate the total. Similarity can include legitimate quotations; it is not a plagiarism verdict.",
          },
          {
            title: "Is this an AI detector?",
            body: "No. Writing-pattern measurements describe phrasing, repetition and rhythm. They cannot prove who or what wrote a passage. AI Ink does not promise detector bypass or AI-footprint removal.",
          },
          {
            title: "Which sources are covered?",
            body: "Your supplied sources, matching candidates from your private index, and retrieved web pages when search is configured. Up to twenty indexed sources are stored per account, with at most ten candidates per scan budget. Turnitin, iThenticate and paywalled full-text corpora are not integrated. With no comparison sources, overlap is unmeasured rather than certified clear.",
          },
          {
            title: "What is shared-phrasing review?",
            body: "A bounded three-word-overlap check finds some sentences with wording changes in compared sources. These candidates do not contribute to exact similarity. It is a lexical review, not comprehensive semantic or translated-plagiarism detection. The report shows when review limits were reached.",
          },
          {
            title: "What do reference checks verify?",
            body: "Supported numbered and author–year citations are linked to the recognized reference list. Missing links, unused entries and duplicates need manual review. Opt-in Crossref verification sends up to eight DOI identifiers, not your paper. Registry metadata does not prove that a source supports a claim. Scopus status requires an operator-configured API key and licensed commercial access.",
          },
          {
            title: "Can I adjust similarity filters?",
            body: "You can exclude recognized bibliography sections, paired quotations, individual matching sources and short matching runs. The view recalculates without altering the original report; reset restores the evidence. Removing private index sources does not erase excerpts in existing reports.",
          },
          {
            title: "What happens to my document?",
            body: "Your private report stores the extracted draft and evidence excerpts until you delete it. Full comparison-source bodies are not copied into reports. Sources explicitly added to your private index retain their text and fingerprints until removed. Uploaded files are parsed for text; they are not added to a public repository. Rewrites send your selected passage and optional writing sample to the configured AI provider. Database backups follow the operator’s backup policy.",
          },
          {
            title: "What files can I upload?",
            body: "Searchable PDF and DOCX up to 10 MB; UTF-8 TXT, Markdown and LaTeX up to 500 KB. Scanned PDFs need OCR first. Legacy .doc and password-protected files are not supported. Text is extracted, not rendered as the original page layout.",
          },
          {
            title: "Can an edit change my meaning?",
            body: "It can. Numbers, common citations, quotations, code and equations are checked for preservation, but those checks cannot prove semantic accuracy. Keep attribution and review every claim before using the revised passage.",
          },
        ].map((item) => (
          <details key={item.title}>
            <summary>{item.title}</summary>
            <p>{item.body}</p>
          </details>
        ))}
      </section>
      <div className="ink-dialog-actions">
        <p className="ink-small-print">
          Included with a purchased student pack or active paid subscription.
        </p>
        <Link className="ink-btn" href="/ink">
          Open document check <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}
