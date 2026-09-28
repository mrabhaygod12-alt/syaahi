import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";

export type StoryStatus =
  | "draft"
  | "submitted"
  | "changes_requested"
  | "published";
export interface Story {
  id: string;
  user: string;
  authorName: string;
  creatorSlug: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  reviewNote: string | null;
  slug: string | null;
  versions?: Array<{ savedAt: string; title: string; summary: string; body: string; tags: string[] }>;
}

function clean(value: unknown): Story | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<Story>;
  if (typeof s.id !== "string" || typeof s.user !== "string") return null;
  return s as Story;
}

export async function listStories(user: string): Promise<Story[]> {
  if (useMongo())
    return (await (await collection("stories"))
      .find({ user })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray())
      .map(clean)
      .filter((s): s is Story => !!s);
  return db()
    .prepare("SELECT payload FROM stories WHERE user_id=? ORDER BY updated_at DESC LIMIT 50")
    .all(user)
    .map((row: any) => clean(JSON.parse(String(row.payload))))
    .filter((s): s is Story => !!s);
}

export async function listReviewStories(): Promise<Story[]> {
  if (useMongo())
    return (await (await collection("stories"))
      .find({ status: { $in: ["submitted", "changes_requested"] } })
      .sort({ submittedAt: 1 })
      .limit(100)
      .toArray())
      .map(clean)
      .filter((s): s is Story => !!s);
  return db()
    .prepare("SELECT payload FROM stories WHERE status IN ('submitted','changes_requested') ORDER BY updated_at ASC LIMIT 100")
    .all()
    .map((row: any) => clean(JSON.parse(String(row.payload))))
    .filter((s): s is Story => !!s);
}

export async function listPublicStories(): Promise<Story[]> {
  if (useMongo())
    return (await (await collection("stories"))
      .find({ status: "published" })
      .sort({ publishedAt: -1 })
      .limit(48)
      .toArray())
      .map(clean)
      .filter((s): s is Story => !!s);
  return db()
    .prepare("SELECT payload FROM stories WHERE status='published' ORDER BY updated_at DESC LIMIT 48")
    .all()
    .map((row: any) => clean(JSON.parse(String(row.payload))))
    .filter((s): s is Story => !!s);
}

export async function listPublicStoriesByCreator(
  creatorSlug: string,
): Promise<Story[]> {
  const normalized = creatorSlug.trim().toLowerCase().slice(0, 120);
  return (await listPublicStories()).filter(
    (story) => story.creatorSlug === normalized,
  );
}

export async function getPublicStory(slug: string): Promise<Story | null> {
  const normalized = slug.trim().toLowerCase().slice(0, 160);
  if (!normalized) return null;
  if (useMongo())
    return clean(
      await (await collection("stories")).findOne({
        status: "published",
        slug: normalized,
      }),
    );
  return (
    (await listPublicStories()).find((story) => story.slug === normalized) ??
    null
  );
}

const toSlug = (title: string, id: string) =>
  `${title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "study-guide"}-${id.slice(0, 8)}`;

const toCreatorSlug = (name: string, id: string) =>
  `${name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56) || "syaahi-creator"}-${id.slice(0, 8)}`;

export async function saveStory(
  user: string,
  input: Pick<Story, "title" | "summary" | "body" | "tags"> & {
    id?: string;
    submit?: boolean;
    authorName: string;
  },
): Promise<Story> {
  const now = new Date().toISOString();
  const title = input.title.trim().slice(0, 140);
  const summary = input.summary.trim().slice(0, 320);
  const body = input.body.trim().slice(0, 50000);
  const tags = [...new Set(input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
    .slice(0, 5)
    .map((tag) => tag.slice(0, 32));
  if (title.length < 5 || body.length < 80)
    throw new Error("Add a title and at least 80 characters before saving.");
  if (input.id) {
    const existing = useMongo()
      ? clean(await (await collection("stories")).findOne({ _id: input.id, user }))
      : clean(
          (() => {
            const row = db().prepare("SELECT payload FROM stories WHERE id=? AND user_id=?").get(input.id, user) as any;
            return row ? JSON.parse(String(row.payload)) : null;
          })(),
        );
    if (!existing) throw new Error("Draft not found.");
    if (!["draft", "changes_requested"].includes(existing.status))
      throw new Error("This submission is under editorial review.");
    const story: Story = {
      ...existing,
      creatorSlug: existing.creatorSlug || toCreatorSlug(existing.authorName, user),
      title,
      summary,
      body,
      tags,
      status: input.submit ? "submitted" : "draft",
      updatedAt: now,
      submittedAt: input.submit ? now : null,
      reviewedAt: input.submit ? null : existing.reviewedAt,
      reviewNote: input.submit ? null : existing.reviewNote,
      versions: [
        ...(existing.versions || []),
        { savedAt: existing.updatedAt, title: existing.title, summary: existing.summary, body: existing.body, tags: existing.tags },
      ].slice(-10),
    };
    if (useMongo())
      await (await collection("stories")).updateOne({ _id: story.id, user }, { $set: { ...story, _id: story.id } });
    else
      transaction(() =>
        db().prepare("UPDATE stories SET status=?,updated_at=?,payload=? WHERE id=? AND user_id=?")
          .run(story.status, story.updatedAt, JSON.stringify(story), story.id, user),
      );
    return story;
  }
  const story: Story = {
    id: randomUUID(),
    user,
    authorName: input.authorName.trim().slice(0, 80) || "Syaahi creator",
    creatorSlug: toCreatorSlug(input.authorName.trim() || "Syaahi creator", user),
    title,
    summary,
    body,
    tags,
    status: input.submit ? "submitted" : "draft",
    createdAt: now,
    updatedAt: now,
    submittedAt: input.submit ? now : null,
    reviewedAt: null,
    publishedAt: null,
    reviewNote: null,
    slug: null,
  };
  if (useMongo()) await (await collection("stories")).insertOne({ _id: story.id, ...story });
  else
    transaction(() =>
      db().prepare("INSERT INTO stories (id,user_id,status,updated_at,payload) VALUES (?,?,?,?,?)")
        .run(story.id, user, story.status, story.updatedAt, JSON.stringify(story)),
    );
  return story;
}

export async function reviewStory(
  id: string,
  action: "publish" | "changes",
  note: string,
): Promise<Story> {
  const now = new Date().toISOString();
  const existing = useMongo()
    ? clean(await (await collection("stories")).findOne({ _id: id }))
    : clean(
        (() => {
          const row = db().prepare("SELECT payload FROM stories WHERE id=?").get(id) as any;
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
  };
  if (useMongo())
    await (await collection("stories")).updateOne({ _id: id }, { $set: { ...story, _id: id } });
  else
    transaction(() =>
      db().prepare("UPDATE stories SET status=?,updated_at=?,payload=? WHERE id=?")
        .run(story.status, story.updatedAt, JSON.stringify(story), id),
    );
  return story;
}
