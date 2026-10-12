import { BLOG_POSTS } from "./blog-data";
import { publicGuides } from "./writing/public";
import type { RichNode } from "./writing/document";
export type BlogEntry = {
  slug: string;
  href: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  category: string;
  tags: string[];
  image?: { src: string; alt: string };
  kind: "writer" | "study";
};
function cover(document?: RichNode): BlogEntry["image"] {
  if (!document) return;
  if (document.type === "image" && typeof document.attrs?.src === "string")
    return {
      src: document.attrs.src,
      alt: String(document.attrs.alt || "Article illustration"),
    };
  for (const child of document.content || []) {
    const found = cover(child);
    if (found) return found;
  }
}
export async function blogFeed() {
  let unavailable = false;
  const stories = await publicGuides().catch(() => {
    unavailable = true;
    return [];
  });
  const entries: BlogEntry[] = [
    ...stories
      .filter((s) => s.slug && s.publishedAt)
      .map((s) => ({
        slug: s.slug!,
        href: `/guides/${s.slug}`,
        title: s.title,
        excerpt: s.summary,
        author: s.authorName,
        date: s.publishedAt!,
        category: s.tags[0] || "Perspectives",
        tags: s.tags,
        image: cover(s.document),
        kind: "writer" as const,
      })),
    ...BLOG_POSTS.map((s) => ({
      slug: s.slug,
      href: `/blog/${s.slug}`,
      title: s.title,
      excerpt: s.excerpt,
      author: s.author,
      date: s.date,
      category: s.category,
      tags: [...new Set([s.category, ...s.tags])],
      kind: "study" as const,
    })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { entries, unavailable };
}
