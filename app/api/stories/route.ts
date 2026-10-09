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
  ownedStory,
} from "@/lib/writing/stories";
import { writerReaderStats } from "@/lib/writing/social";
import { storyActivities } from "@/lib/writing/activity";
import { connectionCounts } from "@/lib/writing/connections";

async function handleGET(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const access = await writerAccess(user.id);
  if (access) return access;
  const profile = (await writerProfile(user.id))!;
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const story = await ownedStory(user.id, id);
    return story
      ? NextResponse.json({ stories: [{ ...story, authorName: profile.name }] })
      : NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }
  const stories = await listStories(user.id);
  const [activity, connections] = await Promise.all([
    storyActivities(stories),
    connectionCounts(user.id),
  ]);
  return NextResponse.json({
    stories: stories.map((story) => ({
      ...story,
      authorName: profile.name,
      activity: activity.get(story.id),
    })),
    analytics: {
      ...(await creatorAnalytics(user.id)),
      ...(await writerReaderStats(user.id)),
      ...connections,
      storyActivity: Object.fromEntries(activity),
      likes: [...activity.values()].reduce((total, a) => total + a.likes, 0),
      comments: [...activity.values()].reduce(
        (total, a) => total + a.comments,
        0,
      ),
    },
  });
}

async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "stories", 20, 60_000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (
    body.id &&
    (typeof body.expectedUpdatedAt !== "string" ||
      body.expectedUpdatedAt.length > 50)
  )
    return NextResponse.json(
      { error: "Include the draft's current saved revision before editing." },
      { status: 409 },
    );
  try {
    const user = (await currentUser(req))!;
    const access = await writerAccess(user.id);
    if (access) return access;
    const profile = (await writerProfile(user.id))!;
    const story = await saveStory(user.id, {
      id: typeof body.id === "string" ? body.id : undefined,
      draftId: typeof body.draftId === "string" ? body.draftId : undefined,
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
      requestedPublishAt:
        body.requestedPublishAt === null
          ? null
          : typeof body.requestedPublishAt === "string"
            ? body.requestedPublishAt
            : undefined,
    });
    return NextResponse.json({ story });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save draft.",
      },
      {
        status:
          error instanceof Error &&
          /changed|already saved|under editorial review/.test(error.message)
            ? 409
            : 400,
      },
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
