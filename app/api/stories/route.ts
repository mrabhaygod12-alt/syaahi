import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  creatorAnalytics,
  listStories,
  saveStory,
} from "@/lib/writing/stories";

async function handleGET(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  return NextResponse.json({
    stories: await listStories(user.id),
    analytics: await creatorAnalytics(user.id),
  });
}

async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "stories", 20, 60_000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const user = (await currentUser(req))!;
    const story = await saveStory(user.id, {
      id: typeof body.id === "string" ? body.id : undefined,
      title: typeof body.title === "string" ? body.title : "",
      summary: typeof body.summary === "string" ? body.summary : "",
      body: typeof body.body === "string" ? body.body : "",
      tags: Array.isArray(body.tags)
        ? body.tags.filter(
            (tag: unknown): tag is string => typeof tag === "string",
          )
        : [],
      submit: body.action === "submit",
      authorName: user.name,
    });
    return NextResponse.json({ story });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save draft.",
      },
      { status: 400 },
    );
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
