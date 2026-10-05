export interface ScanReview {
  id: string;
  name: string;
  rotation: 0 | 90 | 180 | 270;
  crop: { x: number; y: number; width: number; height: number };
  originalHash: string;
  width: number;
  height: number;
  unclearCount: number;
  reviewed: boolean;
}
/** Descriptive extraction provenance, never an authorization or confidence score. */
export function scanReviews(value: unknown): ScanReview[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((v) => {
    const c = v?.crop;
    if (
      !v ||
      typeof v.id !== "string" ||
      !/^[-\w]{1,80}$/.test(v.id) ||
      typeof v.name !== "string" ||
      ![0, 90, 180, 270].includes(v.rotation) ||
      !/^[a-f0-9]{64}$/.test(v.originalHash) ||
      ![v.width, v.height, v.unclearCount].every(
        (n) => Number.isInteger(n) && n >= 0,
      ) ||
      v.width < 1 ||
      v.height < 1 ||
      v.width * v.height > 20_000_000 ||
      !c ||
      ![c.x, c.y, c.width, c.height].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) ||
      c.x < 0 ||
      c.y < 0 ||
      c.width < 1 ||
      c.height < 1 ||
      c.x + c.width > 100 ||
      c.y + c.height > 100
    )
      return [];
    return [
      {
        id: v.id,
        name: v.name.slice(0, 160),
        rotation: v.rotation,
        crop: { x: c.x, y: c.y, width: c.width, height: c.height },
        originalHash: v.originalHash,
        width: v.width,
        height: v.height,
        unclearCount: Math.min(v.unclearCount, 10000),
        reviewed: v.reviewed === true,
      },
    ];
  });
}
