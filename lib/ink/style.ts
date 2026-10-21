import { type Sentence, tokens, segment } from "./text";

/**
 * Stylometric analysis for the AI Ink integrity engine.
 *
 * This does not attempt to "detect AI" and it does not claim to. It measures
 * properties of the writing that are worth a learner's attention, and reports
 * them with the evidence that produced each number. Every signal is
 * explainable in one sentence and traceable to specific spans, because a
 * score nobody can interrogate is not useful to a student trying to improve.
 */

export interface Signal {
  id: string;
  label: string;
  /** 0–100, where higher means more of the property being measured. */
  value: number;
  /** One plain sentence describing what was measured. */
  reading: string;
  /** Why this matters for academic writing. */
  why: string;
  weight: number;
}

export interface Span {
  start: number;
  end: number;
  text: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface StyleReport {
  words: number;
  sentences: number;
  paragraphs: number;
  signals: Signal[];
  /** 0–100 composite of the weighted style signals. */
  footprint: number;
  /** Bucketed verdict for the UI. Never presented as a probability of AI authorship. */
  band: "clear" | "watch" | "elevated";
  spans: Span[];
  vocabulary: {
    uniqueRatio: number;
    averageWordLength: number;
    longWordRatio: number;
  };
  sentenceStats: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    shortRatio: number;
    longRatio: number;
  };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Map a value onto 0–100 across a range, clamped at both ends. */
const scale = (value: number, lo: number, hi: number) =>
  clamp(((value - lo) / (hi - lo)) * 100);

/**
 * Connective phrases that appear far more often in machine-drafted prose than
 * in student writing. Counted per 100 words so document length doesn't skew it.
 */
const FORMULAIC = [
  "it is important to note",
  "it is worth noting",
  "it should be noted",
  "in today's world",
  "in today's fast-paced",
  "plays a crucial role",
  "plays a vital role",
  "plays a significant role",
  "plays a pivotal role",
  "a wide range of",
  "a significant impact",
  "it is essential to",
  "it is crucial to",
  "in conclusion",
  "in summary",
  "overall, it can be",
  "delve into",
  "tapestry of",
  "navigate the complexities",
  "in the realm of",
  "serves as a testament",
  "a testament to",
  "unlock the potential",
  "harness the power",
  "at the forefront of",
  "paradigm shift",
  "multifaceted",
  "underscores the importance",
  "furthermore",
  "moreover",
  "additionally",
  "consequently",
  "nevertheless",
  "in essence",
  "ultimately",
  "seamless",
  "robust",
  "leverage",
  "utilize",
  "facilitate",
  "comprehensive understanding",
  "ever-evolving",
  "ever-changing",
  "rapidly evolving",
  "cutting-edge",
  "game-changer",
  "revolutionize",
];

/** Hedges and intensifiers that flatten a writer's own judgement. */
const FLAT_AFFECT = [
  "very important",
  "highly significant",
  "extremely useful",
  "greatly enhances",
  "significantly improves",
  "truly remarkable",
  "incredibly",
  "remarkably",
];

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/** Coefficient of variation of sentence length — the core "burstiness" measure. */
function sentenceStats(list: Sentence[]) {
  const lengths = list.map((s) => s.words).filter((n) => n > 0);
  if (!lengths.length)
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      shortRatio: 0,
      longRatio: 0,
    };
  const sorted = [...lengths].sort((a, b) => a - b);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / lengths.length;
  const mid = Math.floor(sorted.length / 2);
  return {
    mean: Math.round(mean * 10) / 10,
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    shortRatio: lengths.filter((n) => n < 8).length / lengths.length,
    longRatio: lengths.filter((n) => n > 32).length / lengths.length,
  };
}

/**
 * Find repeated sentence openings. Machine drafts reuse scaffolds
 * ("This ...", "The ... allows ..."); human drafts usually don't.
 */
function repeatedOpenings(list: Sentence[]) {
  const openings = new Map<string, Span[]>();
  for (const s of list) {
    const words = tokens(s.text).slice(0, 3);
    if (words.length < 2) continue;
    const key = words.join(" ");
    const span: Span = {
      start: s.start,
      end: s.end,
      text: s.text,
      reason: `Starts the same way as another sentence ("${words.slice(0, 2).join(" ")}…").`,
      severity: "low",
    };
    const list2 = openings.get(key);
    if (list2) list2.push(span);
    else openings.set(key, [span]);
  }
  const out: Span[] = [];
  for (const [, group] of openings) {
    if (group.length >= 3) out.push(...group.slice(0, 4));
  }
  return out;
}

export function analyseStyle(input: string): StyleReport {
  const doc = segment(input);
  const text = doc.text;
  const lower = text.toLowerCase();
  const per100 = (n: number) => (doc.words ? (n / doc.words) * 100 : 0);

  const words = tokens(text);
  const unique = new Set(words);
  const uniqueRatio = words.length ? unique.size / words.length : 0;
  const averageWordLength = words.length
    ? words.reduce((n, w) => n + w.length, 0) / words.length
    : 0;
  const longWordRatio = words.length
    ? words.filter((w) => w.length >= 8).length / words.length
    : 0;

  const stats = sentenceStats(doc.sentences);

  // --- Signal 1: sentence-length uniformity ("burstiness") -----------------
  // Human academic prose typically has a coefficient of variation above 0.5.
  const cv = stats.mean ? stats.stdDev / stats.mean : 0;
  const uniformity = scale(cv, 0.55, 0.15); // lower CV -> higher score

  // --- Signal 2: formulaic connective density ------------------------------
  const formulaicHits: Span[] = [];
  let formulaicCount = 0;
  for (const phrase of FORMULAIC) {
    const n = countOccurrences(lower, phrase);
    if (!n) continue;
    formulaicCount += n;
    if (formulaicHits.length >= 24) continue;
    let from = 0;
    for (let i = 0; i < n && formulaicHits.length < 24; i += 1) {
      const at = lower.indexOf(phrase, from);
      if (at === -1) break;
      from = at + phrase.length;
      // Expand to the containing sentence.
      const sentence = doc.sentences.find(
        (s) => s.start <= at && s.end >= at + phrase.length,
      );
      formulaicHits.push({
        start: sentence?.start ?? at,
        end: sentence?.end ?? at + phrase.length,
        text: sentence?.text ?? text.slice(at, at + phrase.length),
        reason: `Formulaic phrase: "${phrase}".`,
        severity: n >= 3 ? "medium" : "low",
      });
    }
  }
  const formulaicDensity = per100(formulaicCount);
  const formulaicSignal = scale(formulaicDensity, 0.2, 3.5);

  // --- Signal 3: lexical diversity -----------------------------------------
  // Very high type-token ratio on a long document suggests thesaurus cycling.
  const diversitySignal =
    doc.words > 120 ? scale(uniqueRatio, 0.36, 0.62) : 0;

  // --- Signal 4: paragraph rhythm ------------------------------------------
  // Uniform paragraph lengths read as templated.
  const paraWords = doc.paragraphs
    .map((p) => p.text.split(/\s+/).filter(Boolean).length)
    .filter((n) => n > 0);
  let paraCv = 0;
  if (paraWords.length >= 3) {
    const mean = paraWords.reduce((a, b) => a + b, 0) / paraWords.length;
    const sd = Math.sqrt(
      paraWords.reduce((s, n) => s + (n - mean) ** 2, 0) / paraWords.length,
    );
    paraCv = mean ? sd / mean : 0;
  }
  const rhythmSignal = paraWords.length >= 3 ? scale(paraCv, 0.55, 0.12) : 0;

  // --- Signal 5: flat affect -----------------------------------------------
  const flatCount = FLAT_AFFECT.reduce(
    (n, phrase) => n + countOccurrences(lower, phrase),
    0,
  );
  const affectSignal = scale(per100(flatCount), 0, 1.2);

  // --- Signal 6: long-word inflation ---------------------------------------
  const inflationSignal = scale(longWordRatio, 0.22, 0.42);

  const signals: Signal[] = [
    {
      id: "uniformity",
      label: "Sentence rhythm",
      value: Math.round(uniformity),
      reading: `Sentences average ${stats.mean} words with a spread of ${stats.stdDev}.`,
      why: "Evenly sized sentences are the clearest stylistic tell. Varying long and short sentences is what makes writing sound like a person thinking.",
      weight: 0.28,
    },
    {
      id: "formulaic",
      label: "Stock phrasing",
      value: Math.round(formulaicSignal),
      reading: `${formulaicCount} stock phrase${formulaicCount === 1 ? "" : "s"} in ${doc.words} words (${formulaicDensity.toFixed(1)} per 100).`,
      why: "Phrases like “plays a crucial role” carry no information. Replacing them with a specific claim is the single fastest improvement to most drafts.",
      weight: 0.26,
    },
    {
      id: "diversity",
      label: "Word range",
      value: Math.round(diversitySignal),
      reading: `${Math.round(uniqueRatio * 100)}% of words are used only once.`,
      why: "A very high unique-word rate often means simple words were swapped for longer synonyms, which reads as strained rather than precise.",
      weight: 0.14,
    },
    {
      id: "rhythm",
      label: "Paragraph shape",
      value: Math.round(rhythmSignal),
      reading:
        paraWords.length >= 3
          ? `Paragraphs run ${Math.min(...paraWords)}–${Math.max(...paraWords)} words.`
          : "Too few paragraphs to judge shape.",
      why: "Paragraphs of near-identical length suggest a template rather than an argument that expands and contracts with its ideas.",
      weight: 0.12,
    },
    {
      id: "affect",
      label: "Flat emphasis",
      value: Math.round(affectSignal),
      reading: `${flatCount} generic intensifier${flatCount === 1 ? "" : "s"} found.`,
      why: "Intensifiers like “highly significant” replace evidence with volume. Naming the actual effect is stronger.",
      weight: 0.1,
    },
    {
      id: "inflation",
      label: "Long-word share",
      value: Math.round(inflationSignal),
      reading: `${Math.round(longWordRatio * 100)}% of words are eight letters or longer.`,
      why: "A high share of long words without matching specificity usually means vocabulary was inflated rather than chosen.",
      weight: 0.1,
    },
  ];

  const footprint = Math.round(
    signals.reduce((sum, s) => sum + s.value * s.weight, 0),
  );

  // Spans: the concrete evidence a learner can act on.
  const spans: Span[] = [...formulaicHits, ...repeatedOpenings(doc.sentences)];
  // Add the flattest sentences: uniform length, no concrete noun, no digit.
  for (const s of doc.sentences) {
    if (spans.length >= 40) break;
    if (s.words < 12 || s.words > 30) continue;
    if (/\d/.test(s.text)) continue;
    if (spans.some((x) => x.start === s.start)) continue;
    if (Math.abs(s.words - stats.mean) > 1.5) continue;
    spans.push({
      start: s.start,
      end: s.end,
      text: s.text,
      reason: `Almost exactly the average sentence length (${s.words} words) with no specific detail.`,
      severity: "low",
    });
  }

  const band: StyleReport["band"] =
    footprint >= 62 ? "elevated" : footprint >= 40 ? "watch" : "clear";

  return {
    words: doc.words,
    sentences: doc.sentences.length,
    paragraphs: doc.paragraphs.length,
    signals,
    footprint,
    band,
    spans,
    vocabulary: {
      uniqueRatio: Math.round(uniqueRatio * 1000) / 1000,
      averageWordLength: Math.round(averageWordLength * 10) / 10,
      longWordRatio: Math.round(longWordRatio * 1000) / 1000,
    },
    sentenceStats: stats,
  };
}
