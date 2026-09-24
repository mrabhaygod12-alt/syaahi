export type SourceKind = "topic" | "syllabus" | "youtube" | "upload";

export interface PlanInput {
  rawTopics: string[];
  sourceKind: SourceKind;
  style: "detailed" | "concise";
  context?: string;
  durationSeconds?: number;
  language?: string;
}

export interface LessonPlan {
  topics: string[];
  plannedTotal: number;
  note: string;
}

const MAX = 24;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Decide a coverage-based page budget before AI (and as fallback).
 * Broad topics elaborate (up to 20 pages); the credit-aware route still
 * truncates to balance, so bigger budgets never overcharge. */
export function suggestedPageCount(input: PlanInput): number {
  const { sourceKind, style, rawTopics, context = "", durationSeconds } = input;
  const ctx = context.trim().length;
  const dense = style === "detailed" ? 1 : 0.85;

  if (sourceKind === "youtube") {
    const mins = (durationSeconds ?? 0) / 60;
    const fromTime = mins > 0 ? Math.round(mins * 0.5) : 0;
    const fromChars = ctx ? Math.round(ctx / 400) : 0;
    const n = Math.max(fromTime, fromChars, rawTopics.length || 8);
    return clamp(Math.round(n * dense), 6, 20);
  }

  if (sourceKind === "syllabus" || sourceKind === "upload") {
    const items = rawTopics.filter((t) => t.length > 2);
    if (items.length >= 4)
      return clamp(Math.round(items.length * dense), 4, MAX);
    const fromChars = ctx ? Math.round(ctx / 350) : items.length * 3;
    return clamp(Math.round(Math.max(items.length, fromChars) * dense), 6, MAX);
  }

  const broad =
    /^(biology|chemistry|physics|computer science|data structures|operating systems|computer networks)$/i.test(
      rawTopics[0]?.trim() || "",
    );
  return clamp(broad ? 4 : rawTopics.length, 1, MAX);
}

const CURRICULUM = [
  (t: string) => `Getting Started: ${t}`,
  (t: string) => `What ${t} is and why it matters`,
  (t: string) => `Core concepts of ${t}`,
  (t: string) => `How ${t} works in practice`,
  (t: string) => `Types, models and examples in ${t}`,
  (t: string) => `Key formulas, derivations and solved numericals in ${t}`,
  (t: string) => `Must-draw diagrams and lab work for ${t}`,
  (t: string) => `Common mistakes and exam traps in ${t}`,
  (t: string) => `Previous-year questions and examiner patterns in ${t}`,
  (t: string) => `Tools, methods and defence / method of ${t}`,
  (t: string) => `Real-world applications of ${t}`,
  (t: string) => `Careers, skills and next steps for ${t}`,
  (t: string) => `Quick mnemonics and memory hooks for ${t}`,
  (t: string) => `Revision sheet: ${t}`,
];

export function expandCurriculum(topic: string, pages: number): string[] {
  const t = topic.replace(/\s+/g, " ").trim().slice(0, 80);
  const n = clamp(pages, 4, CURRICULUM.length);
  return CURRICULUM.slice(0, n).map((fn) => fn(t));
}

/** Honest non-AI plan used when the model is unavailable or returns junk. */
export function heuristicLessonPlan(input: PlanInput): LessonPlan {
  const topics = [
    ...new Set(input.rawTopics.map((t) => t.trim()).filter(Boolean)),
  ].slice(0, MAX);
  return {
    topics,
    plannedTotal: topics.length,
    note: `${topics.length} focused sections from your input. PDF sheets are paginated for readability.`,
  };
}

export function planPromptForKind(
  input: PlanInput,
  budget: number,
): Array<{ role: "system" | "user"; content: string }> {
  const kindHint =
    input.sourceKind === "youtube"
      ? `Source is a YouTube lecture. Map pages to what the video actually covers. Aim for about ${budget} pages (duration/coverage), not fluff.`
      : input.sourceKind === "syllabus" || input.sourceKind === "upload"
        ? `Source is a syllabus or uploaded document. Prefer one page per syllabus item. You may split a dense item into 2 pages. Aim for about ${budget} pages.`
        : `Source is a custom topic. Design a teachable course outline of about ${budget} pages covering foundations → core ideas → practice → recap.`;

  return [
    {
      role: "system",
      content:
        "You are a curriculum designer for exam notes. Reply with STRICT JSON only:\n" +
        '{"topics":["page title 1","page title 2",...],"reason":"one sentence"}\n' +
        `Rules: ${kindHint} Between 1 and ${Math.min(budget, 24)} focused titles. Never invent previous-year exam questions or source coverage. Each title is one note section; print pagination is automatic. No numbering prefixes. No duplicate titles.`,
    },
    {
      role: "user",
      content:
        `Kind: ${input.sourceKind}\nStyle: ${input.style}\nSubmitted topics:\n${input.rawTopics.join("\n")}` +
        (input.language && input.language !== "english"
          ? `\nNote language: ${input.language} (titles may stay English, pages will be written in ${input.language})`
          : "") +
        (input.durationSeconds
          ? `\nVideo duration seconds: ${input.durationSeconds}`
          : "") +
        (input.context
          ? `\nSource excerpt:\n${input.context.slice(0, 1800)}`
          : ""),
    },
  ];
}

export function parsePlanJson(
  text: string,
): { topics: string[]; reason: string } | null {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const topics = (Array.isArray(j.topics) ? j.topics : [])
      .map((t: unknown) =>
        String(t)
          .replace(/^\d+[\.)]\s*/, "")
          .trim()
          .slice(0, 120),
      )
      .filter(Boolean)
      .slice(0, MAX);
    if (topics.length < 1) return null;
    return { topics, reason: String(j.reason ?? "").slice(0, 160) };
  } catch {
    return null;
  }
}
