import {
  record,
  mutateRecord,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import { writerProfile, writerBySlug } from "./profile";
import { ownedStory, listPublicStoriesByCreator, type Story } from "./stories";

export interface WriterPins extends WorkspaceRecord {
  kind: "writer-pins";
  storyIds: string[];
}
export type PinAction = "pin" | "unpin" | "move_up" | "move_down";
export class WriterPinError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const key = (owner: string) => `writer-pins:${owner}`;
export const readPins = async (owner: string): Promise<WriterPins> =>
  (await record<WriterPins>(key(owner))) || {
    id: key(owner),
    owner,
    kind: "writer-pins",
    storyIds: [],
    updatedAt: "",
  };
export async function changePin(owner: string, input: unknown) {
  const b = input as Record<string, unknown> | null;
  if (
    !b ||
    typeof b.storyId !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(b.storyId) ||
    typeof b.action !== "string" ||
    !["pin", "unpin", "move_up", "move_down"].includes(b.action) ||
    typeof b.expectedUpdatedAt !== "string" ||
    b.expectedUpdatedAt.length > 50
  )
    throw new WriterPinError(
      "Choose a story action and its current saved pin revision.",
    );
  if (!(await writerProfile(owner)))
    throw new WriterPinError("Complete writer enrollment first.", 403);
  // Visibility is checked again on every public read. A concurrent withdrawal or
  // takedown can never make a private story visible through its saved pin.
  if (b.action === "pin") {
    const story = await ownedStory(owner, b.storyId);
    if (!story) throw new WriterPinError("Story not found.", 404);
    if (story.status !== "published" || !story.slug)
      throw new WriterPinError(
        "Only approved, currently published stories can be pinned.",
      );
  }
  return mutateRecord<WriterPins>(key(owner), (old) => {
    if ((old?.updatedAt || "") !== b.expectedUpdatedAt)
      throw new WriterPinError(
        "Your pins changed in another tab. Reload before continuing.",
        409,
      );
    const ids = [...(old?.storyIds || [])],
      at = ids.indexOf(b.storyId as string);
    if (b.action === "pin" && at < 0) {
      if (ids.length >= 3)
        throw new WriterPinError(
          "Pin up to three stories. Unpin one before adding another.",
        );
      ids.push(b.storyId as string);
    } else if (b.action === "unpin" && at >= 0) ids.splice(at, 1);
    else if (b.action === "move_up" || b.action === "move_down") {
      if (at < 0)
        throw new WriterPinError(
          "This story is no longer pinned. Reload before continuing.",
          409,
        );
      const to = at + (b.action === "move_up" ? -1 : 1);
      if (to >= 0 && to < ids.length) [ids[to], ids[at]] = [ids[at], ids[to]];
    }
    if (old && ids.join("\n") === old.storyIds.join("\n")) return old;
    return {
      id: key(owner),
      owner,
      kind: "writer-pins",
      storyIds: ids,
      updatedAt: new Date(
        Math.max(Date.now(), Date.parse(old?.updatedAt || "") + 1 || 0),
      ).toISOString(),
    };
  });
}
export async function pinWorkspace(owner: string) {
  const pins = await readPins(owner);
  const saved = await Promise.all(
    pins.storyIds.map((id) => ownedStory(owner, id)),
  );
  let recent: Story[];
  if (useMongo()) {
    recent = (await (
      await collection("stories")
    )
      .find(
        { user: owner, status: "published" },
        { projection: { _id: 0, id: 1, title: 1, slug: 1, status: 1 } },
      )
      .sort({ publishedAt: -1, _id: -1 })
      .limit(50)
      .toArray()) as unknown as Story[];
  } else {
    recent = db()
      .prepare(
        "SELECT id,json_extract(payload,'$.title') title,json_extract(payload,'$.slug') slug,status FROM stories WHERE user_id=? AND status='published' ORDER BY updated_at DESC,id DESC LIMIT 50",
      )
      .all(owner)
      .map(
        (r) =>
          ({
            id: String(r.id),
            title: String(r.title),
            slug: String(r.slug),
            status: String(r.status),
          }) as Story,
      );
  }
  const summary = (s: Story) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    published: s.status === "published",
  });
  return {
    updatedAt: pins.updatedAt,
    pinned: pins.storyIds.map((id, i) =>
      saved[i]
        ? summary(saved[i]!)
        : { id, title: "Unavailable story", slug: null, published: false },
    ),
    choices: recent.map(summary),
  };
}
export async function creatorStoriesWithPins(slug: string) {
  const [profile, recent] = await Promise.all([
    writerBySlug(slug),
    listPublicStoriesByCreator(slug),
  ]);
  if (!profile) return { profile, stories: recent, pinned: new Set<string>() };
  const pins = await readPins(profile.owner);
  const saved = await Promise.all(
    pins.storyIds.map((id) => ownedStory(profile.owner, id)),
  );
  const pinned = saved.filter(
    (s): s is Story =>
      !!s &&
      s.status === "published" &&
      !!s.slug &&
      s.creatorSlug === profile.slug,
  );
  const ids = new Set(pinned.map((s) => s.id));
  return {
    profile,
    stories: [...pinned, ...recent.filter((s) => !ids.has(s.id))].slice(0, 100),
    pinned: ids,
  };
}
