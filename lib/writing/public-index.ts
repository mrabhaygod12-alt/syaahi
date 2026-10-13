import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import { SITE } from "@/lib/seo";

/** Discovery fields only: no article bodies, ownership, revisions or moderation. */
export interface PublicationIndexEntry {
  slug: string;
  creatorSlug: string;
  publishedAt?: string;
  updatedAt?: string;
}
export interface PublicationIndexPage {
  entries: PublicationIndexEntry[];
  nextCursor: string | null;
}
export const PUBLICATION_INDEX_PAGE_SIZE = 200;
const MAX_INDEX_PAGES = 250;
const safeSlug = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
  value.length <= 120;

export function indexCursor(cursor: string | null | undefined): string {
  if (!cursor) return "";
  if (cursor.length > 180 || !/^[A-Za-z0-9_-]+$/.test(cursor))
    throw new Error("Invalid publication index cursor.");
  const id = Buffer.from(cursor, "base64url").toString("utf8");
  if (
    !/^[a-zA-Z0-9-]{1,120}$/.test(id) ||
    Buffer.from(id).toString("base64url") !== cursor
  )
    throw new Error("Invalid publication index cursor.");
  return id;
}
const date = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return undefined;
  return new Date(value).toISOString();
};
function entry(row: Record<string, unknown>): PublicationIndexEntry | null {
  if (!safeSlug(row.slug) || !safeSlug(row.creatorSlug)) return null;
  if (row.canonicalUrl) {
    try {
      // Cross-posted articles point readers and search engines at their original
      // publisher; do not advertise their duplicate URL in our sitemap.
      if (
        typeof row.canonicalUrl !== "string" ||
        new URL(row.canonicalUrl).origin !== SITE.url
      )
        return null;
    } catch {
      return null;
    }
  }
  const publishedAt = date(row.publishedAt) || date(row.createdAt);
  const updatedAt = date(row.updatedAt) || publishedAt;
  return {
    slug: row.slug,
    creatorSlug: row.creatorSlug,
    ...(publishedAt ? { publishedAt } : {}),
    ...(updatedAt
      ? {
          updatedAt:
            publishedAt && updatedAt < publishedAt ? publishedAt : updatedAt,
        }
      : {}),
  };
}

/** Stable keyset traversal remains bounded even when many rows share a date. */
export async function listPublicationIndex(
  cursor?: string | null,
): Promise<PublicationIndexPage> {
  const after = indexCursor(cursor);
  const rows: Record<string, unknown>[] = useMongo()
    ? await (
        await collection("stories")
      )
        .find(
          {
            status: "published",
            revisionOf: null,
            ...(after ? { id: { $gt: after } } : {}),
          },
          {
            projection: {
              _id: 0,
              id: 1,
              slug: 1,
              creatorSlug: 1,
              canonicalUrl: 1,
              createdAt: 1,
              publishedAt: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ id: 1 })
        .limit(PUBLICATION_INDEX_PAGE_SIZE + 1)
        .toArray()
    : db()
        .prepare(
          `
      SELECT id, json_extract(payload,'$.slug') AS slug,
        json_extract(payload,'$.creatorSlug') AS creatorSlug,
        json_extract(payload,'$.canonicalUrl') AS canonicalUrl,
        json_extract(payload,'$.createdAt') AS createdAt,
        json_extract(payload,'$.publishedAt') AS publishedAt,
        json_extract(payload,'$.updatedAt') AS updatedAt
      FROM stories WHERE status='published' AND id > ?
        AND json_extract(payload,'$.revisionOf') IS NULL
      ORDER BY id ASC LIMIT ?
    `,
        )
        .all(after, PUBLICATION_INDEX_PAGE_SIZE + 1);
  const page = rows.slice(0, PUBLICATION_INDEX_PAGE_SIZE);
  return {
    entries: page
      .map(entry)
      .filter((row): row is PublicationIndexEntry => !!row),
    // The cursor follows the last scanned row, including excluded canonical
    // duplicates. A page of duplicates must not stop discovery prematurely.
    nextCursor:
      rows.length > PUBLICATION_INDEX_PAGE_SIZE
        ? Buffer.from(String(page.at(-1)!.id)).toString("base64url")
        : null,
  };
}

export async function publicationIndexPage(
  cursor?: string | null,
): Promise<PublicationIndexPage> {
  indexCursor(cursor);
  const backend = process.env.BACKEND_URL?.trim();
  const remote =
    process.env.APP_ROLE === "frontend" ||
    process.env.VERCEL === "1" ||
    (!!backend && !["backend", "worker"].includes(process.env.APP_ROLE || ""));
  if (!remote) return listPublicationIndex(cursor);
  if (!backend || !process.env.BACKEND_PROXY_SECRET)
    throw new Error("Publication discovery service is unavailable.");
  const url = new URL("/api/publications/index", backend);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error("Invalid publication discovery service configuration.");
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, {
    headers: { "x-syaahi-proxy": process.env.BACKEND_PROXY_SECRET },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error(
      "Publication discovery service is temporarily unavailable.",
    );
  const result = (await response.json()) as PublicationIndexPage;
  if (
    !Array.isArray(result.entries) ||
    result.entries.length > PUBLICATION_INDEX_PAGE_SIZE ||
    !(result.nextCursor === null || typeof result.nextCursor === "string")
  )
    throw new Error("Invalid publication discovery response.");
  indexCursor(result.nextCursor);
  return result;
}

export async function allPublicationIndex(): Promise<PublicationIndexEntry[]> {
  const entries = new Map<string, PublicationIndexEntry>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < MAX_INDEX_PAGES; page++) {
    const next = await publicationIndexPage(cursor);
    for (const row of next.entries) entries.set(row.slug, row);
    if (!next.nextCursor) return [...entries.values()];
    if (cursors.has(next.nextCursor))
      throw new Error("Publication discovery cursor did not advance.");
    cursors.add(next.nextCursor);
    cursor = next.nextCursor;
  }
  throw new Error(
    "Publication index exceeds a single sitemap; split sitemap files before expanding discovery.",
  );
}
