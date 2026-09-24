import { apiHandler } from "@/lib/api-handler";
import { readState, mutateState } from "@/lib/study/state";
import { accessRole } from "@/lib/study/collaboration";
import { reviseJob } from "@/lib/jobs/store";
import { isPdfTemplate } from "@/lib/pdf/templates";
import { authError, currentUser } from "@/lib/auth/server";
import { resumeJob } from "@/lib/jobs/store";
import { kickWorker } from "@/lib/jobs/worker";
import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob, deleteJob } from "@/lib/jobs/store";

export const runtime = "nodejs";

// GET /api/jobs/:id → full status incl. completed pages (poll every 2s while working)
async function handleGET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await authError(req);
  if (denied) return denied;
  const job = await getJob((await params).id);
  const role = job ? await accessRole(job, (await currentUser(req))!.id) : null;
  if (!job || !role)
    return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  if (new URL(req.url).searchParams.get("revision") === "1")
    return NextResponse.json(
      {
        revision: job.revision || 0,
        status: job.status,
        pages: job.pages.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  kickWorker();
  return NextResponse.json(
    {
      ...job,
      accessRole: role,
      ...(role === "owner"
        ? {}
        : {
            context: null,
            brief: null,
            sourceUrl: null,
            sourceName: null,
            progress: await readState(
              (await currentUser(req))!.id,
              `progress:${job.id}`,
              { completed: [] },
            ),
          }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// DELETE /api/jobs/:id → remove a lesson (failed tests, junk fragments, anything).
async function handleDELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await authError(req);
  if (denied) return denied;
  const owned = await getJob((await params).id);
  if (!owned || owned.user !== (await currentUser(req))!.id)
    return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  kickWorker();
  const ok = await deleteJob((await params).id);
  if (!ok) return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// POST /api/jobs/:id { action: 'resume' } → restart stuck/partial jobs from
// where they stopped (saved pages kept, no double-charge).
async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await authError(req);
  if (denied) return denied;
  const owned = await getJob((await params).id);
  const role = owned
    ? await accessRole(owned, (await currentUser(req))!.id)
    : null;
  if (!owned || !role)
    return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (
    role !== "owner" &&
    body.action !== "progress" &&
    (role !== "editor" || body.action !== "edit-page")
  )
    return NextResponse.json(
      { error: "This action requires owner access." },
      { status: 403 },
    );
  kickWorker();
  if (body.action === "progress") {
    const completed: number[] = Array.isArray(body.completed)
      ? (body.completed as unknown[])
          .map((n) => Number(n))
          .filter(
            (n): n is number =>
              Number.isFinite(n) && n >= 0 && n === Math.floor(n),
          )
      : [];
    const lastRoom =
      typeof body.lastRoom === "string"
        ? body.lastRoom.slice(0, 32)
        : undefined;
    const pdfTemplate = isPdfTemplate(body.pdfTemplate)
      ? body.pdfTemplate
      : undefined;
    if (role !== "owner") {
      const progress = await mutateState(
        (await currentUser(req))!.id,
        `progress:${owned.id}`,
        { completed: [] as number[], lastRoom },
        () => ({
          completed: Array.from(new Set(completed)).filter(
            (n) => n < owned.pages.length,
          ),
          lastRoom,
        }),
      );
      return NextResponse.json({ ok: true, progress });
    }
    const updated = await updateJob((await params).id, {
      progress: {
        completed: Array.from(new Set(completed)).slice(0, 48),
        lastRoom,
      },
      ...(pdfTemplate ? { pdfTemplate: pdfTemplate as any } : {}),
    });
    return NextResponse.json({
      ok: true,
      progress: updated?.progress,
      pdfTemplate: updated?.pdfTemplate,
    });
  }
  if (body.action === "append-page" || body.action === "edit-page") {
    const markdown =
      typeof body.markdown === "string" ? body.markdown.trim() : "";
    if (markdown.length < 20 || markdown.length > 20000)
      return NextResponse.json(
        { error: "Use 20–20,000 characters." },
        { status: 400 },
      );
    const index = Number(body.index);
    try {
      const updated = await reviseJob((await params).id, (job) => {
        if (job.status === "working" || job.status === "queued")
          throw new Error("Wait for generation to finish.");
        if (body.action === "edit-page") {
          if (Number(body.revision) !== (job.revision || 0))
            throw new Error(
              "This section changed since you opened it. Refresh before saving to avoid overwriting another edit.",
            );
          if (!Number.isInteger(index) || !job.pages[index])
            throw new Error("Unknown section.");
          job.pages[index] = { ...job.pages[index], markdown };
          job.practice = null;
          job.revision = (job.revision || 0) + 1;
        } else {
          if (job.pages.length >= 48)
            throw new Error("This lesson has reached its section limit.");
          const topic = String(body.topic || "Chat Q&A").slice(0, 120);
          job.pages.push({
            topic,
            markdown,
            provider: "chat-export",
            model: "thread",
          });
          job.topics.push(topic);
          job.total++;
          job.plannedTotal++;
          job.revision = (job.revision || 0) + 1;
          job.practice = null;
        }
        return job;
      });
      return NextResponse.json({
        ok: true,
        pages: updated?.pages.length,
        total: updated?.total,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Edit failed." },
        { status: 409 },
      );
    }
  }
  if (body.action !== "resume")
    return NextResponse.json(
      { error: "action must be 'resume', 'progress' or 'append-page'." },
      { status: 400 },
    );
  const job = await getJob((await params).id);
  if (!job)
    return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  if (job.status === "done" || job.pages.length >= job.total) {
    return NextResponse.json(
      { error: "Job already complete." },
      { status: 400 },
    );
  }
  // A second resume while a worker is already running would duplicate pages
  // and double-charge. The client should poll instead.
  if (job.status === "working") {
    return NextResponse.json(
      { error: "Job is already running — keep polling GET /api/jobs/:id." },
      { status: 409 },
    );
  }
  try {
    if (!(await resumeJob((await params).id)))
      return NextResponse.json(
        { error: "Job cannot be resumed." },
        { status: 409 },
      );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Insufficient credits.",
      },
      { status: 402 },
    );
  }
  kickWorker();
  return NextResponse.json(
    { ok: true, resumeFrom: job.pages.length, total: job.total },
    { status: 202 },
  );
}

export const GET = apiHandler(handleGET);
export const DELETE = apiHandler(handleDELETE);
export const POST = apiHandler(handlePOST);
