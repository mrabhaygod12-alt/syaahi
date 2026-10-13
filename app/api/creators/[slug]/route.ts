import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { creatorStoriesWithPins } from "@/lib/writing/pins";
import { publicAuthorIdentity } from "@/lib/writing/author-identity";

async function handleGET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const { stories, pinned } = await creatorStoriesWithPins(slug);
  const identity = await publicAuthorIdentity(slug);
  if (!identity)
    return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  return NextResponse.json(
    {
      creator: identity.profile,
      stories: stories.map((story) => ({
        slug: story.slug,
        title: story.title,
        summary: story.summary,
        tags: story.tags,
        publishedAt: story.publishedAt,
        ...(pinned.has(story.id) ? { pinned: true } : {}),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = apiHandler(handleGET);
