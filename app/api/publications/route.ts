import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import {
  listPublicStories,
  getPublicStory,
  listPublicStoriesByCreator,
} from "@/lib/writing/stories";
import { publicGuide } from "@/lib/writing/public";

async function handleGET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug"),
    creator = req.nextUrl.searchParams.get("creator");
  const story = slug ? await getPublicStory(slug) : null;
  const stories = slug
    ? story
      ? [story]
      : []
    : creator
      ? await listPublicStoriesByCreator(creator)
      : await listPublicStories();
  return NextResponse.json(
    {
      stories: stories.map(publicGuide),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = apiHandler(handleGET);
