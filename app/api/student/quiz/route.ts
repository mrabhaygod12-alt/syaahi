import { ownerMetric } from "@/lib/growth/metrics";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { getJob } from "@/lib/jobs/store";
import { accessRole } from "@/lib/study/collaboration";
import { readState, mutateState } from "@/lib/study/state";
import {
  answerCorrect,
  questionId,
  quizVersion,
  attemptQuestionIds,
  type QuizAttempt,
} from "@/lib/study/quiz";
import { studyActivity } from "@/lib/study/hub";
const empty = (): QuizAttempt | null => null;
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
    version = quizVersion(questions),
    requestedMode = b.mode === "exam" ? "exam" : "practice";
  if (new Set(questions.map(questionId)).size !== questions.length)
    return NextResponse.json(
      {
        error:
          "This quiz contains duplicate questions. Ask its owner to rebuild practice.",
      },
      { status: 409 },
    );
  try {
    const attempt = await mutateState<QuizAttempt | null>(
      owner,
      `quiz:${job.id}`,
      null,
      (old) => {
        if (b.action === "start") {
          if (
            old &&
            !old.submitted &&
            old.version === version &&
            old.mode === requestedMode &&
            (old.scope || "all") === (b.scope === "missed" ? "missed" : "all")
          )
            return old;
          if (old && !old.submitted && old.version === version)
            throw new Error(
              "Finish your current attempt before changing modes.",
            );
          let questionIds = questions.map(questionId);
          if (b.scope === "missed") {
            if (!old?.submitted || old.version !== version)
              throw new Error(
                "Submit a result before retrying missed questions.",
              );
            const previousIds = new Set(attemptQuestionIds(old, questions));
            questionIds = questions
              .filter(
                (q) =>
                  previousIds.has(questionId(q)) &&
                  !answerCorrect(q, old.answers[questionId(q)] || ""),
              )
              .map(questionId);
            if (!questionIds.length)
              throw new Error(
                "No missed questions to retry. Start a full attempt.",
              );
          }
          return {
            id: randomUUID(),
            mode: requestedMode,
            version,
            answers: {},
            questionIds,
            scope: b.scope === "missed" ? "missed" : "all",
            cursor: questionIds[0],
            submitted: false,
            correct: 0,
            total: questionIds.length,
            weak: [],
            at: new Date().toISOString(),
          };
        }
        if (!old || old.id !== b.attempt || old.version !== version)
          throw new Error("Quiz changed. Reopen it before answering.");
        const selectedIds = new Set(attemptQuestionIds(old, questions));
        const selectedQuestions = questions.filter((q) =>
          selectedIds.has(questionId(q)),
        );
        if (b.action === "position") {
          if (typeof b.question !== "string" || !selectedIds.has(b.question))
            throw new Error("Choose a question in this attempt.");
          old.cursor = b.question;
          return old;
        }
        if (b.action === "answer") {
          if (old.submitted)
            throw new Error(
              "Submitted results are locked. Start another attempt.",
            );
          const index = questions.findIndex(
            (q, i) => questionId(q, i) === b.question,
          );
          if (index < 0 || !selectedIds.has(b.question))
            throw new Error("Question not found in this attempt.");
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
          old.cursor = b.question;
        } else if (b.action === "submit") {
          if (old.submitted) return old;
          if (selectedQuestions.some((q) => !old.answers[questionId(q)]))
            throw new Error("Answer every question before submitting.");
          old.correct = selectedQuestions.filter((q) =>
            answerCorrect(q, old.answers[questionId(q)]),
          ).length;
          old.total = selectedQuestions.length;
          old.weak = [
            ...new Set(
              selectedQuestions
                .filter((q) => !answerCorrect(q, old.answers[questionId(q)]))
                .map((q) => q.topic || q.q),
            ),
          ];
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
      try {
        await ownerMetric(owner, "quiz_used", attempt.id);
      } catch {
        console.warn("Quiz measurement unavailable");
      }
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
