import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { listPublicStories } from "@/lib/writing/stories";

async function handleGET() {
  const stories = await listPublicStories();
  return NextResponse.json({
    stories: stories.map((story) => ({
      slug: story.slug,
      title: story.title,
      summary: story.summary,
      body: story.body,
      tags: story.tags,
      authorName: story.authorName,
      creatorSlug: story.creatorSlug,
      publishedAt: story.publishedAt,
    })),
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export const GET = apiHandler(handleGET);
