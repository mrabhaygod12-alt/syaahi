import { useMongo, collection } from "@/lib/storage/mongo";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { currentUser } from "@/lib/auth/server";
import { isIP } from "node:net";

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
  const valid = (value: string | null | undefined) =>
    value && isIP(value.trim()) ? value.trim() : null;
  // The frontend overwrites this private header; accept it only with the
  // authenticated proxy envelope, independently of generic header trust.
  const secret = process.env.BACKEND_PROXY_SECRET;
  if (secret && req.headers.get("x-syaahi-proxy") === secret)
    return valid(req.headers.get("x-syaahi-client-ip")) || "unknown";
  if (process.env.VERCEL === "1")
    return (
      valid(req.headers.get("x-vercel-forwarded-for")) ||
      valid(req.headers.get("x-forwarded-for")) ||
      "unknown"
    );
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "local";
  // Custom ingress must append a known number of hops and prevent direct access.
  const hops = Number(process.env.TRUSTED_PROXY_HOPS || "1");
  if (!Number.isInteger(hops) || hops < 1 || hops > 8) return "unknown";
  const chain =
    req.headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((ip) => ip.trim()) || [];
  return valid(chain[chain.length - hops]) || "unknown";
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
  if (
    !user &&
    process.env.APP_ROLE === "backend" &&
    ["ip:local", "ip:unknown"].includes(identity)
  )
    return NextResponse.json(
      {
        error:
          "Request ingress could not be verified. Please retry through the application.",
      },
      { status: 503, headers: { "Retry-After": "5" } },
    );
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
