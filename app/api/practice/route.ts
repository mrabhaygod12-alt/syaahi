import { createHash } from "node:crypto";
import { readState, mutateState } from "@/lib/study/state";
import { apiHandler } from "@/lib/api-handler";
import { accessRole } from "@/lib/study/collaboration";
import { getJob, updateJob } from "@/lib/jobs/store";
import { currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { authError } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { chatWithFallback } from "@/lib/ai/router";
import { languageLine, normalizeLang } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

export interface QuizQ {
  q: string;
  type: "mcq" | "blank" | "short";
  options?: string[];
  answer: string;
  hint?: string;
  topic?: string;
  explanation?: string;
}
export interface Flash {
  front: string;
  back: string;
}

async function handlePOST(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "practice", 8, 60000);
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  const pages: Array<{ topic: string; markdown: string }> = Array.isArray(
    body.pages,
  )
    ? body.pages
        .slice(0, 48)
        .filter(
          (p: any) =>
            typeof p?.topic === "string" && typeof p?.markdown === "string",
        )
        .map((p: any) => ({
          topic: p.topic.slice(0, 160),
          markdown: p.markdown.slice(0, 20000),
        }))
    : [];
  const owned =
    typeof body.jobId === "string" ? await getJob(body.jobId) : null;
  if (
    body.jobId &&
    (!owned || !(await accessRole(owned, (await currentUser(req))!.id)))
  )
    return NextResponse.json({ error: "Unknown lesson." }, { status: 404 });
  if (
    owned?.practice &&
    owned.user !== (await currentUser(req))!.id &&
    body.regenerate !== true
  )
    return NextResponse.json({ ...owned.practice, provider: "saved" });
  if (owned && owned.user !== (await currentUser(req))!.id)
    return NextResponse.json(
      { error: "Ask the lesson owner to generate or rebuild practice." },
      { status: 403 },
    );
  if (owned) pages.splice(0, pages.length, ...owned.pages);
  const lang = normalizeLang(body.language);
  if (!pages.length)
    return NextResponse.json({ error: "Provide { pages }." }, { status: 400 });
  const size = Math.max(
    5,
    Math.min(
      30,
      Number(body.size) || Math.min(30, Math.max(8, pages.length * 3)),
    ),
  );
  const format = ["mcq", "blank", "short", "mixed"].includes(body.format)
    ? body.format
    : "mcq";
  const difficulty = ["foundation", "standard", "challenge"].includes(
    body.difficulty,
  )
    ? body.difficulty
    : "standard";
  const focus = String(body.focus || "").slice(0, 160);
  const cardCount = Math.min(36, Math.max(6, pages.length * 3));
  const cacheKey =
    "practice:" +
    createHash("sha256")
      .update(
        JSON.stringify([
          owned?.id,
          pages,
          lang,
          size,
          format,
          difficulty,
          focus,
          cardCount,
        ]),
      )
      .digest("hex");
  const owner = (await currentUser(req))!.id;
  if (body.regenerate !== true) {
    const saved = await readState<any>(owner, cacheKey, null);
    if (saved) return NextResponse.json({ ...saved, cached: true });
  }
  const sectionBudget = Math.max(350, Math.floor(18000 / pages.length));
  const material = pages
    .map((p) => `## ${p.topic}\n${p.markdown.slice(0, sectionBudget)}`)
    .join("\n\n");

  let text: string;

  try {
    const r = await chatWithFallback(
      [
        {
          role: "system",
          content:
            `You write exam practice from the notes. ${languageLine(lang)} STRICT JSON only, no fences:\n` +
            '{"quiz":[{"q":"...","type":"mcq","options":["option text","...","...","..."],"answer":"option text","hint":"...","topic":"...","explanation":"why the correct option follows from the notes"}],' +
            '"flashcards":[{"front":"...","back":"..."}]}\n' +
            `Exactly ${size} quiz items in format ${format} + ${cardCount} flashcards. Each flashcard must test a single meaningful idea; distribute cards across all supplied topics and avoid duplicate or trivial cards. Mixed means a balance of mcq, blank, and short. For mcq use 4 options and answer MUST equal an option. For blank include ___ in the question and a brief exact answer, with no options. For short ask for a precise term, not an essay, and omit options. ` +
            `Answerable ONLY from the notes. Difficulty: ${difficulty}. Focus: ${focus || "all supplied topics"}. Include a clear explanation for every answer. Hints nudge, they do not leak the answer.`,
        },
        { role: "user", content: material },
      ],
      { maxTokens: 9000 },
    );
    text = r.text;
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Practice generation is temporarily unavailable. Please retry.",
      },
      { status: e.message?.includes("NO_KEYS") ? 402 : 502 },
    );
  }

  try {
    const m = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no-json");
    const j = JSON.parse(m[0]);
    const quiz: QuizQ[] = (Array.isArray(j.quiz) ? j.quiz : [])
      .filter(
        (q: any) =>
          typeof q.q === "string" &&
          q.q.trim().length > 8 &&
          typeof q.explanation === "string" &&
          q.explanation.trim().length > 10 &&
          typeof q.answer === "string" &&
          q.answer.trim().length > 0 &&
          (q.type === "mcq"
            ? Array.isArray(q.options) &&
              q.options.length === 4 &&
              new Set(q.options).size === 4 &&
              q.options.every((o: unknown) => typeof o === "string") &&
              q.options.includes(q.answer)
            : ["blank", "short"].includes(q.type)),
      )
      .filter(
        (q: QuizQ, i: number, all: QuizQ[]) =>
          all.findIndex(
            (x) => x.q.trim().toLowerCase() === q.q.trim().toLowerCase(),
          ) === i,
      )
      .slice(0, size);
    const flashcards: Flash[] = (
      Array.isArray(j.flashcards) ? j.flashcards : []
    )
      .filter(
        (f: any) =>
          typeof f.front === "string" &&
          f.front.trim().length > 5 &&
          typeof f.back === "string" &&
          f.back.trim().length > 2,
      )
      .filter(
        (f: Flash, i: number, all: Flash[]) =>
          all.findIndex(
            (x) =>
              x.front.trim().toLowerCase() === f.front.trim().toLowerCase(),
          ) === i,
      )
      .slice(0, cardCount);
    if (!quiz.length) throw new Error("empty-quiz");
    if (owned && owned.status === "done")
      await updateJob(owned.id, { practice: { quiz, flashcards } });
    const result = {
      quiz,
      flashcards,
      quality: {
        requestedQuestions: size,
        acceptedQuestions: quiz.length,
        requestedCards: cardCount,
        acceptedCards: flashcards.length,
      },
      warning:
        quiz.length < size || flashcards.length < cardCount
          ? "Some generated items did not pass quality checks. Only accepted items are shown."
          : null,
    };
    await mutateState(owner, cacheKey, result, () => result);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Practice generation returned malformed output — retry once." },
      { status: 502 },
    );
  }
}

export const POST = apiHandler(handlePOST);
