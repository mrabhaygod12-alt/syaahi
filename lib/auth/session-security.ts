import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import { readState } from "@/lib/study/state";
import type { Account } from "./server";
import { adminEligibility } from "./admin";
export type AdminRole = "admin" | "editor" | "support" | "billing" | "none";
export interface AccountControl {
  status: "active" | "suspended" | "deleted";
  role: AdminRole | null;
  version: number;
  reason: string;
  updatedAt: string | null;
}
export const DEFAULT_CONTROL: AccountControl = {
  status: "active",
  role: null,
  version: 0,
  reason: "",
  updatedAt: null,
};
export const sessionKey = (req: Request) => {
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)syaahi-session=([a-f0-9]{64})(?:;|$)/)?.[1];
  return token ? createHash("sha256").update(token).digest("hex") : null;
};
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS session_devices (id TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE, payload TEXT NOT NULL)",
  );
}
interface Device {
  id: string;
  owner: string;
  createdAt: string;
  agent: string;
  method: "password" | "oauth";
  mfaUntil?: number;
  mfaVersion?: string;
}
export async function rememberSession(
  id: string,
  owner: string,
  req: Request,
  method: Device["method"] = "password",
) {
  const device: Device = {
    id,
    owner,
    method,
    createdAt: new Date().toISOString(),
    agent: (req.headers.get("user-agent") || "Unknown device")
      .replace(/[<>\r\n]/g, "")
      .slice(0, 180),
  };
  if (useMongo())
    await (
      await collection("sessions")
    ).updateOne({ _id: id, user: owner }, { $set: { device } });
  else {
    setup();
    db()
      .prepare("INSERT INTO session_devices VALUES (?,?)")
      .run(id, JSON.stringify(device));
  }
}
export async function deviceSession(
  id: string,
  owner: string,
): Promise<Device | null> {
  if (useMongo()) {
    const row = await (
      await collection("sessions")
    ).findOne({ _id: id, user: owner, expiresAt: { $gt: new Date() } });
    return row
      ? row.device || {
          id,
          owner,
          method: "password",
          createdAt: new Date(
            row.expiresAt.getTime() - 7 * 86400000,
          ).toISOString(),
          agent: "Existing device",
        }
      : null;
  }
  setup();
  const row = db()
    .prepare(
      "SELECT d.payload,s.expires FROM sessions s LEFT JOIN session_devices d ON d.id=s.token_hash WHERE s.token_hash=? AND s.user_id=? AND s.expires>?",
    )
    .get(id, owner, Date.now());
  return row
    ? row.payload
      ? JSON.parse(String(row.payload))
      : {
          id,
          owner,
          method: "password",
          createdAt: new Date(Number(row.expires) - 7 * 86400000).toISOString(),
          agent: "Existing device",
        }
    : null;
}
export async function stepUpSession(
  id: string,
  owner: string,
  version: string,
) {
  const device = await deviceSession(id, owner);
  if (!device) throw new Error("Your session expired. Sign in again.");
  const next = {
    ...device,
    mfaUntil: Date.now() + 15 * 60000,
    mfaVersion: version,
  };
  if (useMongo()) {
    const r = await (
      await collection("sessions")
    ).updateOne(
      { _id: id, user: owner, expiresAt: { $gt: new Date() } },
      { $set: { device: next } },
    );
    if (!r.matchedCount)
      throw new Error("Your session expired. Sign in again.");
  } else {
    setup();
    db()
      .prepare(
        "INSERT INTO session_devices VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(id, JSON.stringify(next));
  }
}
export async function secureAccount(
  user: Account,
  token: string,
): Promise<Account | null> {
  const control = await readState(user.id, "account-control", DEFAULT_CONTROL);
  if (control.status !== "active") return null;
  Object.defineProperty(user, "adminRole", { value: control.role });
  if (control.role === null && useMongo()) {
    const legacy = await (
      await collection("payment_admins")
    ).findOne({ _id: user.id, active: true }, { projection: { _id: 1 } });
    Object.defineProperty(user, "legacyPaymentAdmin", { value: !!legacy });
  }
  const id = createHash("sha256").update(token).digest("hex");
  Object.defineProperty(user, "sessionId", { value: id });
  if (Object.values(adminEligibility(user)).some(Boolean)) {
    const mfa = await readState<{ enabledAt?: string }>(
      user.id,
      "admin-mfa",
      {},
    );
    const device = await deviceSession(id, user.id);
    Object.defineProperty(user, "adminMfaEnrolled", { value: !!mfa.enabledAt });
    Object.defineProperty(user, "adminAuthenticated", {
      value:
        !!mfa.enabledAt &&
        device?.mfaVersion === mfa.enabledAt &&
        (device?.mfaUntil || 0) > Date.now(),
    });
  }
  return user;
}
export async function activeSessions(owner: string, current: string | null) {
  let rows: Array<{ id: string; expires: string; device: Device | null }>;
  if (useMongo())
    rows = (
      await (
        await collection("sessions")
      )
        .find({ user: owner, expiresAt: { $gt: new Date() } })
        .sort({ expiresAt: -1 })
        .limit(100)
        .toArray()
    ).map((r) => ({
      id: String(r._id),
      expires: r.expiresAt.toISOString(),
      device: r.device || null,
    }));
  else {
    setup();
    rows = db()
      .prepare(
        "SELECT s.token_hash,s.expires,d.payload FROM sessions s LEFT JOIN session_devices d ON d.id=s.token_hash WHERE s.user_id=? AND s.expires>? ORDER BY s.expires DESC LIMIT 100",
      )
      .all(owner, Date.now())
      .map((r) => ({
        id: String(r.token_hash),
        expires: new Date(Number(r.expires)).toISOString(),
        device: r.payload ? JSON.parse(String(r.payload)) : null,
      }));
  }
  return rows.map((r) => ({
    id: r.id,
    current: r.id === current,
    createdAt: r.device?.createdAt || null,
    expiresAt: r.expires,
    device: r.device?.agent || "Existing device",
    method: r.device?.method || "password",
    administratorVerifiedUntil: r.device?.mfaUntil || null,
  }));
}
export async function revokeSessions(
  owner: string,
  id?: string,
  keep?: string | null,
) {
  if (id && !/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid session.");
  if (useMongo()) {
    const where = {
      user: owner,
      ...(id ? { _id: id } : keep ? { _id: { $ne: keep } } : {}),
    };
    return (await (await collection("sessions")).deleteMany(where))
      .deletedCount;
  }
  return db()
    .prepare(
      `DELETE FROM sessions WHERE user_id=?${id ? " AND token_hash=?" : keep ? " AND token_hash<>?" : ""}`,
    )
    .run(owner, ...(id ? [id] : keep ? [keep] : [])).changes;
}
