import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { balance } from "@/lib/credits/store";
import { applyAssignmentLaunchGift } from "@/lib/assignments/launch-gift";
import {
  AssignmentQueueFullError,
  createAssignment,
  listAssignments,
} from "@/lib/assignments/store";
import { resolveAssignmentSources } from "@/lib/assignments/research";
import {
  ASSIGNMENT_CREDITS,
  MAX_ASSIGNMENT_PAGES,
  validAssignmentFormat,
  validCitationStyle,
  type Assignment,
} from "@/lib/assignments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicAssignment(assignment: Assignment) {
  const { user, ...safe } = assignment;
  return safe;
}

async function handleGET(req: NextRequest) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "assignments-list", 40, 60_000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  if (user.workspace === "writer")
    return NextResponse.json(
      { error: "Switch to your student workspace to use Assignment Studio." },
      { status: 403 },
    );
  const gift = await applyAssignmentLaunchGift(user.id);
  const assignments = await listAssignments(user.id);
  return NextResponse.json({
    assignments: assignments.map(publicAssignment),
    balance: gift.balance,
    assignmentGiftApplied: gift.granted,
  });
}

async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "assignment-create", 5, 60_000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  if (user.workspace === "writer")
    return NextResponse.json(
      { error: "Switch to your student workspace to use Assignment Studio." },
      { status: 403 },
    );
  const raw = await req.text();
  if (raw.length > 14_000)
    return NextResponse.json(
      { error: "Assignment brief is too large." },
      { status: 413 },
    );
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid assignment request." },
      { status: 400 },
    );
  }
  const id =
    typeof body.id === "string" && /^[a-f0-9-]{36}$/i.test(body.id)
      ? body.id
      : randomUUID();
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const course =
    typeof body.course === "string" ? body.course.trim().slice(0, 140) : "";
  const topic =
    typeof body.topic === "string" ? body.topic.trim().slice(0, 800) : "";
  const instructions =
    typeof body.instructions === "string"
      ? body.instructions.trim().slice(0, 7000)
      : "";
  const pageCount = Number(body.pageCount);
  if (!validAssignmentFormat(body.format))
    return NextResponse.json(
      { error: "Choose a supported assignment format." },
      { status: 400 },
    );
  if (
    !Number.isSafeInteger(pageCount) ||
    pageCount < 1 ||
    pageCount > MAX_ASSIGNMENT_PAGES
  )
    return NextResponse.json(
      { error: `Choose 1–${MAX_ASSIGNMENT_PAGES} content pages.` },
      { status: 400 },
    );
  if (title.length < 4 || topic.length < 4 || instructions.length < 20)
    return NextResponse.json(
      {
        error:
          "Add a title, topic, and assignment instructions (at least 20 characters).",
      },
      { status: 400 },
    );
  if (body.paper !== "ruled" && body.paper !== "plain")
    return NextResponse.json(
      { error: "Choose plain or ruled A4 paper." },
      { status: 400 },
    );
  const font = ["Kalam", "Caveat", "Patrick Hand"].includes(body.font)
    ? body.font
    : "Kalam";
  const citationStyle = validCitationStyle(body.citationStyle)
    ? body.citationStyle
    : "APA 7";
  const requestedDois = Array.isArray(body.dois) ? body.dois.slice(0, 8) : [];
  const sources = requestedDois.length
    ? await resolveAssignmentSources(requestedDois)
    : [];
  if (requestedDois.length && !sources.length)
    return NextResponse.json(
      {
        error:
          "None of the selected DOI records could be verified. Search again or remove the unverified sources.",
      },
      { status: 422 },
    );
  const now = new Date().toISOString();
  const assignment: Assignment = {
    id,
    user: user.id,
    title,
    course,
    topic,
    instructions,
    format: body.format,
    pageCount,
    paper: body.paper,
    font,
    citationStyle,
    sources,
    phase: "outline",
    status: "queued",
    progress: 0,
    outline: [],
    sections: [],
    revisionCount: 0,
    attemptCount: 0,
    error: null,
    chargedCredits: ASSIGNMENT_CREDITS,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
  try {
    const created = await createAssignment(assignment);
    return NextResponse.json(
      {
        assignment: publicAssignment(created),
        balance: await balance(user.id),
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof AssignmentQueueFullError)
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": "30" } },
      );
    if (error instanceof Error && /8 credits|Insufficient/i.test(error.message))
      return NextResponse.json(
        {
          error: `This assignment needs ${ASSIGNMENT_CREDITS} credits. Your balance is ${await balance(user.id)}.`,
        },
        { status: 402 },
      );
    throw error;
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
