import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { SUBJECTS } from "@/lib/study/subjects";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const STATIC = [
  "",
  "/library",
  "/subjects",
  "/interview",
  "/pricing",
  "/features",
  "/how-it-works",
  "/examples",
  "/faq",
  "/support",
  "/enterprise",
  "/terms",
  "/privacy",
  "/refunds",
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
  "/blog/how-to-create-high-scoring-handwritten-exam-notes-using-ai",
  "/blog/science-of-handwriting-vs-typing-for-exam-retention",
  "/blog/cbse-icse-university-exam-revision-strategy-guide",
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
  const urls = [
    ...STATIC.map((p) => ({
      url: `${SITE.url}${p || "/"}`,
    })),
    ...SUBJECTS.map((s) => ({ url: `${SITE.url}/subjects/${s.slug}` })),
    ...slugs.map((s) => ({
      url: `${SITE.url}/library/${s}`,
    })),
  ];
  return urls;
}
