import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { getAssignment, updateOwnedAssignment } from "@/lib/assignments/store";
import { generateAssignmentSection } from "@/lib/assignments/engine";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const maxDuration = 60;

function safe(
  assignment: NonNullable<Awaited<ReturnType<typeof getAssignment>>>,
) {
  const { user, ...rest } = assignment;
  return rest;
}

async function handleGET(req: NextRequest, context: Context) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "assignment-read", 60, 60_000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const { id } = await context.params;
  const assignment = await getAssignment(id, user.id);
  return assignment
    ? NextResponse.json({ assignment: safe(assignment) })
    : NextResponse.json({ error: "Assignment not found." }, { status: 404 });
}

async function handlePATCH(req: NextRequest, context: Context) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "assignment-edit", 12, 60_000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  if (user.workspace === "writer")
    return NextResponse.json(
      { error: "Switch to your student workspace to edit this assignment." },
      { status: 403 },
    );
  const { id } = await context.params;
  const raw = await req.text();
  if (raw.length > 4000)
    return NextResponse.json(
      { error: "Edit request is too large." },
      { status: 413 },
    );
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid edit request." },
      { status: 400 },
    );
  }
  const current = await getAssignment(id, user.id);
  if (!current)
    return NextResponse.json(
      { error: "Assignment not found." },
      { status: 404 },
    );

  if (body.action === "outline") {
    const outline = Array.isArray(body.outline)
      ? body.outline.map((item: unknown) =>
          typeof item === "string" ? item.trim().slice(0, 100) : "",
        )
      : [];
    if (
      current.status !== "outline" ||
      outline.length !== current.pageCount ||
      outline.some((item: string) => item.length < 3)
    )
      return NextResponse.json(
        {
          error:
            "The saved outline must have one clear heading for each requested content page.",
        },
        { status: 400 },
      );
    const updated = await updateOwnedAssignment(id, user.id, (old) =>
      old.status === "outline"
        ? { ...old, outline, updatedAt: new Date().toISOString() }
        : old,
    );
    return updated
      ? NextResponse.json({ assignment: safe(updated) })
      : NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  if (body.action === "approve") {
    if (current.status !== "outline" || current.phase !== "draft")
      return NextResponse.json(
        { error: "Review the generated outline before drafting." },
        { status: 409 },
      );
    const updated = await updateOwnedAssignment(id, user.id, (old) =>
      old.status === "outline"
        ? {
            ...old,
            status: "queued",
            progress: 0,
            error: null,
            updatedAt: new Date().toISOString(),
          }
        : old,
    );
    return updated
      ? NextResponse.json({ assignment: safe(updated) }, { status: 202 })
      : NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  if (body.action === "revise") {
    const reviseDenied = await rateLimit(req, "assignment-revise", 3, 60_000);
    if (reviseDenied) return reviseDenied;
    const sectionIndex = Number(body.sectionIndex);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (
      current.status !== "ready" ||
      !Number.isSafeInteger(sectionIndex) ||
      sectionIndex < 0 ||
      sectionIndex >= current.sections.length ||
      prompt.length < 8 ||
      prompt.length > 900
    )
      return NextResponse.json(
        {
          error:
            "Choose a ready section and enter a revision request from 8–900 characters.",
        },
        { status: 400 },
      );
    if (current.revisionCount >= 10)
      return NextResponse.json(
        {
          error:
            "This assignment has reached its 10-revision limit. Create a fresh draft to continue.",
        },
        { status: 429 },
      );
    const replacement = await generateAssignmentSection(
      current,
      sectionIndex,
      prompt,
    );
    const updated = await updateOwnedAssignment(id, user.id, (old) => {
      if (old.status !== "ready" || old.revisionCount >= 10) return old;
      const sections = [...old.sections];
      sections[sectionIndex] = replacement;
      return {
        ...old,
        sections,
        revisionCount: old.revisionCount + 1,
        updatedAt: new Date().toISOString(),
      };
    });
    return updated
      ? NextResponse.json({ assignment: safe(updated) })
      : NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }
  return NextResponse.json(
    { error: "Choose an outline, approve, or revise action." },
    { status: 400 },
  );
}

export const GET = apiHandler(handleGET);
export const PATCH = apiHandler(handlePATCH);
