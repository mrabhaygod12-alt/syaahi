import { sentences, normalise, tokens, wordOffsets } from "./text";
import type { SourceDocument, MatchReport } from "./match";
export interface PhraseCandidate {
  start: number;
  end: number;
  text: string;
  source: { id: string; title: string; url?: string; text: string };
  reason: string;
}
const grams = (w: string[]) => {
  const out = new Set<string>();
  for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(" "));
  return out;
};
/** Bounded lexical review; candidates never contribute to exact similarity. */
export function reviewPhrasing(
  text: string,
  sources: SourceDocument[],
  exact: MatchReport,
) {
  const offsets = wordOffsets(text),
    covered = new Set<number>();
  for (const row of exact.sources)
    for (const span of row.spans)
      for (let i = span.start; i < span.end; i++) covered.add(i);
  const eligible = sentences(text).filter(
    (s) => s.words >= 16 && s.words <= 80,
  );
  const candidates: PhraseCandidate[] = [],
    sub = eligible
      .slice(0, 200)
      .filter((s) => {
        let lo = 0,
          hi = offsets.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (offsets[mid] < s.start) lo = mid + 1;
          else hi = mid;
        }
        let n = 0,
          hit = 0;
        for (let i = lo; i < offsets.length && offsets[i] < s.end; i++) {
          n++;
          if (covered.has(i)) hit++;
        }
        return !n || hit / n <= 0.8;
      })
      .map((s) => ({ s, words: tokens(s.text), q: grams(tokens(s.text)) }));
  let comparisons = 0,
    limited = eligible.length > 200 || sources.length > 34,
    stopped = false;
  for (const source of sources.slice(0, 34)) {
    const available = sentences(normalise(source.text.slice(0, 60000))).filter(
      (s) => s.words >= 16 && s.words <= 80,
    );
    if (source.text.length > 60000 || available.length > 250) limited = true;
    const rows = available.slice(0, 250).map((s) => ({
        s,
        words: tokens(s.text),
        grams: grams(tokens(s.text)),
      })),
      index = new Map<string, number[]>();
    rows.forEach((row, i) =>
      row.grams.forEach((g) => {
        const ids = index.get(g) || [];
        if (ids.length < 16) {
          ids.push(i);
          index.set(g, ids);
        } else limited = true;
      }),
    );
    for (const { s, words, q } of sub) {
      const anchors = [...q]
          .filter((g) => index.has(g))
          .sort((a, b) => index.get(a)!.length - index.get(b)!.length)
          .slice(0, 3),
        possible = anchors.flatMap((g) => index.get(g)!),
        ids = new Set(possible.slice(0, 30));
      if (possible.length > 30) limited = true;
      for (const id of ids) {
        if (comparisons >= 2000) {
          limited = stopped = true;
          break;
        }
        comparisons++;
        const row = rows[id];
        if (
          row.words.length / words.length < 0.65 ||
          row.words.length / words.length > 1.5
        )
          continue;
        const shared = [...q].filter((g) => row.grams.has(g)).length,
          union = q.size + row.grams.size - shared;
        if (
          !union ||
          shared / union < 0.5 ||
          words.join(" ") === row.words.join(" ")
        )
          continue;
        if (candidates.some((c) => c.start === s.start)) continue;
        candidates.push({
          start: s.start,
          end: s.end,
          text: s.text,
          source: {
            id: source.id,
            title: source.title,
            url: source.url,
            text: row.s.text,
          },
          reason:
            "Shared phrasing with wording differences. Review attribution; this is not an exact-match or plagiarism verdict.",
        });
        if (candidates.length >= 12) {
          limited = stopped = true;
          break;
        }
      }
      if (stopped) break;
    }
    if (stopped) break;
  }
  return {
    candidates,
    comparisons,
    limited,
    method: "lexical-three-word-overlap",
  };
}
