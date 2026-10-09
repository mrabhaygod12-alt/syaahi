import { createHash, randomUUID } from "node:crypto";
import {
  record,
  mutateRecord,
  records,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import { writerBySlug } from "./profile";
import { getPublicStory } from "./stories";
import { connectionCounts } from "./connections";
const id = (parts: string[]) =>
  createHash("sha256").update(parts.join(":")).digest("hex");
interface Follow extends WorkspaceRecord {
  kind: "writer-follow";
  creator: string;
  slug: string;
  name: string;
  active: boolean;
}
export async function followWriter(
  owner: string,
  slug: string,
  active: boolean,
) {
  const writer = await writerBySlug(slug);
  if (!writer) throw new Error("Writer unavailable.");
  if (writer.owner === owner)
    throw new Error("You cannot follow your own profile.");
  return mutateRecord<Follow>(`follow-${id([owner, writer.owner])}`, (old) => ({
    id: old?.id || `follow-${id([owner, writer.owner])}`,
    owner,
    kind: "writer-follow",
    creator: writer.owner,
    slug: writer.slug,
    name: writer.name,
    active,
    updatedAt: new Date().toISOString(),
  }));
}
export async function followStatus(slug: string, owner?: string) {
  const writer = await writerBySlug(slug);
  if (!writer) throw new Error("Writer unavailable.");
  const counts = await connectionCounts(writer.owner);
  const own = owner
    ? await record<Follow>(`follow-${id([owner, writer.owner])}`)
    : null;
  return {
    followers: counts.followers,
    followingCount: counts.following,
    following: !!own?.active,
    isOwn: owner === writer.owner,
  };
}
export async function following(owner: string): Promise<Follow[]> {
  if (useMongo())
    return (
      await (
        await collection("workspace_records")
      )
        .find({ kind: "writer-follow", owner, "payload.active": true })
        .sort({ updatedAt: -1 })
        .limit(240)
        .toArray()
    ).map((r) => r.payload);
  return db()
    .prepare(
      "SELECT payload FROM workspace_records WHERE kind='writer-follow' AND owner=? AND json_extract(payload,'$.active')=1 ORDER BY updated_at DESC LIMIT 240",
    )
    .all(owner)
    .map((r) => JSON.parse(String(r.payload)));
}
interface ResponseRecord extends WorkspaceRecord {
  kind: "story-response";
  storyId: string;
  slug: string;
  name: string;
  body: string;
  hidden: boolean;
  createdAt: string;
}
async function responseRows(storyId: string): Promise<ResponseRecord[]> {
  if (useMongo())
    return (
      await (
        await collection("workspace_records")
      )
        .find({
          kind: "story-response",
          "payload.storyId": storyId,
          "payload.hidden": false,
        })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray()
    ).map((r) => r.payload as ResponseRecord);
  return db()
    .prepare(
      "SELECT payload FROM workspace_records WHERE kind='story-response' AND json_extract(payload,'$.storyId')=? AND json_extract(payload,'$.hidden')=0 ORDER BY updated_at DESC LIMIT 100",
    )
    .all(storyId)
    .map((r) => JSON.parse(String(r.payload)));
}
export async function publicResponses(slug: string, viewer?: string) {
  const story = await getPublicStory(slug);
  if (!story) throw new Error("Story unavailable.");
  return (await responseRows(story.id)).map(
    ({ id, body, name, createdAt, owner }) => ({
      id,
      body,
      name,
      createdAt,
      canDelete: !!viewer && (viewer === owner || viewer === story.user),
    }),
  );
}
export async function respond(
  owner: string,
  name: string,
  slug: string,
  body: string,
  event: string,
) {
  if (
    body.trim().length < 2 ||
    body.length > 2000 ||
    !/^[-\w]{10,80}$/.test(event)
  )
    throw new Error("Write a response of 2–2000 characters.");
  const story = await getPublicStory(slug);
  if (!story) throw new Error("Story unavailable.");
  const key = `response-${id([owner, event])}`;
  return mutateRecord<ResponseRecord>(key, (old) => {
    if (old) {
      if (old.slug !== slug || old.body !== body.trim())
        throw new Error("Use a new request ID for a different response.");
      return old;
    }
    const now = new Date().toISOString();
    return {
      id: key,
      owner,
      kind: "story-response",
      storyId: story.id,
      slug,
      name: name.slice(0, 80),
      body: body.trim(),
      hidden: false,
      createdAt: now,
      updatedAt: now,
    };
  });
}
export async function removeResponse(owner: string, slug: string, key: string) {
  const story = await getPublicStory(slug);
  if (!story) throw new Error("Story unavailable.");
  return mutateRecord<ResponseRecord>(key, (old) => {
    if (
      !old ||
      old.kind !== "story-response" ||
      old.storyId !== story.id ||
      (old.owner !== owner && story.user !== owner)
    )
      throw new Error("Response unavailable.");
    return { ...old, hidden: true, updatedAt: new Date().toISOString() };
  });
}
export interface ReaderRecord extends WorkspaceRecord {
  kind: "story-reader";
  storyId: string;
  slug: string;
  creator: string;
  title: string;
  fraction: number;
  seconds: number;
  lastPing: number;
  qualified: boolean;
  highlights: { id: string; quote: string; note: string }[];
}
export async function readerState(owner: string, slug: string) {
  const story = await getPublicStory(slug);
  if (!story) throw new Error("Story unavailable.");
  return await record<ReaderRecord>(`reader-${id([owner, story.id])}`);
}
export async function readerAction(
  owner: string,
  slug: string,
  input: {
    action: string;
    fraction?: number;
    seconds?: number;
    quote?: string;
    note?: string;
    id?: string;
  },
) {
  const story = await getPublicStory(slug);
  if (!story) throw new Error("Story unavailable.");
  const key = `reader-${id([owner, story.id])}`,
    now = Date.now();
  return mutateRecord<ReaderRecord>(key, (old) => {
    const next: ReaderRecord = old || {
      id: key,
      owner,
      kind: "story-reader",
      storyId: story.id,
      slug,
      creator: story.user,
      title: story.title,
      fraction: 0,
      seconds: 0,
      lastPing: now,
      qualified: false,
      highlights: [],
      updatedAt: new Date(now).toISOString(),
    };
    if (input.action === "progress") {
      if (
        !Number.isFinite(input.fraction) ||
        input.fraction! < 0 ||
        input.fraction! > 1 ||
        !Number.isFinite(input.seconds) ||
        input.seconds! < 0 ||
        input.seconds! > 35
      )
        throw new Error("Invalid reading progress.");
      next.fraction = Math.max(next.fraction, input.fraction!);
      next.seconds += Math.min(
        input.seconds!,
        Math.max(0, (now - next.lastPing) / 1000),
      );
      next.lastPing = now;
      next.qualified = next.seconds >= 30;
    } else if (input.action === "highlight") {
      const quote = String(input.quote || "").trim(),
        note = String(input.note || "").trim();
      if (
        quote.length < 3 ||
        quote.length > 600 ||
        note.length > 1000 ||
        !story.body
          .normalize("NFKC")
          .replace(/\s+/g, " ")
          .includes(quote.normalize("NFKC").replace(/\s+/g, " "))
      )
        throw new Error(
          "Choose a passage from this story, up to 600 characters.",
        );
      if (next.highlights.length >= 50)
        throw new Error("Keep up to 50 highlights per story.");
      if (!next.highlights.some((h) => h.quote === quote))
        next.highlights.push({ id: randomUUID(), quote, note });
    } else if (input.action === "remove-highlight")
      next.highlights = next.highlights.filter((h) => h.id !== input.id);
    else if (input.action !== "start")
      throw new Error("Unsupported reader action.");
    return { ...next, updatedAt: new Date(now).toISOString() };
  });
}
export async function readingLibrary(owner: string) {
  const rows = await records<ReaderRecord>("story-reader", owner);
  return rows.map(
    ({ slug, title, fraction, seconds, highlights, updatedAt }) => ({
      slug,
      title,
      fraction,
      seconds,
      highlights,
      updatedAt,
    }),
  );
}
export async function writerReaderStats(creator: string) {
  const rows: ReaderRecord[] = useMongo()
    ? (
        await (
          await collection("workspace_records")
        )
          .find({
            kind: "story-reader",
            "payload.creator": creator,
            "payload.qualified": true,
          })
          .limit(10000)
          .toArray()
      ).map((r) => r.payload)
    : db()
        .prepare(
          "SELECT payload FROM workspace_records WHERE kind='story-reader' AND json_extract(payload,'$.creator')=? AND json_extract(payload,'$.qualified')=1 LIMIT 10000",
        )
        .all(creator)
        .map((r) => JSON.parse(String(r.payload)));
  const byStory: Record<string, number> = {};
  for (const r of rows) byStory[r.storyId] = (byStory[r.storyId] || 0) + 1;
  return {
    qualifiedReaders: rows.length,
    byStory,
    bounded: rows.length === 10000,
  };
}
