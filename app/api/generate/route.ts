import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { createJob, getJob } from "@/lib/jobs/store";
import { processJob } from "@/lib/jobs/runner";
import { normalizeLang } from "@/lib/ai/prompts";
import { rateLimit } from "@/lib/ratelimit";
export const runtime = "nodejs";
async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "generate", 10, 60000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const topics = (Array.isArray(body.topics) ? body.topics : [])
    .map((t: unknown) => String(t).trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 3);
  if (!topics.length)
    return NextResponse.json({ error: "Add a topic." }, { status: 400 });
  let job;
  try {
    job = await createJob(
      (await currentUser(req))!.id,
      topics,
      body.style === "concise" ? "concise" : "detailed",
      {
        context: String(body.context || "").slice(0, 100000),
        language: normalizeLang(body.language),
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to reserve credits.",
      },
      { status: 402 },
    );
  }
  await processJob(job.id);
  const done = await getJob(job.id);
  if (!done?.pages.length)
    return NextResponse.json(
      { error: done?.error || "Generation failed.", jobId: job.id },
      { status: 503 },
    );
  return NextResponse.json({
    pages: done.pages,
    credits: done.creditsSpent,
    jobId: job.id,
    warnings: done.error ? [done.error] : [],
  });
}

export const POST = apiHandler(handlePOST);
