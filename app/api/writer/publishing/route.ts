import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { writerAccess } from "@/lib/writing/profile";
import { rateLimit } from "@/lib/ratelimit";
import {
  beginRevision,
  unpublishStory,
  cancelStorySchedule,
  PublicationError,
} from "@/lib/writing/publishing";
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await currentUser(req);
  if (!user)
    return NextResponse.json(
      { error: "Sign in to your writer account." },
      { status: 401 },
    );
  const denied =
    (await writerAccess(user.id)) ||
    (await rateLimit(req, "writer-publishing", 15, 60000));
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  if (
    !b ||
    !["revise", "unpublish", "cancel_schedule"].includes(b.action) ||
    typeof b.id !== "string" ||
    b.id.length > 80 ||
    typeof b.expectedUpdatedAt !== "string" ||
    b.expectedUpdatedAt.length > 50
  )
    return NextResponse.json(
      { error: "Choose a story action and its current saved revision." },
      { status: 400 },
    );
  try {
    const handler =
      b.action === "revise"
        ? beginRevision
        : b.action === "unpublish"
          ? unpublishStory
          : cancelStorySchedule;
    return NextResponse.json({
      story: await handler(user.id, b.id, b.expectedUpdatedAt),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Could not change publication.",
      },
      { status: e instanceof PublicationError ? e.status : 409 },
    );
  }
});
