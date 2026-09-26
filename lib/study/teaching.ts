import { createHash } from "node:crypto";
export const learningGoals = [
  "Exam preparation",
  "Assignment",
  "Learn something new",
  "Other",
] as const;
export interface TeachingUnit {
  objective: string;
  explanation: string;
  example: string;
  question: string;
  options: string[];
  answer: number;
  feedback: string;
}
export interface LearningProgress {
  completed: number[];
  cursor: number;
  phase?: number;
  attempts?: Record<string, number>;
}
export const emptyLearningProgress = (): LearningProgress => ({
  completed: [],
  cursor: 0,
});
export function teachingKey(
  pages: Array<{ markdown: string }>,
  goal: string,
  language: string,
) {
  return createHash("sha256")
    .update(JSON.stringify([pages.map((p) => p.markdown), goal, language]))
    .digest("hex")
    .slice(0, 24);
}
export function parseTeaching(text: string): TeachingUnit {
  const value = JSON.parse(
    text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, ""),
  );
  for (const key of [
    "objective",
    "explanation",
    "example",
    "question",
    "feedback",
  ]) {
    if (
      typeof value[key] !== "string" ||
      !value[key].trim() ||
      value[key].length > 3500
    )
      throw new Error("Invalid teaching content");
  }
  if (
    !Array.isArray(value.options) ||
    value.options.length !== 4 ||
    value.options.some(
      (v: unknown) => typeof v !== "string" || !v.trim() || v.length > 500,
    ) ||
    new Set(value.options).size !== 4 ||
    !Number.isInteger(value.answer) ||
    value.answer < 0 ||
    value.answer > 3
  )
    throw new Error("Invalid checkpoint");
  return {
    objective: value.objective,
    explanation: value.explanation,
    example: value.example,
    question: value.question,
    options: value.options,
    answer: value.answer,
    feedback: value.feedback,
  };
}
export function publicTeaching(unit: TeachingUnit) {
  const { answer, feedback, ...visible } = unit;
  return visible;
}
export function recordCheckpoint(
  progress: LearningProgress,
  index: number,
  correct: boolean,
): LearningProgress {
  if (progress.completed.includes(index)) return progress;
  const attempts = {
    ...progress.attempts,
    [index]: (progress.attempts?.[index] || 0) + 1,
  };
  return {
    ...progress,
    attempts,
    completed: correct
      ? [...progress.completed, index].sort((a, b) => a - b)
      : progress.completed,
    cursor: correct ? index + 1 : progress.cursor,
    phase: correct ? 0 : progress.phase,
  };
}
