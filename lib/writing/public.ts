import type { Story } from "./stories";

export type PublicGuide = Pick<
  Story,
  | "slug"
  | "title"
  | "summary"
  | "body"
  | "tags"
  | "authorName"
  | "creatorSlug"
  | "publishedAt"
  | "createdAt"
>;
export function publicGuide(story: Story): PublicGuide {
  const {
    slug,
    title,
    summary,
    body,
    tags,
    authorName,
    creatorSlug,
    publishedAt,
    createdAt,
  } = story;
  return {
    slug,
    title,
    summary,
    body,
    tags,
    authorName,
    creatorSlug,
    publishedAt,
    createdAt,
  };
}

// Server-rendered public pages use the same backend as API requests. The
// frontend must never silently fall back to an empty local database.
export const publicGuides = async (
  kind: "all" | "slug" | "creator" = "all",
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
  if (kind === "slug") {
    const story = await store.getPublicStory(value);
    return story ? [publicGuide(story)] : [];
  }
  return (
    await (kind === "creator"
      ? store.listPublicStoriesByCreator(value)
      : store.listPublicStories())
  ).map(publicGuide);
};
