import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { clientIp } from "@/lib/ratelimit";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
type Incident = {
  id: string;
  kind: string;
  count: number;
  blockedUntil: number;
  updatedAt: number;
  expiresAt: number;
};
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS security_incidents (id TEXT PRIMARY KEY,payload TEXT NOT NULL,expires INTEGER NOT NULL)",
  );
}
function identity(req: Request) {
  const ip = clientIp(req);
  if (["local", "unknown"].includes(ip) || ip.length > 80) return null;
  // Salted, rotating identity; never log raw IP, query strings, bodies or credentials.
  const salt =
    process.env.SECURITY_HASH_SALT || process.env.BACKEND_PROXY_SECRET;
  if (!salt) return null;
  return createHash("sha256")
    .update(salt + "\n" + new Date().toISOString().slice(0, 10) + "\n" + ip)
    .digest("hex");
}
export async function recordTrap(
  req: Request,
  kind: "path-probe" | "form-trap",
) {
  const id = identity(req),
    now = Date.now();
  if (!id) return;
  if (useMongo()) {
    const c = await collection("security_incidents");
    const saved = await c.findOneAndUpdate(
      { _id: id },
      {
        $inc: { count: 1 },
        $set: {
          kind,
          updatedAt: new Date(now),
          expiresAt: new Date(now + 7 * 86400000),
        },
        $setOnInsert: { blockedUntil: 0 },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (Number(saved?.count) >= 12)
      await c.updateOne(
        { _id: id },
        { $set: { blockedUntil: now + 15 * 60000 } },
      );
  } else {
    setup();
    db().prepare("DELETE FROM security_incidents WHERE expires<?").run(now);
    const row = db()
      .prepare("SELECT payload FROM security_incidents WHERE id=?")
      .get(id);
    const old: Incident = row
      ? JSON.parse(String(row.payload))
      : {
          id,
          kind,
          count: 0,
          blockedUntil: 0,
          updatedAt: now,
          expiresAt: now + 7 * 86400000,
        };
    old.count++;
    old.kind = kind;
    old.updatedAt = now;
    old.expiresAt = now + 7 * 86400000;
    if (old.count >= 12) old.blockedUntil = now + 15 * 60000;
    db()
      .prepare(
        "INSERT INTO security_incidents VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires=excluded.expires",
      )
      .run(id, JSON.stringify(old), old.expiresAt);
  }
}
export async function abuseGuard(req: Request) {
  const path = new URL(req.url).pathname;
  if (
    ["/api/health", "/api/razorpay/webhook", "/api/security/trap"].includes(
      path,
    )
  )
    return null;
  const id = identity(req);
  if (!id) return null;
  let blocked = 0;
  if (useMongo())
    blocked = Number(
      (await (await collection("security_incidents")).findOne({ _id: id }))
        ?.blockedUntil || 0,
    );
  else {
    setup();
    const row = db()
      .prepare(
        "SELECT payload FROM security_incidents WHERE id=? AND expires>?",
      )
      .get(id, Date.now());
    blocked = row ? JSON.parse(String(row.payload)).blockedUntil : 0;
  }
  return blocked > Date.now()
    ? NextResponse.json(
        {
          error:
            "Requests temporarily limited. Contact support if this persists.",
        },
        {
          status: 429,
          headers: { "Retry-After": "900", "Cache-Control": "no-store" },
        },
      )
    : null;
}
export async function recentIncidents() {
  if (useMongo())
    return (
      await (
        await collection("security_incidents")
      )
        .find({})
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray()
    ).map((r) => ({
      id: String(r._id).slice(0, 12),
      kind: r.kind,
      count: r.count,
      blockedUntil: r.blockedUntil,
      updatedAt: r.updatedAt,
    }));
  setup();
  return db()
    .prepare(
      "SELECT payload FROM security_incidents WHERE expires>? ORDER BY expires DESC LIMIT 100",
    )
    .all(Date.now())
    .map((r) => {
      const s = JSON.parse(String(r.payload));
      return { ...s, id: s.id.slice(0, 12) };
    });
}
