import { shingles, tokens, wordCount } from "./text";

/**
 * Source-matching for the AI Ink engine.
 *
 * The approach is the one used by real text-matching systems: fingerprint the
 * submission into overlapping word n-grams, look for those n-grams in source
 * text, then cluster adjacent hits into a contiguous matched region. We do not
 * report a "similarity percentage" from a bag of shared words — that produces
 * false positives on any two texts about the same subject. A match is only
 * reported when a run of words appears in the same order.
 */

export const SHINGLE_SIZE = 8;

export interface SourceDocument {
  id: string;
  title: string;
  url?: string;
  kind: "web" | "upload" | "corpus";
  text: string;
  retrievedAt?: string;
}

export interface MatchedSpan {
  /** Offsets into the submission. */
  start: number;
  end: number;
  /** Offsets into the source, when the caller wants to show both sides. */
  sourceStart: number;
  sourceEnd: number;
  words: number;
  /** The submission text for this span. */
  text: string;
  /** The source text for this span. */
  sourceText: string;
}

export interface SourceMatch {
  source: SourceDocument;
  spans: MatchedSpan[];
  matchedWords: number;
  /** Matched words as a share of the submission. */
  coverage: number;
  longestRun: number;
}

export interface MatchReport {
  sources: SourceMatch[];
  matchedWords: number;
  coverage: number;
  /** Distinct sources with at least one confirmed span. */
  sourceCount: number;
}

/** Minimum contiguous words before a hit is considered evidence rather than coincidence. */
const MIN_RUN_WORDS = 12;

/**
 * Normalise a source into fingerprints. Sources are usually much longer than
 * the submission, so we index the source once and probe with the submission's
 * n-grams — the cheaper direction (one index, one scan).
 */
function indexSource(source: string, size: number) {
  const words = tokens(source);
  const map = new Map<string, number[]>();
  for (let i = 0; i + size <= words.length; i += 1) {
    const key = words.slice(i, i + size).join(" ");
    const list = map.get(key);
    if (list) list.push(i);
    else map.set(key, [i]);
  }
  return { words, map };
}

export function matchSources(
  submission: string,
  sources: SourceDocument[],
): MatchReport {
  const subWords = tokens(submission);
  const subShingles = shingles(submission, SHINGLE_SIZE);
  const totalWords = subWords.length || 1;

  const results: SourceMatch[] = [];
  const claimed = new Set<number>();

  for (const source of sources.slice(0, 34)) {
    if (!source.text || source.text.length < 200) continue;
    const { words: srcWords, map } = indexSource(source.text.slice(0, 60000), SHINGLE_SIZE);
    if (!srcWords.length) continue;

    // Collect every word position in the submission that appears in the source.
    // A repeated n-gram can occur several times on both sides, so pair each
    // submission occurrence with each source occurrence; the run clustering
    // below is what rejects coincidental pairings.
    const hits: Array<{ sub: number; src: number }> = [];
    collect: for (const [gram, subPositions] of subShingles) {
      const srcPositions = map.get(gram);
      if (!srcPositions) continue;
      for (const sub of subPositions)
        for (const src of srcPositions.slice(0, 16)) {
          if (hits.length >= 20000) break collect;
          hits.push({ sub, src });
        }
    }
    if (!hits.length) continue;
    // Equal diagonal means exactly the same token order; do not bridge unrelated runs.
    hits.sort((a, b) => (a.src - a.sub) - (b.src - b.sub) || a.sub - b.sub);

    // Cluster hits into contiguous runs. Two hits belong to the same run when
    // the gap in both documents is small, which tolerates a stray word.
    const runs: Array<{ subStart: number; subEnd: number; srcStart: number; srcEnd: number }> = [];
    let current: (typeof runs)[number] | null = null;
    for (const hit of hits) {
      // The hit marks where an 8-word gram starts, so it covers
      // [hit, hit + SHINGLE_SIZE). Two hits continue the same run when they
      // start within one shingle of each other on both sides.
      const subStop = hit.sub + SHINGLE_SIZE;
      const srcStop = hit.src + SHINGLE_SIZE;
      if (
        current &&
        hit.src - hit.sub === current.srcStart - current.subStart &&
        hit.sub <= current.subEnd &&
        hit.src <= current.srcEnd &&
        hit.sub >= current.subStart &&
        hit.src >= current.srcStart
      ) {
        current.subEnd = Math.max(current.subEnd, subStop);
        current.srcEnd = Math.max(current.srcEnd, srcStop);
      } else {
        current = {
          subStart: hit.sub,
          subEnd: subStop,
          srcStart: hit.src,
          srcEnd: srcStop,
        };
        runs.push(current);
      }
    }

    const spans: MatchedSpan[] = [];
    const sourceClaimed = new Set<number>();
    for (const run of runs) {
      const subEnd = Math.min(run.subEnd, subWords.length);
      const runWords = subEnd - run.subStart;
      if (runWords < MIN_RUN_WORDS) continue;
      if (spans.length >= 12) break;

      const srcEnd = Math.min(run.srcEnd, srcWords.length);
      spans.push({
        start: run.subStart,
        end: subEnd,
        sourceStart: run.srcStart,
        sourceEnd: srcEnd,
        words: runWords,
        text: subWords.slice(run.subStart, subEnd).join(" "),
        sourceText: srcWords.slice(run.srcStart, srcEnd).join(" "),
      });
      for (let i = run.subStart; i < subEnd; i += 1) { claimed.add(i); sourceClaimed.add(i); }
    }

    if (!spans.length) continue;
    const matchedWords = sourceClaimed.size;
    results.push({
      source,
      spans,
      matchedWords,
      coverage: matchedWords / totalWords,
      longestRun: Math.max(...spans.map((s) => s.words)),
    });
  }

  results.sort((a, b) => b.matchedWords - a.matchedWords);
  const matchedWords = claimed.size;
  return {
    sources: results,
    matchedWords,
    coverage: Math.min(1, matchedWords / totalWords),
    sourceCount: results.length,
  };
}

/**
 * Turn word indices back into character offsets in the original submission so
 * the reader can highlight the exact passage. Word indices are relative to the
 * token stream, which strips punctuation — this walks the same token pattern
 * to recover positions.
 */
export function wordIndexToOffsets(text: string): number[] {
  const offsets: number[] = [];
  const re = /[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) offsets.push(m.index);
  return offsets;
}

/**
 * Pick the passages most worth searching for. Sending an entire dissertation
 * to a search API is slow and expensive; the highest-information sentences are
 * the ones most likely to be copied and the ones a reader cares about.
 */
export function searchExcerpts(input: string, limit = 8): string[] {
  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => wordCount(s) >= 8 && wordCount(s) <= 45);
  if (!sentences.length) return [];

  // Score by length and by the presence of distinctive (rare-looking) words.
  const freq = new Map<string, number>();
  for (const s of sentences)
    for (const w of tokens(s)) freq.set(w, (freq.get(w) || 0) + 1);

  const scored = sentences.map((s) => {
    const words = tokens(s);
    const distinctive = words.filter((w) => (freq.get(w) || 0) === 1 && w.length > 5).length;
    return { s, score: distinctive * 2 + Math.min(words.length, 30) / 10 };
  });
  scored.sort((a, b) => b.score - a.score);

  // Spread picks across the document so one dense paragraph doesn't dominate.
  const picked: string[] = [];
  const stride = Math.max(1, Math.floor(scored.length / limit));
  for (let i = 0; i < scored.length && picked.length < limit; i += stride) {
    const candidate = scored[i].s;
    if (!picked.some((p) => p.slice(0, 60) === candidate.slice(0, 60)))
      picked.push(candidate);
  }
  for (const entry of scored) {
    if (picked.length >= limit) break;
    if (!picked.includes(entry.s)) picked.push(entry.s);
  }
  return picked.slice(0, limit);
}
