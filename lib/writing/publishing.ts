import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import {
  ownedStory,
  getStoryById,
  commitStoryChanges,
  toSlug,
  type Story,
  type ModerationEvent,
} from "./stories";

export class PublicationError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
const nextTime = (s: Story) =>
  new Date(Math.max(Date.now(), Date.parse(s.updatedAt) + 1)).toISOString();
const events = (
  s: Story,
  action: ModerationEvent["action"],
  actor: string | null,
  note: string | null = null,
) =>
  [
    ...(s.moderationEvents || []),
    { action, actor, note, at: nextTime(s) },
  ].slice(-50);
function expected(s: Story, version: string) {
  if (s.updatedAt !== version)
    throw new PublicationError(
      "This story changed. Reload the latest version before continuing.",
    );
}
async function own(user: string, id: string) {
  const s = await ownedStory(user, id);
  if (!s) throw new PublicationError("Story not found.", 404);
  return s;
}
export async function beginRevision(user: string, id: string, version: string) {
  const parent = await own(user, id);
  if (
    !["published", "unpublished"].includes(parent.status) ||
    parent.revisionOf
  )
    throw new PublicationError(
      "Only your published or unpublished article can start a private revision.",
    );
  if (parent.pendingRevisionId) {
    const pending = await own(user, parent.pendingRevisionId);
    if (pending.status !== "archived") return pending;
  }
  expected(parent, version);
  const at = nextTime(parent),
    revisionId = randomUUID();
  const updatedParent: Story = {
    ...parent,
    pendingRevisionId: revisionId,
    updatedAt: at,
    moderationEvents: events(parent, "revision_created", user),
  };
  const revision: Story = {
    ...parent,
    id: revisionId,
    revisionOf: parent.id,
    revisionBaseUpdatedAt: at,
    pendingRevisionId: null,
    requestedPublishAt: null,
    scheduledFor: null,
    status: "draft",
    createdAt: at,
    updatedAt: at,
    slug: null,
    publishedAt: null,
    submittedAt: null,
    reviewedAt: null,
    reviewNote: null,
    analytics: { views: 0, lastViewedAt: null },
    versions: [],
    moderationEvents: [],
  };
  await commitStoryChanges([
    { before: parent, after: updatedParent },
    { before: null, after: revision },
  ]);
  return revision;
}
export async function deletePublicationDraft(user: string, id: string) {
  const s = await own(user, id);
  if (!["draft", "changes_requested"].includes(s.status))
    throw new PublicationError("Only your editable drafts can be deleted.");
  const changes: Array<{ before: Story | null; after: Story | null }> = [
    { before: s, after: null },
  ];
  if (s.revisionOf) {
    const parent = await own(user, s.revisionOf);
    if (parent.pendingRevisionId === s.id)
      changes.push({
        before: parent,
        after: {
          ...parent,
          pendingRevisionId: null,
          updatedAt: nextTime(parent),
        },
      });
  }
  await commitStoryChanges(changes);
}
export async function unpublishStory(
  user: string,
  id: string,
  version: string,
) {
  const s = await own(user, id);
  expected(s, version);
  if (s.status !== "published" || s.revisionOf)
    throw new PublicationError("Only a published article can be unpublished.");
  if (s.pendingRevisionId)
    throw new PublicationError(
      "Discard or finish the pending revision before unpublishing this article.",
    );
  const next: Story = {
    ...s,
    status: "unpublished",
    updatedAt: nextTime(s),
    moderationEvents: events(
      s,
      "unpublished",
      user,
      "Withdrawn by the author.",
    ),
  };
  await commitStoryChanges([{ before: s, after: next }]);
  return next;
}
export async function cancelStorySchedule(
  user: string,
  id: string,
  version: string,
) {
  const s = await own(user, id);
  expected(s, version);
  if (s.status !== "scheduled")
    throw new PublicationError("Only a scheduled article can be cancelled.");
  const next: Story = {
    ...s,
    status: "draft",
    scheduledFor: null,
    requestedPublishAt: null,
    reviewedAt: null,
    submittedAt: null,
    reviewNote: null,
    updatedAt: nextTime(s),
    moderationEvents: events(
      s,
      "schedule_cancelled",
      user,
      "Schedule cancelled; fresh review required.",
    ),
  };
  await commitStoryChanges([{ before: s, after: next }]);
  return next;
}
async function publishApproved(s: Story, actor: string | null, note: string) {
  const at = nextTime(s),
    feedback = note.trim().slice(0, 1000) || null;
  if (!s.revisionOf) {
    const next: Story = {
      ...s,
      status: "published",
      slug: s.slug || toSlug(s.title, s.id),
      publishedAt: s.publishedAt || at,
      reviewedAt: s.status === "scheduled" ? s.reviewedAt : at,
      reviewNote: feedback,
      scheduledFor: null,
      requestedPublishAt: null,
      updatedAt: at,
      moderationEvents: events(s, "published", actor, feedback),
    };
    await commitStoryChanges([{ before: s, after: next }]);
    return next;
  }
  const parent = await getStoryById(s.revisionOf);
  if (
    !parent ||
    parent.user !== s.user ||
    !["published", "unpublished"].includes(parent.status) ||
    parent.pendingRevisionId !== s.id ||
    parent.updatedAt !== s.revisionBaseUpdatedAt
  )
    throw new PublicationError(
      "The original article changed or was moderated. This revision cannot overwrite it. Request changes or cancel its schedule.",
    );
  const live: Story = {
    ...parent,
    title: s.title,
    summary: s.summary,
    body: s.body,
    document: s.document,
    tags: s.tags,
    canonicalUrl: s.canonicalUrl,
    searchMetadata: s.searchMetadata,
    authorName: s.authorName,
    status: "published",
    pendingRevisionId: null,
    reviewedAt: s.status === "scheduled" ? s.reviewedAt : at,
    reviewNote: feedback,
    updatedAt: nextTime(parent),
    moderationEvents: events(parent, "revision_applied", actor, feedback),
    versions: [
      ...(parent.versions || []),
      {
        savedAt: parent.updatedAt,
        title: parent.title,
        summary: parent.summary,
        body: parent.body,
        document: parent.document,
        tags: parent.tags,
      },
    ].slice(-10),
  };
  const archived: Story = {
    ...s,
    status: "archived",
    slug: parent.slug,
    scheduledFor: null,
    requestedPublishAt: null,
    reviewedAt: live.reviewedAt,
    reviewNote: feedback,
    publishedAt: at,
    updatedAt: at,
    moderationEvents: events(s, "revision_applied", actor, feedback),
  };
  await commitStoryChanges([
    { before: parent, after: live },
    { before: s, after: archived },
  ]);
  return archived;
}
export async function reviewSubmittedStory(
  id: string,
  action: "publish" | "changes",
  note: string,
  actor: string | null,
  version?: string,
) {
  const s = await getStoryById(id);
  if (
    !s ||
    (s.status !== "submitted" &&
      !(action === "changes" && s.status === "scheduled"))
  )
    throw new PublicationError("Only submitted stories can be reviewed.");
  if (version) expected(s, version);
  if (action === "changes") {
    const next: Story = {
      ...s,
      status: "changes_requested",
      scheduledFor: null,
      requestedPublishAt: null,
      reviewedAt: nextTime(s),
      reviewNote: note.trim().slice(0, 1000) || null,
      updatedAt: nextTime(s),
      moderationEvents: events(
        s,
        "changes_requested",
        actor,
        note.trim().slice(0, 1000) || null,
      ),
    };
    await commitStoryChanges([{ before: s, after: next }]);
    return next;
  }
  if (s.requestedPublishAt) {
    if (Date.parse(s.requestedPublishAt) < Date.now() + 60000)
      throw new PublicationError(
        "The requested publication time has passed or is too close. Request changes so the author can choose a new time.",
      );
    // Validate the parent now and again at execution time. Approval never
    // bypasses a later moderation decision.
    if (s.revisionOf) {
      const p = await getStoryById(s.revisionOf);
      if (
        !p ||
        p.pendingRevisionId !== s.id ||
        p.updatedAt !== s.revisionBaseUpdatedAt ||
        !["published", "unpublished"].includes(p.status)
      )
        throw new PublicationError(
          "The original article changed. Request a new revision.",
        );
    }
    const next: Story = {
      ...s,
      status: "scheduled",
      scheduledFor: s.requestedPublishAt,
      reviewedAt: nextTime(s),
      reviewNote: note.trim().slice(0, 1000) || null,
      updatedAt: nextTime(s),
      moderationEvents: events(
        s,
        "scheduled",
        actor,
        note.trim().slice(0, 1000) || null,
      ),
    };
    await commitStoryChanges([{ before: s, after: next }]);
    return next;
  }
  return publishApproved(s, actor, note);
}
export async function scheduledStories(): Promise<Story[]> {
  if (useMongo())
    return (await (
      await collection("stories")
    )
      .find({ status: "scheduled" })
      .sort({ scheduledFor: 1 })
      .limit(100)
      .toArray()) as Story[];
  return db()
    .prepare(
      "SELECT payload FROM stories WHERE status='scheduled' ORDER BY json_extract(payload,'$.scheduledFor') LIMIT 100",
    )
    .all()
    .map((r) => JSON.parse(String(r.payload)));
}
export async function publishDueStories(now = Date.now()) {
  const at = new Date(now).toISOString();
  const due: Story[] = useMongo()
    ? ((await (
        await collection("stories")
      )
        .find({
          status: "scheduled",
          scheduledFor: { $lte: at },
          reviewedAt: { $type: "string" },
        })
        .sort({ scheduledFor: 1 })
        .limit(20)
        .toArray()) as Story[])
    : db()
        .prepare(
          "SELECT payload FROM stories WHERE status='scheduled' AND json_extract(payload,'$.scheduledFor')<=? AND json_extract(payload,'$.reviewedAt') IS NOT NULL ORDER BY json_extract(payload,'$.scheduledFor') LIMIT 20",
        )
        .all(at)
        .map((r) => JSON.parse(String(r.payload)));
  let published = 0;
  for (const s of due) {
    try {
      await publishApproved(
        s,
        s.moderationEvents?.findLast((e) => e.action === "scheduled")?.actor ||
          null,
        s.reviewNote || "",
      );
      published++;
    } catch (e) {
      if (!(e instanceof PublicationError)) {
        if (/changed in another/.test(e instanceof Error ? e.message : ""))
          continue;
        throw e;
      }
      // A moderated or changed original stays protected. Return the revision
      // to its author instead of leaving an endlessly retrying scheduled job.
      const failed: Story = {
        ...s,
        status: "changes_requested",
        scheduledFor: null,
        requestedPublishAt: null,
        reviewNote: e.message,
        updatedAt: nextTime(s),
        moderationEvents: events(s, "changes_requested", null, e.message),
      };
      try {
        await commitStoryChanges([{ before: s, after: failed }]);
      } catch (conflict) {
        if (
          !/changed in another/.test(
            conflict instanceof Error ? conflict.message : "",
          )
        )
          throw conflict;
      }
    }
  }
  return { published };
}
