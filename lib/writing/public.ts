import type { Story } from "./stories";
import { writerNames } from "./profile";

export type PublicGuide = Pick<
  Story,
  | "slug"
  | "title"
  | "summary"
  | "body"
  | "document"
  | "tags"
  | "authorName"
  | "creatorSlug"
  | "publishedAt"
  | "createdAt"
  | "updatedAt"
  | "canonicalUrl"
  | "searchMetadata"
>;
export function publicGuide(story: Story): PublicGuide {
  const {
    slug,
    title,
    summary,
    body,
    document,
    tags,
    authorName,
    creatorSlug,
    publishedAt,
    createdAt,
    updatedAt,
    canonicalUrl,
    searchMetadata,
  } = story;
  return {
    slug,
    title,
    summary,
    body,
    document,
    tags,
    authorName,
    creatorSlug,
    publishedAt,
    createdAt,
    updatedAt,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(searchMetadata ? { searchMetadata } : {}),
  };
}
export async function publicStoryViews(
  stories: Story[],
): Promise<PublicGuide[]> {
  const names = await writerNames(stories.map((s) => s.user));
  return stories.map((story) => ({
    ...publicGuide(story),
    authorName: names.get(story.user) || story.authorName,
  }));
}

// Server-rendered public pages use the same backend as API requests. The
// frontend must never silently fall back to an empty local database.
export const publicGuides = async (
  kind: "all" | "slug" | "creator" | "related" = "all",
  value = "",
): Promise<PublicGuide[]> => {
  const backend = process.env.BACKEND_URL?.trim();
  const remote =
    process.env.APP_ROLE === "frontend" ||
    process.env.VERCEL === "1" ||
    (!!backend && !["backend", "worker"].includes(process.env.APP_ROLE || ""));
  if (remote) {
    if (!backend || !process.env.BACKEND_PROXY_SECRET)
      throw new Error("Public guide service is unavailable.");
    const url = new URL("/api/publications", backend);
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(url.hostname))
    )
      throw new Error("Invalid public guide service configuration.");
    if (kind !== "all") url.searchParams.set(kind, value);
    const response = await fetch(url, {
      headers: { "x-syaahi-proxy": process.env.BACKEND_PROXY_SECRET },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new Error("Public guide service is temporarily unavailable.");
    return (await response.json()).stories;
  }
  const store = await import("./stories");
  if (kind === "related")
    return publicStoryViews(
      await (await import("./recommendations")).relatedPublicStories(value),
    );
  if (kind === "slug") {
    const story = await store.getPublicStory(value);
    return story ? publicStoryViews([story]) : [];
  }
  return publicStoryViews(
    await (kind === "creator"
      ? store.listPublicStoriesByCreator(value)
      : store.listPublicStories()),
  );
};
