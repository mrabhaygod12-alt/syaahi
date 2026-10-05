import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { getJob } from "@/lib/jobs/store";
import { accessRole } from "@/lib/study/collaboration";
import { readState, mutateState } from "@/lib/study/state";
import { answerCorrect, questionId, quizVersion } from "@/lib/study/quiz";
import { studyActivity } from "@/lib/study/hub";
interface Attempt {
  id: string;
  mode: "practice" | "exam";
  version: string;
  answers: Record<string, string>;
  submitted: boolean;
  correct: number;
  total: number;
  weak: string[];
  at: string;
}
const empty = (): Attempt | null => null;
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id,
    job = await getJob(req.nextUrl.searchParams.get("lesson") || "");
  if (!job || !(await accessRole(job, owner)))
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  return NextResponse.json({
    attempt: await readState(owner, `quiz:${job.id}`, empty()),
  });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "quiz-answer", 90, 60000));
  if (denied) return denied;
  const owner = (await currentUser(req))!.id,
    b = await req.json().catch(() => ({})),
    job = typeof b.lesson === "string" ? await getJob(b.lesson) : null;
  if (!job || !(await accessRole(job, owner)) || !job.practice?.quiz.length)
    return NextResponse.json(
      { error: "Saved quiz not found." },
      { status: 404 },
    );
  const questions = job.practice.quiz,
    version = quizVersion(questions);
  if (new Set(questions.map(questionId)).size !== questions.length)
    return NextResponse.json(
      {
        error:
          "This quiz contains duplicate questions. Ask its owner to rebuild practice.",
      },
      { status: 409 },
    );
  try {
    const attempt = await mutateState<Attempt | null>(
      owner,
      `quiz:${job.id}`,
      null,
      (old) => {
        if (b.action === "start") {
          if (
            old &&
            !old.submitted &&
            old.version === version &&
            old.mode === b.mode
          )
            return old;
          if (old && !old.submitted && old.version === version)
            throw new Error(
              "Finish your current attempt before changing modes.",
            );
          return {
            id: randomUUID(),
            mode: b.mode === "exam" ? "exam" : "practice",
            version,
            answers: {},
            submitted: false,
            correct: 0,
            total: questions.length,
            weak: [],
            at: new Date().toISOString(),
          };
        }
        if (!old || old.id !== b.attempt || old.version !== version)
          throw new Error("Quiz changed. Reopen it before answering.");
        if (b.action === "answer") {
          if (old.submitted)
            throw new Error(
              "Submitted results are locked. Start another attempt.",
            );
          const index = questions.findIndex(
            (q, i) => questionId(q, i) === b.question,
          );
          if (index < 0) throw new Error("Question not found.");
          const answer = String(b.answer || "")
            .trim()
            .slice(0, 2000);
          if (!answer) throw new Error("Enter an answer.");
          if (
            questions[index].type === "mcq" &&
            !questions[index].options?.includes(answer)
          )
            throw new Error("Choose a saved option.");
          if (old.mode === "practice" && Object.hasOwn(old.answers, b.question))
            return old;
          old.answers[b.question] = answer;
        } else if (b.action === "submit") {
          if (old.submitted) return old;
          if (questions.some((q, i) => !old.answers[questionId(q, i)]))
            throw new Error("Answer every question before submitting.");
          old.correct = questions.filter((q, i) =>
            answerCorrect(q, old.answers[questionId(q, i)]),
          ).length;
          old.weak = questions
            .filter((q, i) => !answerCorrect(q, old.answers[questionId(q, i)]))
            .map((q) => (q as any).topic || q.q);
          old.submitted = true;
          old.at = new Date().toISOString();
        } else throw new Error("Unknown quiz action.");
        return old;
      },
    );
    if (attempt?.submitted) {
      await mutateState<any>(
        owner,
        "learning",
        { folders: [], reviews: {}, attempts: [] },
        (s) => {
          s.attempts = s.attempts || [];
          if (!s.attempts.some((a: any) => a.id === attempt.id))
            s.attempts = [{ ...attempt, lesson: job.id }, ...s.attempts].slice(
              0,
              100,
            );
          return s;
        },
      );
      await studyActivity(owner, `quiz:${attempt.id}`);
    }
    // Exam mode receives no server feedback until submission.
    const feedback =
      attempt && (attempt.submitted || attempt.mode === "practice")
        ? questions
            .filter((q, i) => Object.hasOwn(attempt.answers, questionId(q, i)))
            .map((q) => ({
              question: questionId(q, questions.indexOf(q)),
              expected: q.answer,
              correct: answerCorrect(
                q,
                attempt.answers[questionId(q, questions.indexOf(q))],
              ),
            }))
        : [];
    return NextResponse.json({ attempt, feedback });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save attempt." },
      { status: 409 },
    );
  }
});
