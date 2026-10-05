import type { DeckSource } from "./drafts";
const stopwords = new Set([
  "the",
  "and",
  "with",
  "from",
  "this",
  "that",
  "for",
  "are",
  "about",
  "presentation",
  "slide",
  "slides",
  "explain",
  "source",
  "sources",
]);
/** Extractive retrieval keeps original passages, rather than inventing a summary. */
export function sourceContext(
  sources: DeckSource[],
  query: string,
  budget = 9000,
): DeckSource[] {
  const tokens = (text: string) =>
    new Set(
      (
        text
          .normalize("NFKC")
          .toLowerCase()
          .match(/[\p{L}\p{M}\p{N}]{3,}/gu) || []
      ).filter((t) => !stopwords.has(t)),
    );
  const terms = tokens(query),
    share = Math.floor(budget / Math.max(1, sources.length));
  return sources.map((source) => {
    if (source.text.length <= share) return source;
    const passages: string[] = [];
    for (const paragraph of source.text.split(/\n+/)) {
      const sentences = paragraph.match(/[^.!?।]+[.!?।]*\s*/gu) || [paragraph];
      let group = "";
      for (const sentence of sentences) {
        if (group.length + sentence.length > 1100 && group) {
          passages.push(group.trim());
          group = "";
        }
        if (sentence.length > 1100) {
          if (group) {
            passages.push(group.trim());
            group = "";
          }
          for (let start = 0; start < sentence.length; start += 1000)
            passages.push(sentence.slice(start, start + 1000).trim());
        } else group += sentence;
      }
      if (group.trim()) passages.push(group.trim());
    }
    const ranked = passages
      .map((text, index) => ({
        text,
        index,
        score:
          [...tokens(text)].filter((t) => terms.has(t)).length * 5 +
          (index === 0 ? 3 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    let left = share;
    const selected: typeof ranked = [];
    for (const p of ranked) {
      if (left < 80) break;
      const text = p.text.slice(0, left);
      selected.push({ ...p, text });
      left -= text.length + 5;
    }
    return {
      ...source,
      text: selected
        .sort((a, b) => a.index - b.index)
        .map((p) => p.text)
        .join("\n…\n"),
      truncated: true,
    };
  });
}
