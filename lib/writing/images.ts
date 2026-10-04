import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import { documentImages, type RichNode } from "./document";

export async function uploadWritingImage(
  owner: string,
  input: Uint8Array,
  alt: string,
) {
  if (input.byteLength > 4 * 1024 * 1024 || !alt.trim())
    throw new Error("Use an image under 4 MB and provide alt text.");
  const image = sharp(input, { limitInputPixels: 24_000_000, animated: false });
  const info = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(info.format || ""))
    throw new Error("Upload a JPEG, PNG or WebP image.");
  const bytes = await image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  if (bytes.length > 1024 * 1024)
    throw new Error("Image is too large after processing.");
  const id = randomUUID(),
    createdAt = new Date().toISOString();
  if (useMongo()) {
    const c = await collection("writing_images");
    if ((await c.countDocuments({ owner })) >= 200)
      throw new Error("Image library limit reached. Contact support.");
    await c.insertOne({
      _id: id,
      owner,
      bytes,
      alt: alt.trim().slice(0, 300),
      createdAt,
    });
  } else {
    if (
      Number(
        db()
          .prepare("SELECT COUNT(*) AS n FROM writing_images WHERE owner=?")
          .get(owner)?.n,
      ) >= 200
    )
      throw new Error("Image library limit reached.");
    db()
      .prepare("INSERT INTO writing_images VALUES (?,?,?,?,?)")
      .run(id, owner, bytes, alt.trim().slice(0, 300), createdAt);
  }
  return {
    id,
    url: `/api/writing/images/${id}`,
    alt: alt.trim().slice(0, 300),
  };
}
export async function writingImage(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  if (useMongo()) {
    const row = await (await collection("writing_images")).findOne({ _id: id });
    return row
      ? {
          owner: row.owner as string,
          bytes: Buffer.isBuffer(row.bytes)
            ? row.bytes
            : Buffer.from(row.bytes.buffer),
        }
      : null;
  }
  const row = db()
    .prepare("SELECT owner,bytes FROM writing_images WHERE id=?")
    .get(id);
  return row
    ? { owner: String(row.owner), bytes: Buffer.from(row.bytes as Uint8Array) }
    : null;
}
export async function assertOwnedImages(owner: string, document: RichNode) {
  const ids = [...new Set(documentImages(document))];
  if (ids.length > 30) throw new Error("Use up to 30 images per story.");
  for (const id of ids) {
    const found = useMongo()
      ? await (
          await collection("writing_images")
        ).findOne({ _id: id, owner }, { projection: { _id: 1 } })
      : db()
          .prepare("SELECT id FROM writing_images WHERE id=? AND owner=?")
          .get(id, owner);
    if (!found) throw new Error("This image does not belong to your account.");
  }
}
export async function imageIsPublished(id: string, owner: string) {
  if (useMongo()) {
    const cursor = (await collection("stories")).find(
      { user: owner, status: "published" },
      { projection: { document: 1 } },
    );
    try {
      for await (const row of cursor)
        if (documentImages(row.document).includes(id)) return true;
      return false;
    } finally {
      await cursor.close();
    }
  }
  const rows = db()
    .prepare(
      "SELECT payload FROM stories WHERE user_id=? AND status='published'",
    )
    .all(owner)
    .map((row) => JSON.parse(String(row.payload)));
  return rows.some((row) => documentImages(row.document).includes(id));
}
