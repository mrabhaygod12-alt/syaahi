export type Question = {
  q: string;
  type: string;
  answer: string;
  options?: string[];
  acceptedAnswers?: string[];
  topic?: string;
};
/** Stable within a saved quiz revision, independent of its display order. */
export function questionId(q: Question, index: number) {
  let hash = 2166136261;
  for (const c of q.q + "\n" + q.answer)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `q-${index}-${(hash >>> 0).toString(16)}`;
}
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
    : [q.answer, ...(q.acceptedAnswers || [])].some(
        (a) => normalizeAnswer(a) === normalizeAnswer(answer),
      );
}
