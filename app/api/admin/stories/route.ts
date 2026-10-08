import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/ratelimit";
import { listReviewStories, reviewStory } from "@/lib/writing/stories";
import { scheduledStories } from "@/lib/writing/publishing";

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
  const [review, scheduled] = await Promise.all([
    listReviewStories(),
    scheduledStories(),
  ]);
  return NextResponse.json({ stories: [...review, ...scheduled] });
}
async function handlePOST(req: NextRequest) {
  const denied =
    (await guard(req)) || (await rateLimit(req, "admin-stories", 30, 60_000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (
    typeof body.id !== "string" ||
    body.id.length > 80 ||
    typeof body.expectedUpdatedAt !== "string" ||
    body.expectedUpdatedAt.length > 50 ||
    !["publish", "changes"].includes(body.action)
  )
    return NextResponse.json(
      { error: "Choose a submitted story and review action." },
      { status: 400 },
    );
  try {
    const user = (await currentUser(req))!;
    const story = await reviewStory(
      body.id,
      body.action,
      typeof body.note === "string" ? body.note : "",
      user.id,
      body.expectedUpdatedAt,
    );
    return NextResponse.json({ story });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not review story.",
      },
      { status: 409 },
    );
  }
}
export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
