"use client";
import type { FactCitation } from "@/lib/presentations/hybrid/model";
import type { DeckSource } from "@/lib/presentations/drafts";
import { ExternalLink, Quote, ShieldCheck } from "lucide-react";
import { StudioDialog } from "./StudioShell";
export default function SourceInspector({
  fact,
  sources,
  onClose,
}: {
  fact: FactCitation;
  sources: DeckSource[];
  onClose: () => void;
}) {
  const source = sources.find((s) => s.id === fact.sourceId),
    before = source?.text.slice(Math.max(0, fact.start - 220), fact.start),
    after = source?.text.slice(fact.end, fact.end + 220);
  return (
    <StudioDialog title="Inspect source evidence" onClose={onClose}>
      <div className="cv-inspector">
        <span className="cv-eyebrow">
          <ShieldCheck size={14} />
          EXACT PASSAGE
        </span>
        <h3>{fact.documentTitle}</h3>
        {fact.pageNumber && <p>Saved document page {fact.pageNumber}</p>}
        <blockquote>
          <Quote size={23} />
          {before}
          <mark>{fact.exactQuote || fact.statement}</mark>
          {after}
        </blockquote>
        <p className="cv-fineprint">
          The quoted text matches the saved source. This is a provenance check,
          not an independent verdict on the source’s accuracy.
        </p>
        {source?.locator?.startsWith("https:") && (
          <a
            className="cv-button subtle"
            href={source.locator}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read original source
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    </StudioDialog>
  );
}
