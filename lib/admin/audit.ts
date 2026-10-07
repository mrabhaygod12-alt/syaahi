import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
export interface AdminEvent {
  id: string;
  actor: string;
  target: string;
  action: string;
  at: string;
  detail: string;
}
export function auditSetup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS admin_audit (id TEXT PRIMARY KEY, at TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS admin_audit_time ON admin_audit(at)",
  );
}
export async function audit(
  actor: string,
  target: string,
  action: string,
  detail = "",
) {
  const e: AdminEvent = {
    id: randomUUID(),
    actor,
    target,
    action,
    detail: detail.slice(0, 500),
    at: new Date().toISOString(),
  };
  if (useMongo()) {
    const c = await collection("admin_audit");
    await c.insertOne({
      _id: e.id,
      ...e,
      expiresAt: new Date(Date.now() + 180 * 86400000),
    });
  } else {
    auditSetup();
    db()
      .prepare("DELETE FROM admin_audit WHERE at<?")
      .run(new Date(Date.now() - 180 * 86400000).toISOString());
    db()
      .prepare("INSERT INTO admin_audit VALUES (?,?,?)")
      .run(e.id, e.at, JSON.stringify(e));
  }
}
export async function recentAudit(): Promise<AdminEvent[]> {
  if (useMongo())
    return (
      await (
        await collection("admin_audit")
      )
        .find({ expiresAt: { $gt: new Date() } })
        .sort({ at: -1 })
        .limit(100)
        .toArray()
    ).map((r) => ({
      id: r.id,
      actor: r.actor,
      target: r.target,
      action: r.action,
      at: r.at,
      detail: r.detail,
    }));
  auditSetup();
  return db()
    .prepare(
      "SELECT payload FROM admin_audit WHERE at>? ORDER BY at DESC LIMIT 100",
    )
    .all(new Date(Date.now() - 180 * 86400000).toISOString())
    .map((r) => JSON.parse(String(r.payload)));
}
