import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/ratelimit";
import { listReviewStories, reviewStory } from "@/lib/writing/stories";

async function guard(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  if (!isAdmin(await currentUser(req)))
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return null;
}
async function handleGET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({ stories: await listReviewStories() });
}
async function handlePOST(req: NextRequest) {
  const denied = (await guard(req)) || (await rateLimit(req, "admin-stories", 30, 60_000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || !["publish", "changes"].includes(body.action))
    return NextResponse.json({ error: "Choose a submitted story and review action." }, { status: 400 });
  try {
    const story = await reviewStory(body.id, body.action, typeof body.note === "string" ? body.note : "");
    return NextResponse.json({ story });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not review story." }, { status: 400 });
  }
}
export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
