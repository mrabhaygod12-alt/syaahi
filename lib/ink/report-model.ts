import { wordOffsets } from "./text";
import { quoteRanges } from "./sections";
import type { MatchReport } from "./match";

export const SOURCE_COLORS = [
  "#b34432",
  "#3456ac",
  "#6d438b",
  "#16756d",
  "#9a6418",
  "#9e386c",
];
export const GROUP_LABELS = {
  unattributed: "No nearby citation marker",
  citation: "Citation marker nearby",
  quotation: "Quotation without nearby citation",
  "quoted-citation": "Quotation with nearby citation",
} as const;
export type MatchGroup = keyof typeof GROUP_LABELS;

/** Offsets refer to extracted text, not original PDF coordinates. */
export function reportFindings(text: string, match: MatchReport) {
  const offsets = wordOffsets(text),
    quotes = quoteRanges(text);
  return match.sources.flatMap((source, index) =>
    source.spans.map((span, i) => {
      const start = offsets[span.start] ?? 0;
      const last = span.end - 1;
      const end =
        (offsets[last] ?? start) +
        (text
          .slice(offsets[last] ?? start)
          .match(/^[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d'\-]*/u)?.[0]
          .length || 0);
      const context = text.slice(
        Math.max(0, start - 80),
        Math.min(text.length, end + 100),
      );
      const cited =
        /\[\d{1,4}(?:\s*[,;–-]\s*\d{1,4})*\]|\([\p{L}][^()\n]{0,70}\b(?:19|20)\d{2}[a-z]?\)/u.test(
          context,
        );
      const quoted = quotes.some((q) => q.start <= start && q.end >= end);
      const group: MatchGroup = quoted
        ? cited
          ? "quoted-citation"
          : "quotation"
        : cited
          ? "citation"
          : "unattributed";
      return {
        id: `${source.source.id}-${i}`,
        sourceNumber: index + 1,
        sourceId: source.source.id,
        color: SOURCE_COLORS[index % SOURCE_COLORS.length],
        start,
        end,
        words: span.words,
        text: text.slice(start, end),
        sourceText: span.sourceText,
        group,
      };
    }),
  );
}
export function matchGroups(text: string, match: MatchReport) {
  const findings = reportFindings(text, match);
  return (Object.keys(GROUP_LABELS) as MatchGroup[]).map((id) => ({
    id,
    label: GROUP_LABELS[id],
    count: findings.filter((f) => f.group === id).length,
  }));
}
