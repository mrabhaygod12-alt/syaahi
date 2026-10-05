import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import { normalizeDocument, documentText, type RichNode } from "./document";
import { assertOwnedImages } from "./images";

export type StoryStatus =
  "draft" | "submitted" | "changes_requested" | "published" | "removed";
export type ReportReason =
  "spam" | "harmful" | "misleading" | "copyright" | "privacy" | "other";
export interface ContentReport {
  id: string;
  storyId: string;
  storySlug: string;
  reporter: string;
  reason: ReportReason;
  details: string;
  status: "open" | "dismissed" | "actioned";
  createdAt: string;
  resolvedAt: string | null;
  moderator: string | null;
  resolutionNote: string | null;
}
export interface ModerationEvent {
  storyId: string;
  title: string;
  action:
    "submitted" | "published" | "changes_requested" | "removed" | "restored";
  at: string;
  actor: string | null;
  note: string | null;
}
export interface Story {
  canonicalUrl?: string;
  id: string;
  user: string;
  authorName: string;
  creatorSlug: string;
  title: string;
  summary: string;
  body: string;
  document?: RichNode;
  tags: string[];
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  reviewNote: string | null;
  slug: string | null;
  removedAt?: string | null;
  removalNote?: string | null;
  removedBy?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;
  analytics?: { views: number; lastViewedAt: string | null };
  versions?: Array<{
    savedAt: string;
    title: string;
    summary: string;
    body: string;
    document?: RichNode;
    tags: string[];
  }>;
  moderationEvents?: Array<{
    action:
      "submitted" | "published" | "changes_requested" | "removed" | "restored";
    at: string;
    actor: string | null;
    note: string | null;
  }>;
}

function clean(value: unknown): Story | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<Story>;
  if (typeof s.id !== "string" || typeof s.user !== "string") return null;
  return {
    ...s,
    analytics: {
      views: Math.max(0, Number(s.analytics?.views || 0)),
      lastViewedAt: s.analytics?.lastViewedAt || null,
    },
  } as Story;
}

function cleanReport(value: unknown): ContentReport | null {
  if (!value || typeof value !== "object") return null;
  const report = value as Partial<ContentReport>;
  if (
    typeof report.id !== "string" ||
    typeof report.storyId !== "string" ||
    typeof report.reporter !== "string"
  )
    return null;
  return report as ContentReport;
}

export async function listStories(user: string): Promise<Story[]> {
  if (useMongo())
    return (
      await (
        await collection("stories")
      )
        .find({ user })
        .sort({ updatedAt: -1 })
        .limit(50)
        .toArray()
    )
      .map(clean)
      .filter((s): s is Story => !!s);
  return db()
    .prepare(
      "SELECT payload FROM stories WHERE user_id=? ORDER BY updated_at DESC LIMIT 50",
    )
    .all(user)
    .map((row: any) => clean(JSON.parse(String(row.payload))))
    .filter((s): s is Story => !!s);
}

export async function deleteDraft(user: string, id: string) {
  if (useMongo()) {
    const deleted = await (
      await collection("stories")
    ).deleteOne({
      _id: id,
      user,
      status: { $in: ["draft", "changes_requested"] },
    });
    if (!deleted.deletedCount)
      throw new Error("Only your editable drafts can be deleted.");
  } else {
    const deleted = db()
      .prepare(
        "DELETE FROM stories WHERE id=? AND user_id=? AND status IN ('draft','changes_requested')",
      )
      .run(id, user);
    if (!deleted.changes)
      throw new Error("Only your editable drafts can be deleted.");
  }
}

export async function listReviewStories(): Promise<Story[]> {
  if (useMongo())
    return (
      await (
        await collection("stories")
      )
        .find({ status: "submitted" })
        .sort({ submittedAt: 1 })
        .limit(100)
        .toArray()
    )
      .map(clean)
      .filter((s): s is Story => !!s);
  return db()
    .prepare(
      "SELECT payload FROM stories WHERE status='submitted' ORDER BY updated_at ASC LIMIT 100",
    )
    .all()
    .map((row: any) => clean(JSON.parse(String(row.payload))))
    .filter((s): s is Story => !!s);
}

export async function listPublicStories(): Promise<Story[]> {
  if (useMongo())
    return (
      await (
        await collection("stories")
      )
        .find({ status: "published" })
        .sort({ publishedAt: -1 })
        .limit(48)
        .toArray()
    )
      .map(clean)
      .filter((s): s is Story => !!s);
  return db()
    .prepare(
      "SELECT payload FROM stories WHERE status='published' ORDER BY updated_at DESC LIMIT 48",
    )
    .all()
    .map((row: any) => clean(JSON.parse(String(row.payload))))
    .filter((s): s is Story => !!s);
}

export async function listPublicStoriesByCreator(
  creatorSlug: string,
): Promise<Story[]> {
  const normalized = creatorSlug.trim().toLowerCase().slice(0, 120);
  if (useMongo())
    return (
      await (
        await collection("stories")
      )
        .find({ status: "published", creatorSlug: normalized })
        .sort({ publishedAt: -1 })
        .limit(100)
        .toArray()
    )
      .map(clean)
      .filter((s): s is Story => !!s);
  return db()
    .prepare(
      "SELECT payload FROM stories WHERE status='published' AND json_extract(payload,'$.creatorSlug')=? ORDER BY updated_at DESC LIMIT 100",
    )
    .all(normalized)
    .map((row) => clean(JSON.parse(String(row.payload))))
    .filter((s): s is Story => !!s);
}

export async function getPublicStory(slug: string): Promise<Story | null> {
  const normalized = slug.trim().toLowerCase().slice(0, 160);
  if (!normalized) return null;
  if (useMongo())
    return clean(
      await (
        await collection("stories")
      ).findOne({
        status: "published",
        slug: normalized,
      }),
    );
  const row = db()
    .prepare(
      "SELECT payload FROM stories WHERE status='published' AND json_extract(payload,'$.slug')=? LIMIT 1",
    )
    .get(normalized);
  return row ? clean(JSON.parse(String(row.payload))) : null;
}

const toSlug = (title: string, id: string) =>
  `${
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "study-guide"
  }-${id.slice(0, 8)}`;

const toCreatorSlug = (name: string, id: string) =>
  `${
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 56) || "syaahi-creator"
  }-${id.slice(0, 8)}`;

export async function saveStory(
  user: string,
  input: Pick<Story, "title" | "summary" | "body" | "tags"> & {
    id?: string;
    submit?: boolean;
    authorName: string;
    creatorSlug?: string;
    document?: unknown;
    expectedUpdatedAt?: string;
    canonicalUrl?: string;
  },
): Promise<Story> {
  const now = new Date().toISOString();
  const title = input.title.trim().slice(0, 140);
  const summary = input.summary.trim().slice(0, 320);
  let canonicalUrl = input.canonicalUrl;
  if (canonicalUrl !== undefined) {
    canonicalUrl = canonicalUrl.trim();
    if (canonicalUrl) {
      const url = new URL(canonicalUrl);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.href.length > 2000 ||
        url.hostname === "localhost"
      )
        throw new Error(
          "Use a public HTTPS canonical URL without credentials.",
        );
      canonicalUrl = url.href;
    }
  }
  const document =
    input.document === undefined
      ? undefined
      : normalizeDocument(input.document);
  if (document) await assertOwnedImages(user, document);
  const body = (document ? documentText(document) : input.body)
    .trim()
    .slice(0, 50000);
  const tags = [
    ...new Set(
      input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    ),
  ]
    .slice(0, 5)
    .map((tag) => tag.slice(0, 32));
  if (!title || (input.submit && (title.length < 5 || body.length < 80)))
    throw new Error(
      "Add a title to save. Review submissions need at least 80 characters.",
    );
  if (input.id) {
    const existing = useMongo()
      ? clean(
          await (await collection("stories")).findOne({ _id: input.id, user }),
        )
      : clean(
          (() => {
            const row = db()
              .prepare("SELECT payload FROM stories WHERE id=? AND user_id=?")
              .get(input.id, user) as any;
            return row ? JSON.parse(String(row.payload)) : null;
          })(),
        );
    if (!existing) throw new Error("Draft not found.");
    if (
      input.expectedUpdatedAt &&
      existing.updatedAt !== input.expectedUpdatedAt
    )
      throw new Error(
        "This draft changed in another tab. Reload it before saving.",
      );
    if (!["draft", "changes_requested"].includes(existing.status))
      throw new Error("This submission is under editorial review.");
    const story: Story = {
      ...existing,
      ...(canonicalUrl !== undefined ? { canonicalUrl } : {}),
      authorName: input.authorName.trim().slice(0, 80) || existing.authorName,
      creatorSlug:
        existing.creatorSlug || toCreatorSlug(existing.authorName, user),
      title,
      summary,
      body,
      document,
      tags,
      status: input.submit ? "submitted" : "draft",
      updatedAt: now,
      submittedAt: input.submit ? now : null,
      reviewedAt: input.submit ? null : existing.reviewedAt,
      reviewNote: input.submit ? null : existing.reviewNote,
      versions: [
        ...(existing.versions || []),
        {
          savedAt: existing.updatedAt,
          title: existing.title,
          summary: existing.summary,
          body: existing.body,
          document: existing.document,
          tags: existing.tags,
        },
      ].slice(-10),
    };
    story.updatedAt = new Date(
      Math.max(Date.now(), Date.parse(existing.updatedAt) + 1),
    ).toISOString();
    if (useMongo()) {
      const changed = await (
        await collection("stories")
      ).updateOne(
        {
          _id: story.id,
          user,
          updatedAt: existing.updatedAt,
          status: existing.status,
        },
        { $set: { ...story, _id: story.id } },
      );
      if (!changed.matchedCount)
        throw new Error(
          "This draft changed in another tab. Reload it before saving.",
        );
    } else
      transaction(() => {
        const changed = db()
          .prepare(
            "UPDATE stories SET status=?,updated_at=?,payload=? WHERE id=? AND user_id=? AND updated_at=? AND status=?",
          )
          .run(
            story.status,
            story.updatedAt,
            JSON.stringify(story),
            story.id,
            user,
            existing.updatedAt,
            existing.status,
          );
        if (!changed.changes)
          throw new Error(
            "This draft changed in another tab. Reload it before saving.",
          );
      });
    return story;
  }
  const story: Story = {
    ...(canonicalUrl ? { canonicalUrl } : {}),
    id: randomUUID(),
    user,
    authorName: input.authorName.trim().slice(0, 80) || "Syaahi creator",
    creatorSlug:
      input.creatorSlug ||
      toCreatorSlug(input.authorName.trim() || "Syaahi creator", user),
    title,
    summary,
    body,
    document,
    tags,
    status: input.submit ? "submitted" : "draft",
    createdAt: now,
    updatedAt: now,
    submittedAt: input.submit ? now : null,
    reviewedAt: null,
    publishedAt: null,
    reviewNote: null,
    slug: null,
    removedAt: null,
    removalNote: null,
    removedBy: null,
    restoredAt: null,
    restoredBy: null,
    analytics: { views: 0, lastViewedAt: null },
    moderationEvents: input.submit
      ? [{ action: "submitted", at: now, actor: user, note: null }]
      : [],
  };
  if (useMongo())
    await (await collection("stories")).insertOne({ _id: story.id, ...story });
  else
    transaction(() =>
      db()
        .prepare(
          "INSERT INTO stories (id,user_id,status,updated_at,payload) VALUES (?,?,?,?,?)",
        )
        .run(
          story.id,
          user,
          story.status,
          story.updatedAt,
          JSON.stringify(story),
        ),
    );
  return story;
}

export async function reviewStory(
  id: string,
  action: "publish" | "changes",
  note: string,
  moderator: string | null = null,
): Promise<Story> {
  const now = new Date().toISOString();
  const existing = useMongo()
    ? clean(await (await collection("stories")).findOne({ _id: id }))
    : clean(
        (() => {
          const row = db()
            .prepare("SELECT payload FROM stories WHERE id=?")
            .get(id) as any;
          return row ? JSON.parse(String(row.payload)) : null;
        })(),
      );
  if (!existing || existing.status !== "submitted")
    throw new Error("Only submitted stories can be reviewed.");
  const story: Story = {
    ...existing,
    status: action === "publish" ? "published" : "changes_requested",
    reviewedAt: now,
    publishedAt: action === "publish" ? now : null,
    reviewNote: note.trim().slice(0, 1000) || null,
    slug: action === "publish" ? toSlug(existing.title, existing.id) : null,
    updatedAt: now,
    moderationEvents: [
      ...(existing.moderationEvents || []),
      {
        action: (action === "publish" ? "published" : "changes_requested") as
          "published" | "changes_requested",
        at: now,
        actor: moderator,
        note: note.trim().slice(0, 1000) || null,
      },
    ].slice(-50),
  };
  if (useMongo())
    await (
      await collection("stories")
    ).updateOne({ _id: id }, { $set: { ...story, _id: id } });
  else
    transaction(() =>
      db()
        .prepare(
          "UPDATE stories SET status=?,updated_at=?,payload=? WHERE id=?",
        )
        .run(story.status, story.updatedAt, JSON.stringify(story), id),
    );
  return story;
}

async function getStoryById(id: string): Promise<Story | null> {
  if (useMongo())
    return clean(await (await collection("stories")).findOne({ _id: id }));
  const row = db()
    .prepare("SELECT payload FROM stories WHERE id=?")
    .get(id) as any;
  return row ? clean(JSON.parse(String(row.payload))) : null;
}

async function persistStory(story: Story): Promise<void> {
  if (useMongo()) {
    await (
      await collection("stories")
    ).updateOne({ _id: story.id }, { $set: { ...story, _id: story.id } });
    return;
  }
  transaction(() =>
    db()
      .prepare("UPDATE stories SET status=?,updated_at=?,payload=? WHERE id=?")
      .run(story.status, story.updatedAt, JSON.stringify(story), story.id),
  );
}

export async function removeStory(
  id: string,
  moderator: string,
  note: string,
): Promise<Story> {
  if (note.trim().length < 12)
    throw new Error("Add a clear moderation note before taking down a guide.");
  const existing = await getStoryById(id);
  if (!existing || existing.status !== "published")
    throw new Error("Only published guides can be taken down.");
  const now = new Date().toISOString();
  const story: Story = {
    ...existing,
    status: "removed",
    removedAt: now,
    removedBy: moderator,
    restoredAt: null,
    restoredBy: null,
    removalNote: note.trim().slice(0, 1000) || "Removed by Syaahi moderation.",
    updatedAt: now,
    moderationEvents: [
      ...(existing.moderationEvents || []),
      {
        action: "removed" as const,
        at: now,
        actor: moderator,
        note: note.trim().slice(0, 1000),
      },
    ].slice(-50),
  };
  await persistStory(story);
  return story;
}

export async function restoreStory(
  id: string,
  moderator: string,
  note: string,
): Promise<Story> {
  const existing = await getStoryById(id);
  if (!existing || existing.status !== "removed")
    throw new Error("Only removed guides can be restored.");
  const now = new Date().toISOString();
  const story: Story = {
    ...existing,
    status: "published",
    removedAt: null,
    removedBy: null,
    removalNote: note.trim().slice(0, 1000) || null,
    restoredAt: now,
    restoredBy: moderator,
    reviewedAt: now,
    updatedAt: now,
    moderationEvents: [
      ...(existing.moderationEvents || []),
      {
        action: "restored" as const,
        at: now,
        actor: moderator,
        note: note.trim().slice(0, 1000) || null,
      },
    ].slice(-50),
  };
  await persistStory(story);
  return story;
}

export async function reportPublicStory(
  reporter: string,
  slug: string,
  reason: ReportReason,
  details: string,
): Promise<ContentReport> {
  const validReasons: ReportReason[] = [
    "spam",
    "harmful",
    "misleading",
    "copyright",
    "privacy",
    "other",
  ];
  if (!validReasons.includes(reason))
    throw new Error("Choose a report reason.");
  const story = await getPublicStory(slug);
  if (!story) throw new Error("This guide is no longer available.");
  const cleanDetails = details.trim().slice(0, 1200);
  if (cleanDetails.length < 12)
    throw new Error(
      "Add at least 12 characters to help the moderator review this report.",
    );
  const duplicate = useMongo()
    ? await (
        await collection("content_reports")
      ).findOne({
        storyId: story.id,
        reporter,
        status: "open",
      })
    : db()
        .prepare(
          "SELECT id FROM content_reports WHERE story_id=? AND reporter=? AND status='open'",
        )
        .get(story.id, reporter);
  if (duplicate)
    throw new Error("You already have an open report for this guide.");
  const report: ContentReport = {
    id: randomUUID(),
    storyId: story.id,
    storySlug: story.slug || slug,
    reporter,
    reason,
    details: cleanDetails,
    status: "open",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    moderator: null,
    resolutionNote: null,
  };
  if (useMongo())
    await (
      await collection("content_reports")
    ).insertOne({ _id: report.id, ...report });
  else
    transaction(() =>
      db()
        .prepare(
          "INSERT INTO content_reports (id,story_id,reporter,status,created_at,payload) VALUES (?,?,?,?,?,?)",
        )
        .run(
          report.id,
          report.storyId,
          report.reporter,
          report.status,
          report.createdAt,
          JSON.stringify(report),
        ),
    );
  return report;
}

export async function listContentReports(): Promise<ContentReport[]> {
  if (useMongo())
    return (
      await (
        await collection("content_reports")
      )
        .find({})
        .sort({ status: 1, createdAt: -1 })
        .limit(200)
        .toArray()
    )
      .map(cleanReport)
      .filter((report): report is ContentReport => !!report);
  return db()
    .prepare(
      "SELECT payload FROM content_reports ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, created_at DESC LIMIT 200",
    )
    .all()
    .map((row: any) => cleanReport(JSON.parse(String(row.payload))))
    .filter((report): report is ContentReport => !!report);
}

export async function listModerationEvents(
  limit = 200,
): Promise<ModerationEvent[]> {
  const stories = useMongo()
    ? (
        await (
          await collection("stories")
        )
          .find({})
          .sort({ updatedAt: -1 })
          .limit(200)
          .toArray()
      )
        .map(clean)
        .filter((story): story is Story => !!story)
    : db()
        .prepare(
          "SELECT payload FROM stories ORDER BY updated_at DESC LIMIT 200",
        )
        .all()
        .map((row: any) => clean(JSON.parse(String(row.payload))))
        .filter((story): story is Story => !!story);
  return stories
    .flatMap((story) =>
      (story.moderationEvents || []).map((event) => ({
        storyId: story.id,
        title: story.title,
        ...event,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, Math.max(1, Math.min(limit, 500)));
}

export async function resolveContentReport(
  id: string,
  action: "dismiss" | "takedown",
  moderator: string,
  note: string,
): Promise<ContentReport> {
  const existing = useMongo()
    ? cleanReport(
        await (await collection("content_reports")).findOne({ _id: id }),
      )
    : (() => {
        const row = db()
          .prepare("SELECT payload FROM content_reports WHERE id=?")
          .get(id) as any;
        return row ? cleanReport(JSON.parse(String(row.payload))) : null;
      })();
  if (!existing || existing.status !== "open")
    throw new Error("Only open reports can be resolved.");
  if (action === "takedown")
    await removeStory(existing.storyId, moderator, note);
  const resolved: ContentReport = {
    ...existing,
    status: action === "takedown" ? "actioned" : "dismissed",
    resolvedAt: new Date().toISOString(),
    moderator,
    resolutionNote: note.trim().slice(0, 1000) || null,
  };
  if (useMongo())
    await (
      await collection("content_reports")
    ).updateOne({ _id: id }, { $set: { ...resolved, _id: id } });
  else
    transaction(() =>
      db()
        .prepare("UPDATE content_reports SET status=?,payload=? WHERE id=?")
        .run(resolved.status, JSON.stringify(resolved), id),
    );
  return resolved;
}

export async function recordPublicStoryView(slug: string): Promise<void> {
  const story = await getPublicStory(slug);
  if (!story) return;
  const now = new Date().toISOString();
  await persistStory({
    ...story,
    analytics: {
      views: Math.max(0, Number(story.analytics?.views || 0)) + 1,
      lastViewedAt: now,
    },
    updatedAt: story.updatedAt,
  });
}

export async function creatorAnalytics(user: string) {
  const stories = await listStories(user);
  const status = (value: StoryStatus) =>
    stories.filter((story) => story.status === value).length;
  const ids = stories.map((story) => story.id);
  let openReports = 0;
  if (ids.length) {
    if (useMongo())
      openReports = await (
        await collection("content_reports")
      ).countDocuments({
        storyId: { $in: ids },
        status: "open",
      });
    else {
      const placeholders = ids.map(() => "?").join(",");
      const row = db()
        .prepare(
          `SELECT COUNT(*) as count FROM content_reports WHERE status='open' AND story_id IN (${placeholders})`,
        )
        .get(...ids) as any;
      openReports = Number(row?.count || 0);
    }
  }
  return {
    drafts: status("draft") + status("changes_requested"),
    inReview: status("submitted"),
    published: status("published"),
    removed: status("removed"),
    approximateGuideOpens: stories.reduce(
      (total, story) => total + Number(story.analytics?.views || 0),
      0,
    ),
    openReports,
  };
}
