import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import { record, records, mutateRecord } from "@/lib/workspace-records";
import { following, type ReaderRecord } from "./social";
import { getPublicStory, listPublicStories, type Story } from "./stories";
import { publicStoryViews } from "./public";
import type { ReadingPreferences } from "./recommendation-types";
import { writerBySlug } from "./profile";
export class RecommendationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const preferenceKey = (owner: string) =>
  `writer-reading-preferences:${owner}`;
export async function readingPreferences(
  owner: string,
): Promise<ReadingPreferences> {
  return (
    (await record<ReadingPreferences>(preferenceKey(owner))) || {
      id: preferenceKey(owner),
      owner,
      kind: "writer-reading-preferences",
      updatedAt: "",
      topics: [],
      mutedTopics: [],
      mutedCreators: [],
      useReadingHistory: false,
    }
  );
}
export async function updateReadingPreferences(owner: string, input: unknown) {
  const b = input as ReadingPreferences & { expectedUpdatedAt?: string };
  const tags = (value: unknown, max: number) => {
    if (
      !Array.isArray(value) ||
      value.length > max ||
      value.some(
        (t) =>
          typeof t !== "string" ||
          t.trim().length < 2 ||
          t.length > 32 ||
          /[<>\r\n]/.test(t),
      )
    )
      throw new RecommendationError(
        `Choose up to ${max} topics, each 2–32 characters without markup.`,
      );
    return [...new Set((value as string[]).map((t) => t.trim().toLowerCase()))];
  };
  if (
    !b ||
    typeof b.useReadingHistory !== "boolean" ||
    typeof b.expectedUpdatedAt !== "string" ||
    b.expectedUpdatedAt.length > 50 ||
    !Array.isArray(b.mutedCreators) ||
    b.mutedCreators.length > 30 ||
    b.mutedCreators.some(
      (s) => typeof s !== "string" || !/^[a-z0-9-]{1,120}$/.test(s),
    )
  )
    throw new RecommendationError(
      "Include your saved preferences revision, history choice and at most 30 muted author URLs.",
    );
  const topics = tags(b.topics, 10),
    mutedTopics = tags(b.mutedTopics, 10);
  if (topics.some((t) => mutedTopics.includes(t)))
    throw new RecommendationError(
      "A topic cannot be both preferred and muted.",
    );
  const current = await readingPreferences(owner);
  if (current.updatedAt !== b.expectedUpdatedAt)
    throw new RecommendationError(
      "Preferences changed in another tab. Reload before saving.",
      409,
    );
  const added = [...new Set(b.mutedCreators)].filter(
    (s) => !current.mutedCreators.includes(s),
  );
  const writers = await Promise.all(added.map((s) => writerBySlug(s)));
  if (writers.some((p) => !p))
    throw new RecommendationError(
      "Choose an available public Syaahi writer profile to mute.",
    );
  return mutateRecord<ReadingPreferences>(preferenceKey(owner), (old) => {
    if ((old?.updatedAt || "") !== b.expectedUpdatedAt)
      throw new RecommendationError(
        "Preferences changed in another tab. Reload before saving.",
        409,
      );
    return {
      id: preferenceKey(owner),
      owner,
      kind: "writer-reading-preferences",
      topics,
      mutedTopics,
      mutedCreators: [...new Set(b.mutedCreators)],
      useReadingHistory: b.useReadingHistory,
      updatedAt: new Date(
        Math.max(Date.now(), Date.parse(old?.updatedAt || "") + 1 || 0),
      ).toISOString(),
    };
  });
}
export function rankStories(
  candidates: Story[],
  prefs: ReadingPreferences,
  follows: Set<string>,
  history: ReaderRecord[] = [],
  mode: "for_you" | "latest" | "following" = "for_you",
  now = Date.now(),
) {
  const seen = new Set(
    prefs.useReadingHistory
      ? history.filter((h) => h.qualified).map((h) => h.storyId)
      : [],
  );
  const readingTags = new Set(
    prefs.useReadingHistory
      ? candidates.filter((s) => seen.has(s.id)).flatMap((s) => s.tags)
      : [],
  );
  const ranked = candidates
    .filter(
      (s) =>
        s.status === "published" &&
        !prefs.mutedCreators.includes(s.creatorSlug) &&
        !s.tags.some((t) => prefs.mutedTopics.includes(t)) &&
        (mode !== "following" || follows.has(s.creatorSlug)),
    )
    .map((s) => {
      const preferred = s.tags.filter((t) => prefs.topics.includes(t)),
        related = s.tags.some((t) => readingTags.has(t)),
        followed = follows.has(s.creatorSlug);
      const days = Math.max(
        0,
        (now - Date.parse(s.publishedAt || s.createdAt)) / 86400000,
      );
      const score =
        Math.min(12, preferred.length * 6) +
        (followed ? 7 : 0) +
        (related ? 3 : 0) +
        Math.max(0, 4 - days / 10) +
        Math.min(1.5, Math.log1p(s.analytics?.views || 0) * 0.2) -
        (seen.has(s.id) ? 8 : 0);
      return {
        story: s,
        score,
        matched: !!preferred.length || followed || related,
        reason:
          mode === "latest"
            ? "Recently published"
            : preferred.length
              ? `Your topic: ${preferred[0]}`
              : followed
                ? "From a writer you follow"
                : related
                  ? "Related to your opted-in reading history"
                  : "A different perspective",
      };
    })
    .sort((a, b) =>
      mode !== "for_you"
        ? (b.story.publishedAt || b.story.createdAt).localeCompare(
            a.story.publishedAt || a.story.createdAt,
          )
        : b.score - a.score || a.story.id.localeCompare(b.story.id),
    );
  if (mode !== "for_you") return ranked.slice(0, 24);
  const result: typeof ranked = [],
    counts = new Map<string, number>();
  while (ranked.length && result.length < 24) {
    const last = result.at(-1)?.story.creatorSlug;
    const eligible = (r: (typeof ranked)[number]) =>
      (counts.get(r.story.creatorSlug) || 0) < 3 &&
      (r.story.creatorSlug !== last ||
        !ranked.some(
          (other) =>
            other.story.creatorSlug !== last &&
            (counts.get(other.story.creatorSlug) || 0) < 3,
        ));
    let index =
      result.length % 4 === 3
        ? ranked.findIndex((r) => !r.matched && eligible(r))
        : -1;
    if (index < 0) index = ranked.findIndex(eligible);
    if (index < 0) break;
    const [next] = ranked.splice(index, 1);
    result.push(next);
    counts.set(
      next.story.creatorSlug,
      (counts.get(next.story.creatorSlug) || 0) + 1,
    );
  }
  return result;
}
export async function recommendedStories(
  owner: string,
  mode: "for_you" | "latest" | "following" = "for_you",
) {
  const prefs = await readingPreferences(owner);
  const [candidates, followed, history] = await Promise.all([
    useMongo()
      ? (await collection("stories"))
          .find({ status: "published" })
          .sort({ publishedAt: -1 })
          .limit(240)
          .toArray()
      : Promise.resolve(
          db()
            .prepare(
              "SELECT payload FROM stories WHERE status='published' ORDER BY json_extract(payload,'$.publishedAt') DESC LIMIT 240",
            )
            .all()
            .map((r) => JSON.parse(String(r.payload))),
        ),
    following(owner),
    prefs.useReadingHistory
      ? records<ReaderRecord>("story-reader", owner)
      : Promise.resolve([]),
  ]);
  const ranked = rankStories(
    candidates as Story[],
    prefs,
    new Set(followed.map((f) => f.slug)),
    history,
    mode,
  );
  return {
    stories: await publicStoryViews(ranked.map((r) => r.story)),
    reasons: Object.fromEntries(ranked.map((r) => [r.story.slug, r.reason])),
    mode,
  };
}
export async function relatedPublicStories(slug: string): Promise<Story[]> {
  const current = await getPublicStory(slug);
  if (!current) return [];
  const candidates = (await listPublicStories())
    .filter((s) => s.slug !== current.slug)
    .sort(
      (a, b) =>
        b.tags.filter((t) => current.tags.includes(t)).length -
        a.tags.filter((t) => current.tags.includes(t)).length,
    );
  const counts = new Map<string, number>();
  return candidates
    .filter((s) => {
      const count = counts.get(s.creatorSlug) || 0;
      if (count >= 2) return false;
      counts.set(s.creatorSlug, count + 1);
      return true;
    })
    .slice(0, 6);
}
