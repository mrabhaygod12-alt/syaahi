import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import { writerProfile } from "./profile";
import type { WriterProfile } from "./profile";
export class ConnectionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type ConnectionMode = "following" | "followers";
export async function connectionCounts(owner: string) {
  if (useMongo()) {
    const c = await collection("workspace_records");
    const [followers, following] = await Promise.all([
      c.countDocuments({
        kind: "writer-follow",
        "payload.creator": owner,
        "payload.active": true,
      }),
      c.countDocuments({
        kind: "writer-follow",
        owner,
        "payload.active": true,
      }),
    ]);
    return { followers, following };
  }
  return {
    followers: Number(
      db()
        .prepare(
          "SELECT COUNT(*) n FROM workspace_records WHERE kind='writer-follow' AND json_extract(payload,'$.creator')=? AND json_extract(payload,'$.active')=1",
        )
        .get(owner)?.n || 0,
    ),
    following: Number(
      db()
        .prepare(
          "SELECT COUNT(*) n FROM workspace_records WHERE kind='writer-follow' AND owner=? AND json_extract(payload,'$.active')=1",
        )
        .get(owner)?.n || 0,
    ),
  };
}
type Cursor = { at: string; id: string };
function readCursor(value: string) {
  if (!value) return null;
  try {
    if (value.length > 240 || !/^[A-Za-z0-9_-]+$/.test(value))
      throw new Error();
    const c = JSON.parse(Buffer.from(value, "base64url").toString()) as Cursor;
    if (
      !c ||
      !/^follow-[a-f0-9]{64}$/.test(c.id) ||
      !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(c.at) ||
      !Number.isFinite(Date.parse(c.at))
    )
      throw new Error();
    return c;
  } catch {
    throw new ConnectionError("Use a valid connections page cursor.");
  }
}
/** Private by default. Lists include verified public writer identities only. */
export async function writerConnections(
  owner: string,
  mode: string,
  cursor = "",
  viewer?: string,
) {
  if (!["following", "followers"].includes(mode))
    throw new ConnectionError("Choose followers or following.");
  const profile = await writerProfile(owner);
  if (!profile) throw new ConnectionError("Writer unavailable.", 404);
  if (viewer !== owner && !profile.showConnections)
    throw new ConnectionError(
      "This writer keeps their connections private.",
      403,
    );
  const after = readCursor(cursor);
  const rows = useMongo()
    ? (
        await (
          await collection("workspace_records")
        )
          .aggregate([
            {
              $match: {
                kind: "writer-follow",
                "payload.active": true,
                ...(mode === "following"
                  ? { owner }
                  : { "payload.creator": owner }),
                ...(after
                  ? {
                      $or: [
                        { updatedAt: { $lt: after.at } },
                        { updatedAt: after.at, _id: { $lt: after.id } },
                      ],
                    }
                  : {}),
              },
            },
            { $sort: { updatedAt: -1, _id: -1 } },
            {
              $set: {
                writerOwner:
                  mode === "following" ? "$payload.creator" : "$owner",
              },
            },
            {
              $lookup: {
                from: "workspace_records",
                localField: "writerOwner",
                foreignField: "owner",
                pipeline: [
                  { $match: { kind: "writer-profile" } },
                  { $limit: 1 },
                  { $project: { _id: 1 } },
                ],
                as: "writer",
              },
            },
            {
              $lookup: {
                from: "verified_accounts",
                localField: "writerOwner",
                foreignField: "_id",
                as: "verified",
              },
            },
            {
              $match: {
                "writer.0": { $exists: true },
                "verified.0": { $exists: true },
              },
            },
            { $limit: 30 },
            { $project: { payload: 1 } },
          ])
          .toArray()
      ).map((r) => r.payload)
    : db()
        .prepare(
          `SELECT f.payload FROM workspace_records f JOIN workspace_records p ON p.owner=${mode === "following" ? "json_extract(f.payload,'$.creator')" : "f.owner"} AND p.kind='writer-profile' JOIN verified_accounts v ON v.user_id=p.owner WHERE f.kind='writer-follow' AND json_extract(f.payload,'$.active')=1 AND ${mode === "following" ? "f.owner" : "json_extract(f.payload,'$.creator')"}=? ${after ? "AND (f.updated_at<? OR (f.updated_at=? AND f.id<?))" : ""} ORDER BY f.updated_at DESC,f.id DESC LIMIT 30`,
        )
        .all(owner, ...(after ? [after.at, after.at, after.id] : []))
        .map((r) => JSON.parse(String(r.payload)));
  const ids = [
    ...new Set<string>(
      rows.map((r) => (mode === "following" ? r.creator : r.owner)),
    ),
  ];
  let profiles: WriterProfile[] = [];
  if (ids.length) {
    if (useMongo()) {
      const [writers, verified] = await Promise.all([
        (await collection("workspace_records"))
          .find({ kind: "writer-profile", owner: { $in: ids } })
          .toArray(),
        (await collection("verified_accounts"))
          .find({ _id: { $in: ids } }, { projection: { _id: 1 } })
          .toArray(),
      ]);
      const valid = new Set(verified.map((r) => r._id));
      profiles = writers
        .filter((r) => valid.has(r.owner))
        .map((r) => r.payload);
    } else {
      profiles = db()
        .prepare(
          `SELECT p.payload FROM workspace_records p JOIN verified_accounts v ON v.user_id=p.owner WHERE p.kind='writer-profile' AND p.owner IN (${ids.map(() => "?").join(",")})`,
        )
        .all(...ids)
        .map((r) => JSON.parse(String(r.payload)));
    }
  }
  const byOwner = new Map(profiles.map((p) => [p.owner, p]));
  const last = rows.at(-1);
  return {
    mode,
    writers: ids.flatMap((id) => {
      const p = byOwner.get(id);
      return p
        ? [{ slug: p.slug, name: p.name, bio: p.bio, avatar: p.avatar }]
        : [];
    }),
    nextCursor:
      rows.length === 30 && last
        ? Buffer.from(
            JSON.stringify({ at: last.updatedAt, id: last.id }),
          ).toString("base64url")
        : null,
    counts: await connectionCounts(owner),
    publicLists: !!profile.showConnections,
  };
}
