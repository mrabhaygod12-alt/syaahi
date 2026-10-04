import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { listPublicStoriesByCreator } from "@/lib/writing/stories";
import { publicWriterProfile, writerBySlug } from "@/lib/writing/profile";

async function handleGET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const stories = await listPublicStoriesByCreator(slug);
  const profile = await writerBySlug(slug);
  if (!stories.length && !profile)
    return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  const creator = stories[0];
  return NextResponse.json(
    {
      creator: profile
        ? publicWriterProfile(profile)
        : {
            name: creator.authorName,
            slug: creator.creatorSlug,
            joinedAt: stories.map((story) => story.publishedAt).sort()[0],
          },
      stories: stories.map((story) => ({
        slug: story.slug,
        title: story.title,
        summary: story.summary,
        tags: story.tags,
        publishedAt: story.publishedAt,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

export const GET = apiHandler(handleGET);
