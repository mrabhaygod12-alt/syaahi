import { bibliographyRange, quoteRanges } from "./sections";
import { tokens, wordOffsets } from "./text";
import type { MatchReport } from "./match";
export interface MatchFilters {
  bibliography: boolean;
  quotes: boolean;
  minWords: number;
  excludedSources: string[];
}
export const DEFAULT_MATCH_FILTERS: MatchFilters = {
  bibliography: false,
  quotes: false,
  minWords: 12,
  excludedSources: [],
};
/** Recalculate from immutable evidence; exclusions are reversible and never erase the raw report. */
export function filterMatches(
  text: string,
  match: MatchReport,
  options: MatchFilters,
) {
  const offsets = wordOffsets(text),
    words = tokens(text),
    skip = new Set<number>();
  const bib = options.bibliography ? bibliographyRange(text) : null;
  const ranges = [
    ...(bib ? [bib] : []),
    ...(options.quotes ? quoteRanges(text) : []),
  ].sort((a, b) => a.start - b.start);
  let r = 0;
  for (let i = 0; i < offsets.length; i++) {
    while (r < ranges.length && ranges[r].end <= offsets[i]) r++;
    if (
      r < ranges.length &&
      ranges[r].start <= offsets[i] &&
      ranges[r].end > offsets[i]
    )
      skip.add(i);
  }
  const minimum = Math.max(
      12,
      Math.min(100, Math.floor(options.minWords) || 12),
    ),
    claimed = new Set<number>();
  const sources: MatchReport["sources"] = [];
  const eligibleWords = offsets.length - skip.size;
  for (const source of match.sources) {
    if (options.excludedSources.includes(source.source.id)) continue;
    const spans: typeof source.spans = [],
      own = new Set<number>();
    for (const span of source.spans) {
      let start = span.start;
      const sourceWords = tokens(span.sourceText);
      for (let i = span.start; i <= span.end; i++) {
        if (i < span.end && !skip.has(i)) continue;
        if (i - start >= minimum) {
          const length = i - start;
          spans.push({
            ...span,
            start,
            end: i,
            sourceStart: span.sourceStart + start - span.start,
            sourceEnd: span.sourceStart + start - span.start + length,
            words: length,
            text: words.slice(start, i).join(" "),
            sourceText: sourceWords
              .slice(start - span.start, i - span.start)
              .join(" "),
          });
          for (let k = start; k < i; k++) {
            own.add(k);
            claimed.add(k);
          }
        }
        start = i + 1;
      }
    }
    if (spans.length)
      sources.push({
        ...source,
        spans,
        matchedWords: own.size,
        coverage: eligibleWords ? own.size / eligibleWords : 0,
        longestRun: Math.max(...spans.map((s) => s.words)),
      });
  }
  return {
    match: {
      sources,
      matchedWords: claimed.size,
      coverage: eligibleWords ? Math.min(1, claimed.size / eligibleWords) : 0,
      sourceCount: sources.length,
      limited: match.limited,
    },
    excludedWords: skip.size,
    eligibleWords,
  };
}
