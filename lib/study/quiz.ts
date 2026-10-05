export type Question = {
  q: string;
  type: string;
  answer: string;
  options?: string[];
  acceptedAnswers?: string[];
  rubricVersion?: number;
  explanation?: string;
  hint?: string;
  topic?: string;
};
/** Scoring content, including accepted variants, determines identity. */
export function questionId(q: Question, _index?: number) {
  let hash = 2166136261,
    second = 2246822519;
  const content = JSON.stringify([
    q.type,
    q.q,
    q.answer,
    q.options || [],
    acceptedVariants(q.acceptedAnswers).sort(),
    q.rubricVersion || 0,
  ]);
  for (const c of content) {
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    second = Math.imul(second ^ c.charCodeAt(0), 3266489917);
  }
  return `q-${(hash >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}
export const quizVersion = (questions: Question[]) =>
  questions.map(questionId).sort().join("|");
export function normalizeAnswer(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?;,]+$/g, "");
}
export function answerCorrect(q: Question, answer: string) {
  return q.type === "mcq"
    ? q.answer === answer
    : [q.answer, ...acceptedVariants(q.acceptedAnswers)].some(
        (a) => normalizeAnswer(a) === normalizeAnswer(answer),
      );
}
/** Model output is untrusted; an invalid variant must never influence scoring. */
export function acceptedVariants(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter(
          (a): a is string =>
            typeof a === "string" && a.trim().length > 0 && a.length <= 160,
        )
        .map((a) => a.trim()),
    ),
  ].slice(0, 8);
}
