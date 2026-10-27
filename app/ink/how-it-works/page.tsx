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
            body: "Your supplied sources and retrieved web pages when search is configured. Turnitin, iThenticate, paywalled journal corpora and printed books are not integrated. With no comparison sources, overlap is unmeasured rather than certified clear.",
          },
          {
            title: "What happens to my document?",
            body: "Your private report stores the extracted draft and matched excerpts until you delete it. Full third-party pages are not retained. Uploaded files are parsed for text; they are not added to a public repository. Rewrites send your selected passage and optional writing sample to the configured AI provider. Database backups follow the operator’s backup policy.",
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
