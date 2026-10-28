import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { SUBJECTS } from "@/lib/study/subjects";
import { BLOG_POSTS } from "@/lib/blog-data";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { allPublicationIndex } from "@/lib/writing/public-index";
export const dynamic = "force-dynamic";

const STATIC = [
  "",
  "/library",
  "/subjects",
  "/interview",
  "/pricing",
  "/ai-presentations",
  "/ai-generated-notes",
  "/ai-ink",
  "/youtube-video-to-notes",
  "/syaahi",
  "/writing",
  "/writing/features",
  "/writing/pricing",
  "/writing/medium-comparison",
  "/features",
  "/how-it-works",
  "/examples",
  "/hi",
  "/resources",
  "/faq",
  "/support",
  "/enterprise",
  "/terms",
  "/privacy",
  "/refunds",
  "/delivery",
  "/disclaimer",
  "/acceptable-use",
  "/cookies",
  "/docs",
  "/docs/getting-started",
  "/docs/generating-notes",
  "/docs/youtube",
  "/docs/syllabus-pdf",
  "/docs/handwriting-styles",
  "/docs/credits-billing",
  "/docs/api",
  "/about",
  "/blog",
  "/community",
  "/course-packs",
  "/campus",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let slugs: string[] = [];
  try {
    const raw = await readFile(
      join(process.cwd(), "data", "library.json"),
      "utf8",
    );
    slugs = JSON.parse(raw).packs.map((p: any) => p.slug);
  } catch {
    /* unseeded */
  }
  // Discovery is independent of the 48 recent, full-body feed. If publishing
  // storage is unavailable, fail visibly instead of serving a misleadingly
  // successful sitemap that silently drops every writer article.
  const published = await allPublicationIndex();
  const creatorSlugs = [
    ...new Set(published.map((story) => story.creatorSlug)),
  ];
  const urls = [
    ...STATIC.map((p) => ({
      url: `${SITE.url}${p || "/"}`,
    })),
    ...SUBJECTS.map((s) => ({ url: `${SITE.url}/subjects/${s.slug}` })),
    ...BLOG_POSTS.map((post) => ({
      url: `${SITE.url}/blog/${post.slug}`,
      lastModified: post.date,
    })),
    ...slugs.map((s) => ({
      url: `${SITE.url}/library/${s}`,
    })),
    ...creatorSlugs.map((slug) => ({
      url: `${SITE.url}/creators/${slug}`,
    })),
    ...published.map((story) => ({
      url: `${SITE.url}/guides/${story.slug}`,
      ...(story.updatedAt ? { lastModified: story.updatedAt } : {}),
    })),
  ];
  const unique = [...new Map(urls.map((entry) => [entry.url, entry])).values()];
  if (unique.length > 50000)
    throw new Error("Sitemap exceeds 50,000 URLs; split sitemap files.");
  return unique;
}
