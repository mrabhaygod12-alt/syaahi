import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { writerAccess, writerProfile } from "@/lib/writing/profile";
import {
  creatorAnalytics,
  listStories,
  saveStory,
  deleteDraft,
} from "@/lib/writing/stories";
import { writerReaderStats } from "@/lib/writing/social";

async function handleGET(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const access = await writerAccess(user.id);
  if (access) return access;
  const profile = (await writerProfile(user.id))!;
  return NextResponse.json({
    stories: (await listStories(user.id)).map((story) => ({
      ...story,
      authorName: profile.name,
    })),
    analytics: {
      ...(await creatorAnalytics(user.id)),
      ...(await writerReaderStats(user.id)),
    },
  });
}

async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "stories", 20, 60_000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const user = (await currentUser(req))!;
    const access = await writerAccess(user.id);
    if (access) return access;
    const profile = (await writerProfile(user.id))!;
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
      authorName: profile.name,
      creatorSlug: profile.slug,
      document: body.document,
      expectedUpdatedAt:
        typeof body.expectedUpdatedAt === "string"
          ? body.expectedUpdatedAt
          : undefined,
      canonicalUrl:
        typeof body.canonicalUrl === "string" ? body.canonicalUrl : undefined,
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
export const DELETE = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "story-delete", 10, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const access = await writerAccess(user.id);
  if (access) return access;
  try {
    await deleteDraft(user.id, req.nextUrl.searchParams.get("id") || "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to delete draft." },
      { status: 400 },
    );
  }
});
