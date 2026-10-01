import { useMongo, collection } from "@/lib/storage/mongo";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { currentUser } from "@/lib/auth/server";

// Minimal in-memory IP throttle for expensive routes (dev + single-server).
// Production multi-instance needs Upstash/Redis: same call shape, swap inside.
const hits = new Map<string, number[]>();

export function throttle(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 2000) {
    const oldest = [...hits.keys()][0];
    hits.delete(oldest);
  }
  return arr.length <= limit;
}

export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "local";
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

/** 429 response when over limit. Returns null when allowed. */
export async function rateLimit(
  req: Request,
  route: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)syaahi-session=([a-f0-9]{64})(?:;|$)/)?.[1];
  // A caller can invent or rotate cookie values. Only a verified session may
  // select an account bucket; anonymous callers always share their IP bucket.
  const user =
    token && !["auth", "oauth", "public-share"].includes(route)
      ? await currentUser(req)
      : null;
  const identity = user
    ? `user:${createHash("sha256").update(user.id).digest("hex")}`
    : `ip:${clientIp(req)}`;
  let allowed: boolean;
  if (useMongo()) {
    const bucket = Math.floor(Date.now() / windowMs);
    const entry = await (
      await collection("limits")
    ).findOneAndUpdate(
      { _id: `${route}:${identity}:${bucket}` },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) },
      },
      { upsert: true, returnDocument: "after" },
    );
    allowed = Number(entry?.count) <= limit;
  } else allowed = throttle(`${route}:${identity}`, limit, windowMs);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests: slow down a little." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) },
      },
    );
  }
  return null;
}
