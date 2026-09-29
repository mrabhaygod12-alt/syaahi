import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/ratelimit";
import {
  listContentReports,
  listModerationEvents,
  removeStory,
  resolveContentReport,
  restoreStory,
} from "@/lib/writing/stories";

async function guard(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  if (!isAdmin(await currentUser(req)))
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  return null;
}

async function handleGET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({
    reports: await listContentReports(),
    audit: await listModerationEvents(),
  });
}

async function handlePOST(req: NextRequest) {
  const denied =
    (await guard(req)) ||
    (await rateLimit(req, "admin-moderation", 40, 60_000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const user = (await currentUser(req))!;
  const note = typeof body.note === "string" ? body.note : "";
  try {
    if (
      typeof body.reportId === "string" &&
      (body.action === "dismiss" || body.action === "takedown")
    ) {
      const report = await resolveContentReport(
        body.reportId,
        body.action,
        user.id,
        note,
      );
      return NextResponse.json({ report });
    }
    if (typeof body.storyId === "string" && body.action === "restore") {
      const story = await restoreStory(body.storyId, user.id, note);
      return NextResponse.json({ story });
    }
    if (typeof body.storyId === "string" && body.action === "remove") {
      const story = await removeStory(body.storyId, user.id, note);
      return NextResponse.json({ story });
    }
    return NextResponse.json(
      { error: "Choose a valid moderation action." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Moderation action failed.",
      },
      { status: 400 },
    );
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
