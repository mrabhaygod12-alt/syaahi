import { createHash } from "node:crypto";
import type { DeckSource } from "../drafts";
import {
  hybridCredits,
  type FactCitation,
  type HybridPlan,
  type SlideManifest,
} from "./model";
const hash = (s: string) =>
  createHash("sha256").update(s).digest("hex").slice(0, 20);
export function factFromQuote(source: DeckSource, quote: string): FactCitation {
  if (
    typeof quote !== "string" ||
    quote.trim() !== quote ||
    quote.length < 24 ||
    quote.length > 240 ||
    quote.split(/\s+/u).length > 24
  )
    throw new Error("Use a concise, verbatim source passage.");
  const start = source.text.indexOf(quote);
  if (start < 0)
    throw new Error("An extracted claim does not match the supplied source.");
  const page = source.pageSpans?.find(
    (p) => p.start <= start && p.end >= start + quote.length,
  )?.pageNumber;
  return {
    id: `fact-${hash(source.id + ":" + start + ":" + quote)}`,
    statement: quote,
    sourceId: source.id,
    documentTitle: source.name,
    ...(page ? { pageNumber: Number(page) } : {}),
    exactQuote: quote,
    start,
    end: start + quote.length,
    confidenceScore: 1,
  };
}
export function verifyFacts(slides: SlideManifest[], sources: DeckSource[]) {
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  for (const slide of slides)
    for (const f of slide.facts) {
      const source = sourceMap.get(f.sourceId);
      if (
        !source ||
        f.documentTitle !== source.name ||
        source.text.slice(f.start, f.end) !== f.exactQuote ||
        f.exactQuote !== f.statement ||
        f.confidenceScore !== 1
      )
        throw new Error(
          "A slide citation no longer matches its source. Rebuild the slide.",
        );
      const canonical = factFromQuote(source, f.exactQuote);
      if (canonical.id !== f.id || canonical.pageNumber !== f.pageNumber)
        throw new Error("Citation ID or page attribution changed.");
    }
}
export function allocateBudget(
  requested: number,
  facts: FactCitation[],
  planCap: number,
  balance: number,
): HybridPlan["budget"] {
  if (!Number.isInteger(requested) || requested < 5 || requested > 30)
    throw new Error("Choose 5–30 slides.");
  const evidenceCap = Math.min(30, facts.length);
  let allocated = Math.min(requested, planCap, evidenceCap);
  while (allocated >= 5 && hybridCredits(allocated) > balance) allocated--;
  if (allocated < 5)
    throw new Error(
      facts.length < 5
        ? "Add more source material: at least five distinct source passages are required."
        : "Your account needs at least five credits and a five-slide allowance.",
    );
  return {
    requested,
    allocated,
    credits: hybridCredits(allocated),
    evidenceCap,
    planCap,
    balance,
    explanation:
      allocated < requested
        ? `Adjusted from ${requested} to ${allocated} slides to respect source coverage, membership and available credits.`
        : `${allocated} source-backed slides reserve ${hybridCredits(allocated)} credits. No extra filler slides.`,
  };
}
