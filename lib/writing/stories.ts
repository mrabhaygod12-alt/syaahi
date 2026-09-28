import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";

export type StoryStatus = "draft" | "submitted";
export interface Story {
  id: string;
  user: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
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

export async function saveStory(
  user: string,
  input: Pick<Story, "title" | "summary" | "body" | "tags"> & {
    id?: string;
    submit?: boolean;
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
    if (existing.status !== "draft") throw new Error("This submission is under editorial review.");
    const story: Story = {
      ...existing,
      title,
      summary,
      body,
      tags,
      status: input.submit ? "submitted" : "draft",
      updatedAt: now,
      submittedAt: input.submit ? now : null,
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
    title,
    summary,
    body,
    tags,
    status: input.submit ? "submitted" : "draft",
    createdAt: now,
    updatedAt: now,
    submittedAt: input.submit ? now : null,
  };
  if (useMongo()) await (await collection("stories")).insertOne({ _id: story.id, ...story });
  else
    transaction(() =>
      db().prepare("INSERT INTO stories (id,user_id,status,updated_at,payload) VALUES (?,?,?,?,?)")
        .run(story.id, user, story.status, story.updatedAt, JSON.stringify(story)),
    );
  return story;
}
