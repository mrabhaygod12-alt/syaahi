import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import {
  listPublicStories,
  getPublicStory,
  listPublicStoriesByCreator,
} from "@/lib/writing/stories";
import { publicStoryViews } from "@/lib/writing/public";

async function handleGET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug"),
    related = req.nextUrl.searchParams.get("related"),
    creator = req.nextUrl.searchParams.get("creator");
  const story = slug ? await getPublicStory(slug) : null;
  const stories = related
    ? await (
        await import("@/lib/writing/recommendations")
      ).relatedPublicStories(related)
    : slug
      ? story
        ? [story]
        : []
      : creator
        ? await listPublicStoriesByCreator(creator)
        : await listPublicStories();
  return NextResponse.json(
    {
      stories: await publicStoryViews(stories),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = apiHandler(handleGET);
