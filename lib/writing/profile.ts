import { NextResponse } from "next/server";
import {
  record,
  mutateRecord,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import type { Account } from "@/lib/auth/server";
import sharp from "sharp";

export interface WriterProfile extends WorkspaceRecord {
  kind: "writer-profile";
  slug: string;
  name: string;
  bio: string;
  pronouns: string[];
  about: string;
  avatar: string;
  website: string;
  appearance: "light" | "dark" | "system";
  joinedAt: string;
}
export const writerProfile = (user: string) =>
  record<WriterProfile>(`writer-profile:${user}`);
export async function writerAccess(user: string) {
  return (await writerProfile(user))
    ? null
    : NextResponse.json(
        {
          error:
            "Create your writer profile with the same email before opening the writing workspace.",
          code: "WRITER_ENROLLMENT_REQUIRED",
        },
        { status: 403 },
      );
}
// Enrollment is explicit. A dashboard preference, billing plan or old session never grants it.
export async function enrollWriter(account: Pick<Account, "id" | "name">) {
  const existing = await writerProfile(account.id);
  if (existing) return existing;
  const { listStories } = await import("./stories");
  const previousSlug = (await listStories(account.id)).find(
    (s) => s.creatorSlug,
  )?.creatorSlug;
  return mutateRecord<WriterProfile>(
    `writer-profile:${account.id}`,
    (old) =>
      old || {
        id: `writer-profile:${account.id}`,
        owner: account.id,
        kind: "writer-profile",
        slug:
          previousSlug ||
          `${
            account.name
              .toLowerCase()
              .normalize("NFKD")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 56) || "syaahi-creator"
          }-${account.id.slice(0, 8)}`,
        name: account.name.slice(0, 50),
        bio: "",
        pronouns: [],
        about: "",
        avatar: "",
        website: "",
        appearance: "system",
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
  );
}
export async function updateWriterProfile(
  user: string,
  input: Record<string, unknown>,
) {
  const old = await writerProfile(user);
  if (!old) throw new Error("Complete writer signup first.");
  const name = typeof input.name === "string" ? input.name.trim() : old.name;
  if (!name || name.length > 50)
    throw new Error("Name must contain 1–50 characters.");
  const bio = typeof input.bio === "string" ? input.bio.trim() : old.bio;
  const about =
    typeof input.about === "string" ? input.about.trim() : old.about;
  if (bio.length > 160 || about.length > 5000)
    throw new Error("Bio is limited to 160 characters and About to 5,000.");
  const pronouns = input.pronouns === undefined ? old.pronouns : input.pronouns;
  if (
    !Array.isArray(pronouns) ||
    pronouns.length > 4 ||
    pronouns.some((p) => typeof p !== "string" || !p.trim() || p.length > 20)
  )
    throw new Error("Choose up to four pronouns, at most 20 characters each.");
  const website =
    typeof input.website === "string" ? input.website.trim() : old.website;
  if (website && (website.length > 500 || !/^https:\/\//i.test(website)))
    throw new Error("Use an HTTPS website address.");
  if (website) {
    const url = new URL(website);
    if (url.username || url.password)
      throw new Error("Website addresses cannot include credentials.");
  }
  let avatar = typeof input.avatar === "string" ? input.avatar : old.avatar;
  if (
    avatar &&
    (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) ||
      avatar.length > 700000)
  )
    throw new Error("Upload a PNG, JPEG or WebP photo under 500 KB.");
  if (avatar && avatar !== old.avatar) {
    try {
      const image = sharp(Buffer.from(avatar.split(",")[1], "base64"), {
        limitInputPixels: 24000000,
        animated: false,
      });
      const info = await image.metadata();
      if (!["png", "jpeg", "webp"].includes(info.format || ""))
        throw new Error();
      const bytes = await image
        .rotate()
        .resize(400, 400, { fit: "cover", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      avatar = `data:image/webp;base64,${bytes.toString("base64")}`;
    } catch {
      throw new Error(
        "This photo could not be read. Choose a valid PNG, JPEG or WebP image.",
      );
    }
  }
  const appearance =
    input.appearance === undefined ? old.appearance : input.appearance;
  if (!["light", "dark", "system"].includes(String(appearance)))
    throw new Error("Choose a supported appearance.");
  return mutateRecord<WriterProfile>(old.id, (current) => {
    if (
      !current ||
      (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt)
    )
      throw new Error(
        "Your profile changed in another tab. Refresh before saving.",
      );
    return {
      ...current,
      name,
      bio,
      about,
      pronouns: [...new Set(pronouns.map((p) => p.trim()))],
      website,
      avatar,
      appearance: appearance as WriterProfile["appearance"],
      updatedAt: new Date(
        Math.max(Date.now(), Date.parse(current.updatedAt) + 1),
      ).toISOString(),
    };
  });
}
export function publicWriterProfile(p: WriterProfile) {
  return {
    slug: p.slug,
    name: p.name,
    bio: p.bio,
    about: p.about,
    pronouns: p.pronouns,
    avatar: p.avatar,
    website: p.website,
    joinedAt: p.joinedAt,
  };
}
export async function writerNames(
  users: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(users)];
  if (!ids.length) return new Map();
  if (useMongo()) {
    const rows = await (
      await collection("workspace_records")
    )
      .find(
        { kind: "writer-profile", owner: { $in: ids } },
        { projection: { owner: 1, "payload.name": 1 } },
      )
      .toArray();
    return new Map(rows.map((r) => [String(r.owner), String(r.payload.name)]));
  }
  const placeholders = ids.map(() => "?").join(",");
  const rows = db()
    .prepare(
      `SELECT owner,json_extract(payload,'$.name') name FROM workspace_records WHERE kind='writer-profile' AND owner IN (${placeholders})`,
    )
    .all(...ids);
  return new Map(rows.map((r) => [String(r.owner), String(r.name)]));
}
export async function writerBySlug(slug: string) {
  const { rewardSummary } = await import("@/lib/billing/rewards");
  if (useMongo()) {
    const row = await (
      await collection("workspace_records")
    ).findOne({ kind: "writer-profile", "payload.slug": slug });
    const profile = (row?.payload || null) as WriterProfile | null;
    return profile && (await rewardSummary(profile.owner)).emailVerified
      ? profile
      : null;
  }
  const row = db()
    .prepare(
      "SELECT payload FROM workspace_records WHERE kind='writer-profile' AND json_extract(payload,'$.slug')=?",
    )
    .get(slug);
  const profile = row
    ? (JSON.parse(String(row.payload)) as WriterProfile)
    : null;
  return profile && (await rewardSummary(profile.owner)).emailVerified
    ? profile
    : null;
}
