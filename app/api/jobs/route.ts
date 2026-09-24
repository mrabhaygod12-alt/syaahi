import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { researchTopic } from "@/lib/research";
import { kickWorker } from "@/lib/jobs/worker";
import { NextRequest, NextResponse } from "next/server";
import { createJob, listJobs, clearFailed } from "@/lib/jobs/store";
import { chatWithFallback } from "@/lib/ai/router";
import { normalizeLang } from "@/lib/ai/prompts";
import { balance } from "@/lib/credits/store";
import { rateLimit } from "@/lib/ratelimit";
import {
  heuristicLessonPlan,
  parsePlanJson,
  planPromptForKind,
  suggestedPageCount,
  type SourceKind,
} from "@/lib/lesson/plan";

export const runtime = "nodejs";

const KINDS: SourceKind[] = ["topic", "syllabus", "youtube", "upload"];

function asKind(v: unknown): SourceKind {
  return KINDS.includes(v as SourceKind) ? (v as SourceKind) : "topic";
}

// POST /api/jobs { topics[], style, context?, brief?, sourceKind?, intelligentPlan? }
// Intelligence planner always runs (heuristic + optional AI) so page count is coverage-based.
async function handlePOST(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!.id;
  const limited = await rateLimit(req, "jobs", 30, 60_000);
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  if (body.action === "clear-failed") {
    const cleared = await clearFailed(user);
    return NextResponse.json({ ok: true, cleared });
  }
  const rawTopics: string[] = (Array.isArray(body.topics) ? body.topics : [])
    .map((t: any) => String(t).trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 24);
  const style: "concise" | "detailed" =
    body.style === "concise" ? "concise" : "detailed";
  if (!rawTopics.length)
    return NextResponse.json(
      { error: "Add at least 1 topic." },
      { status: 400 },
    );

  const sourceKind = asKind(body.sourceKind);
  const skipAi = body.intelligentPlan === false;
  const language = normalizeLang(body.language);
  let sourceContext = String(body.context ?? "").slice(0, 100000);
  const sources =
    !sourceContext && body.research !== false
      ? await researchTopic(rawTopics.join(" "))
      : [];
  if (sources.length)
    sourceContext = sources
      .map((s) => `[${s.id}] ${s.title}\nURL: ${s.url}\n${s.excerpt}`)
      .join("\n\n");
  const researchNote = sources.length
    ? `Sources retrieved: ${sources.length}. `
    : sourceContext
      ? "Based on supplied material. "
      : "No external evidence retrieved; general-knowledge notes. ";
  const planInput = {
    rawTopics,
    sourceKind,
    style,
    context: sourceContext,
    durationSeconds: Number(body.durationSeconds) || undefined,
    language,
  };

  const fallback = heuristicLessonPlan(planInput);
  let topics = fallback.topics;
  let planNote = researchNote + fallback.note;

  // Fast credit pre-check on the instant heuristic budget — a broke user gets
  // an instant 402 instead of waiting ~2min for the AI planner first.
  const have = await balance(user);
  if (have <= 0) {
    return NextResponse.json(
      {
        error: "You are out of credits. Buy a pack to generate.",
        shortage: { have: 0, need: fallback.topics.length },
        plannedTotal: fallback.topics.length,
        plan: planNote,
      },
      { status: 402 },
    );
  }

  if (
    !skipAi &&
    (suggestedPageCount(planInput) > rawTopics.length ||
      sourceContext.length > 12000)
  ) {
    try {
      const budget = suggestedPageCount(planInput);
      const planRes = await chatWithFallback(
        planPromptForKind(planInput, budget),
        { maxTokens: 1600 },
      );
      const parsed = parsePlanJson(planRes.text);
      if (parsed && parsed.topics.length >= 1) {
        topics = parsed.topics;
        planNote =
          researchNote +
          (parsed.reason ||
            `AI planner: ${topics.length} pages (${planRes.provider}/${planRes.model}).`);
      }
    } catch {
      /* keep heuristic */
    }
  }

  const partial = false;
  if (topics.length > have)
    return NextResponse.json(
      {
        error: `This plan needs ${topics.length} credits; you have ${have}. Reduce topics or top up.`,
        shortage: { have, need: topics.length },
        topics,
        plannedTotal: topics.length,
      },
      { status: 402 },
    );

  let job;
  try {
    job = await createJob(user, topics, style, {
      context: sourceContext,
      brief: String(body.brief ?? ""),
      sourceUrl: String(body.sourceUrl ?? ""),
      sourceKind,
      sourceName: String(body.sourceName ?? ""),
      planNote,
      language,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to reserve credits.",
      },
      { status: 402 },
    );
  }
  kickWorker();
  return NextResponse.json(
    {
      jobId: job.id,
      total: job.total,
      plannedTotal: job.plannedTotal,
      credits: job.total,
      plan: planNote,
      partial,
    },
    { status: 202 },
  );
}

async function handleGET(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!.id;
  kickWorker();
  const jobs = await listJobs(user);
  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title ?? null,
      topics: j.topics,
      style: j.style,
      status: j.status,
      done: j.pages.length,
      total: j.total,
      plannedTotal: j.plannedTotal,
      creditsSpent: j.creditsSpent,
      createdAt: j.createdAt,
      error: j.error,
      sourceUrl: j.sourceUrl,
      sourceKind: j.sourceKind,
      shortage: j.shortage,
      practice: j.practice
        ? {
            quiz: j.practice.quiz.map((q) => ({ q: q.q })),
            flashcards: j.practice.flashcards.map((c) => ({ front: c.front })),
          }
        : null,
    })),
  });
}

export const POST = apiHandler(handlePOST);
export const GET = apiHandler(handleGET);
