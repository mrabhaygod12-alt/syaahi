import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { listPublicStories, getPublicStory } from "@/lib/writing/stories";
import { publicStoryViews } from "@/lib/writing/public";
import { creatorStoriesWithPins } from "@/lib/writing/pins";

async function handleGET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug"),
    related = req.nextUrl.searchParams.get("related"),
    creator = req.nextUrl.searchParams.get("creator");
  const story = slug ? await getPublicStory(slug) : null;
  if (creator && !related && !slug) {
    const { stories, pinned } = await creatorStoriesWithPins(creator);
    return NextResponse.json(
      {
        stories: (await publicStoryViews(stories)).map((s, i) => ({
          ...s,
          ...(pinned.has(stories[i].id) ? { pinned: true } : {}),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const stories = related
    ? await (
        await import("@/lib/writing/recommendations")
      ).relatedPublicStories(related)
    : slug
      ? story
        ? [story]
        : []
      : await listPublicStories();
  return NextResponse.json(
    {
      stories: await publicStoryViews(stories),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = apiHandler(handleGET);
