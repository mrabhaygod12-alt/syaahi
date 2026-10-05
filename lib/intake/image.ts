import sharp from "sharp";
import { createHash } from "node:crypto";
export interface ScanPreparation {
  rotation: 0 | 90 | 180 | 270;
  crop: { x: number; y: number; width: number; height: number };
}
export function scanPreparation(value: any): ScanPreparation {
  const rotation = value?.rotation ?? 0,
    crop = value?.crop ?? { x: 0, y: 0, width: 100, height: 100 };
  if (
    ![0, 90, 180, 270].includes(rotation) ||
    ![crop.x, crop.y, crop.width, crop.height].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width < 1 ||
    crop.height < 1 ||
    crop.x + crop.width > 100 ||
    crop.y + crop.height > 100
  )
    throw new Error(
      "Choose a crop within the image and a quarter-turn rotation.",
    );
  return {
    rotation,
    crop: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
  };
}
export async function prepareScan(bytes: Buffer, value: unknown) {
  const preparation = scanPreparation(value);
  // Crop coordinates describe the EXIF-oriented and quarter-turned image.
  const pipeline = sharp(bytes, { limitInputPixels: 20_000_000 }),
    meta = await pipeline.metadata();
  let width = meta.autoOrient.width,
    height = meta.autoOrient.height;
  if (preparation.rotation % 180) [width, height] = [height, width];
  const c = preparation.crop;
  const left = Math.floor((width * c.x) / 100),
    top = Math.floor((height * c.y) / 100);
  const outWidth = Math.min(
      width - left,
      Math.max(1, Math.round((width * c.width) / 100)),
    ),
    outHeight = Math.min(
      height - top,
      Math.max(1, Math.round((height * c.height) / 100)),
    );
  const prepared = await pipeline
    .autoOrient()
    .rotate(preparation.rotation)
    .extract({ left, top, width: outWidth, height: outHeight })
    .png()
    .toBuffer();
  if (prepared.length > 8 * 1024 * 1024)
    throw new Error("Crop a smaller area before extraction.");
  return {
    bytes: prepared,
    provenance: {
      ...preparation,
      originalHash: createHash("sha256").update(bytes).digest("hex"),
      width: outWidth,
      height: outHeight,
    },
  };
}
