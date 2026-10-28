import { segment } from "./text";
import {
  bibliographyRange,
  referenceEntries,
  type ReferenceEntry,
} from "./sections";

/**
 * Citation coverage. Kept free of storage imports so the analysis can run and
 * be tested without a database.
 */

export interface CitationCoverage {
  /** Sentences that make a factual-sounding claim but carry no citation. */
  uncited: Array<{ start: number; end: number; text: string; reason: string }>;
  cited: number;
  totalClaims: number;
  /** 0–100. */
  score: number;
  references?: ReferenceEntry[];
  issues?: Array<{
    kind: "missing-reference" | "unused-reference" | "duplicate-reference";
    text: string;
    start: number;
    end: number;
  }>;
}

const CITE =
  /\[[0-9,\s–-]{1,30}\]|\(\s*\p{L}[\p{L}'’\-]{1,79}(?:\s+(?:et\s+al\.?|and|&)\s*[\p{L}'’\-]{0,80})?,?\s*\d{4}[a-z]?\s*\)|(?<![\p{L}'’\-])\p{L}[\p{L}'’\-]{1,79}(?:\s+et\s+al\.?)?\s*\(\d{4}[a-z]?\)|\bdoi:\s*10\.\d{4,9}/u;

const CLAIM =
  /\b(?:studies|research|evidence|data|results|findings|survey|report|analysis|experiment|trial|meta-analysis)\b|\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\s*(?:%|percent)\b|\b(?:increase|decrease|reduction|improvement|correlat\w*|significant\w*)\b/i;

export function auditCitations(text: string): CitationCoverage {
  const doc = segment(text);
  text = doc.text;
  const references = referenceEntries(text),
    bib = bibliographyRange(text),
    body = bib ? text.slice(0, bib.start) : text;
  const issues: NonNullable<CitationCoverage["issues"]> = [],
    used = new Set<string>();
  for (const marker of body.matchAll(/\[([0-9,\s–-]{1,30})\]/g)) {
    const ids = new Set<number>();
    for (const part of marker[1].split(",")) {
      const pair = /^\s*(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?\s*$/.exec(part);
      if (!pair) continue;
      const first = Number(pair[1]),
        last = pair[2] ? Number(pair[2]) : first;
      for (let n = first; n <= Math.min(last, first + 20); n++) ids.add(n);
    }
    for (const n of ids) {
      const ref = references.find((r) => r.number === n);
      if (ref) used.add(ref.id);
      else if (issues.length < 100)
        issues.push({
          kind: "missing-reference",
          text: `Citation [${n}] has no matching numbered reference.`,
          start: marker.index!,
          end: marker.index! + marker[0].length,
        });
    }
  }
  for (const marker of body.matchAll(
    /(?<![\p{L}'’\-])\(?(\p{L}[\p{L}'’\-]{1,79})(?:\s+et\s+al\.?|\s+(?:&|and)\s+\p{L}[\p{L}'’\-]{1,79})?\s*[,\(]\s*((?:19|20)\d{2}[a-z]?)\)?/gu,
  )) {
    const author = marker[1].toLocaleLowerCase(),
      year = marker[2];
    if (["in", "during", "since", "from", "year"].includes(author)) continue;
    const ref = references.find((r) => r.author === author && r.year === year);
    if (ref) used.add(ref.id);
    else if (issues.length < 100)
      issues.push({
        kind: "missing-reference",
        text: `${marker[1]} ${year} has no matching author–year reference.`,
        start: marker.index!,
        end: marker.index! + marker[0].length,
      });
  }
  const seen = new Set<string>();
  for (const ref of references) {
    const key =
      ref.dois[0] || ref.text.toLocaleLowerCase().replace(/\s+/g, " ");
    if (seen.has(key))
      issues.push({
        kind: "duplicate-reference",
        text: "This reference or DOI appears more than once.",
        start: ref.start,
        end: ref.end,
      });
    seen.add(key);
    if (!used.has(ref.id))
      issues.push({
        kind: "unused-reference",
        text: "No supported in-text citation was linked to this reference. Review manually.",
        start: ref.start,
        end: ref.end,
      });
  }

  let cited = 0;
  let totalClaims = 0;
  const uncited: CitationCoverage["uncited"] = [];

  for (const s of doc.sentences) {
    if (bib && s.start >= bib.start && s.start < bib.end) continue;
    if (!CLAIM.test(s.text)) continue;
    totalClaims += 1;
    if (CITE.test(s.text)) {
      cited += 1;
      continue;
    }
    if (uncited.length < 30) {
      const reason = /\d/.test(s.text)
        ? "States a figure or date with no source for it."
        : "Summarises research or evidence without naming a source.";
      uncited.push({ start: s.start, end: s.end, text: s.text, reason });
    }
  }

  return {
    uncited,
    cited,
    totalClaims,
    score: totalClaims ? Math.round((cited / totalClaims) * 100) : 100,
    references,
    issues: issues.slice(0, 100),
  };
}
