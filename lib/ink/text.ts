/**
 * Text segmentation for the AI Ink integrity engine.
 *
 * Everything downstream — plagiarism matching, style signals, the rewrite
 * pipeline — operates on sentence offsets into the submitted document, so a
 * finding can always be traced back to an exact span the learner can see.
 */

export interface Sentence {
  /** Absolute start offset in the normalised document. */
  start: number;
  /** Absolute end offset, exclusive. */
  end: number;
  text: string;
  /** Index of the paragraph this sentence belongs to. */
  paragraph: number;
  /** Word count. */
  words: number;
}

export interface Paragraph {
  index: number;
  start: number;
  end: number;
  text: string;
  /** Index range into the sentence array, end exclusive. */
  sentenceStart: number;
  sentenceEnd: number;
}

export interface Segment {
  text: string;
  paragraphs: Paragraph[];
  sentences: Sentence[];
  words: number;
  characters: number;
}

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "fig",
  "eq",
  "ref",
  "no",
  "vol",
  "pp",
  "al",
  "ed",
  "eds",
  "cf",
  "ca",
  "approx",
]);

/** Normalise line endings and collapse runs of blank lines, preserving offsets via a stable map. */
export function normalise(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function wordCount(text: string): number {
  const matches = text.match(
    /[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d'’\-]*/gu,
  );
  return matches ? matches.length : 0;
}

/**
 * Split into sentences. Handles the cases that actually appear in student
 * writing: numbered clauses, decimals, abbreviations, initials, and quotes.
 * A sentence that never terminates is still emitted.
 */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let paragraph = 0;
  let sentenceStart = 0;
  let cursor = 0;

  const pushSentence = (end: number) => {
    const raw = text.slice(sentenceStart, end);
    const trimmedStart = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const start = sentenceStart + trimmedStart;
      out.push({
        start,
        end: start + trimmed.length,
        text: trimmed,
        paragraph,
        words: wordCount(trimmed),
      });
    }
    sentenceStart = end;
  };

  while (cursor < text.length) {
    const ch = text[cursor];

    if (ch === "\n") {
      // A blank line ends the paragraph and any open sentence.
      const isBlank = text[cursor + 1] === "\n";
      if (isBlank) {
        pushSentence(cursor);
        paragraph += 1;
        cursor += 2;
        sentenceStart = cursor;
        continue;
      }
      // A single newline inside a paragraph is a soft break only.
      cursor += 1;
      continue;
    }

    if (ch === "." || ch === "!" || ch === "?" || ch === "।") {
      // Consume a run like "?!" or "..." as one terminator.
      let end = cursor + 1;
      while (end < text.length && /[.!?]/.test(text[end])) end += 1;

      // Closing quotes and brackets belong to the sentence.
      let after = end;
      while (after < text.length && /["'”’)\]]/.test(text[after])) after += 1;

      if (ch === ".") {
        const before = text.slice(Math.max(0, cursor - 12), cursor);
        const token = (before.match(/([\p{L}.]+)$/u)?.[1] || "").toLowerCase();
        const isAbbrev = ABBREVIATIONS.has(token.replace(/\.$/, ""));
        const isInitial = /(?:^|\s)\p{Lu}$/u.test(before);
        const isDecimal =
          /\d$/.test(before) && /^\d/.test(text.slice(after).trimStart());
        const isNumbering = /^\s*(?:\d+|[a-z])$/i.test(before);
        if (isAbbrev || isInitial || isDecimal || isNumbering) {
          cursor = after;
          continue;
        }
      }

      pushSentence(after);
      cursor = after;
      continue;
    }

    cursor += 1;
  }
  pushSentence(text.length);

  return out;
}

export function paragraphs(text: string, all: Sentence[]): Paragraph[] {
  const out: Paragraph[] = [];
  let index = 0;
  let blockStart = 0;
  let sentenceCursor = 0;
  const flush = (end: number) => {
    const raw = text.slice(blockStart, end);
    if (raw.trim().length === 0) return;
    const start = blockStart + (raw.length - raw.trimStart().length);
    const stop = end - (raw.length - raw.trimEnd().length);
    while (sentenceCursor < all.length && all[sentenceCursor].start < start)
      sentenceCursor++;
    const first = sentenceCursor;
    while (sentenceCursor < all.length && all[sentenceCursor].end <= stop)
      sentenceCursor++;
    const count = sentenceCursor - first;
    out.push({
      index,
      start,
      end: stop,
      text: text.slice(start, stop),
      sentenceStart: count ? first : 0,
      sentenceEnd: count ? sentenceCursor : 0,
    });
    index += 1;
  };

  const re = /\n\s*\n/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    flush(match.index);
    blockStart = match.index + match[0].length;
  }
  flush(text.length);
  return out;
}

export function segment(input: string): Segment {
  const text = normalise(input);
  const all = sentences(text);
  const blocks = paragraphs(text, all);
  return {
    text,
    paragraphs: blocks,
    sentences: all,
    words: wordCount(text),
    characters: text.length,
  };
}

/** Lowercase word tokens, keeping apostrophes inside words. */
export function tokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d'\-]*/gu) || []
  ).map((t) => t.replace(/^['\-]+|['\-]+$/g, ""));
}

/**
 * Overlapping word n-grams mapped to the position of their first word.
 * Used by the plagiarism matcher — 8 words is long enough to be evidence and
 * short enough to find legitimate matches in academic prose.
 */
export function shingles(text: string, size = 8): Map<string, number[]> {
  const words = tokens(text);
  const out = new Map<string, number[]>();
  for (let i = 0; i + size <= words.length; i += 1) {
    const key = words.slice(i, i + size).join(" ");
    const list = out.get(key);
    if (list) list.push(i);
    else out.set(key, [i]);
  }
  return out;
}

/** Map a word index back to a character offset, so findings point at real text. */
export function wordOffsets(text: string): number[] {
  const offsets: number[] = [];
  const re = /[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d'\-]*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) offsets.push(m.index);
  return offsets;
}
