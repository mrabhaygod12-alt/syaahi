import { segment } from "./text";

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
}

const CITE =
  /\[[0-9,\s–-]{1,20}\]|\(\s*[A-Z][A-Za-z'\-]+(?:\s+(?:et\s+al\.?|and|&)\s+[A-Z][A-Za-z'\-]+)?,?\s*\d{4}[a-z]?\s*\)|\bdoi:\s*10\.\d{4,}/;

const CLAIM =
  /\b(?:studies|research|evidence|data|results|findings|survey|report|analysis|experiment|trial|meta-analysis)\b|\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\s*(?:%|percent)\b|\b(?:increase|decrease|reduction|improvement|correlat\w*|significant\w*)\b/i;

export function auditCitations(text: string): CitationCoverage {
  const doc = segment(text);

  let cited = 0;
  let totalClaims = 0;
  const uncited: CitationCoverage["uncited"] = [];

  for (const s of doc.sentences) {
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
  };
}
