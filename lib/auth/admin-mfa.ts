import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { readState } from "@/lib/study/state";
import { db, transaction } from "@/lib/db";
import { mongoTransaction, useMongo } from "@/lib/storage/mongo";
import type { Account } from "./server";
import { accountByEmail, passwordMatches } from "./server";
import { adminEligibility } from "./admin";
import { deviceSession, sessionKey } from "./session-security";
import { auditSetup, type AdminEvent } from "@/lib/admin/audit";
interface Factor {
  enabledAt?: string;
  secret?: string;
  lastCounter?: number;
  recovery?: string[];
  pending?: { id: string; secret: string; until: number; session: string };
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function encryptionKey(): Buffer {
  const explicit = process.env.ADMIN_MFA_KEY?.trim();
  if (explicit) {
    const decoded = Buffer.from(explicit, "base64");
    if (decoded.length !== 32)
      throw new Error("ADMIN_MFA_KEY must encode 32 random bytes.");
    return decoded;
  }
  const proxy = process.env.BACKEND_PROXY_SECRET?.trim();
  if (!proxy || proxy.length < 32)
    throw new Error(
      "Administrator MFA encryption is not configured. Set ADMIN_MFA_KEY on the backend.",
    );
  return createHash("sha256")
    .update("syaahi:admin-mfa:v1:" + proxy)
    .digest();
}
export const mfaConfigured = () => {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
};
function seal(owner: string, value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(owner));
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes]
    .map((b) => b.toString("base64"))
    .join(".");
}
function open(owner: string, value: string) {
  const [iv, tag, bytes] = value
      .split(".")
      .map((s) => Buffer.from(s, "base64")),
    decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(Buffer.from(owner));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(bytes), decipher.final()]).toString(
    "utf8",
  );
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function encode(bytes: Buffer) {
  let bits = 0,
    value = 0,
    result = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits -= 5)) & 31];
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function decode(secret: string) {
  let bits = 0,
    value = 0;
  const output: number[] = [];
  for (const c of secret) {
    const n = alphabet.indexOf(c);
    if (n < 0) throw new Error("Invalid factor.");
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) output.push((value >>> (bits -= 8)) & 255);
  }
  return Buffer.from(output);
}
/** RFC 6238 SHA-1, six digits and a 30-second time step. */
export function totp(secret: string, counter = Math.floor(Date.now() / 30000)) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", decode(secret)).update(b).digest(),
    offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
function validCounter(secret: string, code: string, previous = -1) {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now, now - 1, now + 1])
    if (
      step > previous &&
      timingSafeEqual(Buffer.from(totp(secret, step)), Buffer.from(code))
    )
      return step;
  return null;
}
const eligible = (u: Account) => {
  if (!Object.values(adminEligibility(u)).some(Boolean))
    throw new Error("Administrator access required.");
};
/** Factor, replay counter, session elevation and audit commit together. A failed
 * audit cannot consume a code or leave enrollment enabled without its response. */
async function changeFactor(
  u: Account,
  req: Request,
  action: () => string,
  change: (f: Factor) => Factor,
  elevate = false,
) {
  const id = sessionKey(req);
  if (!id) throw new Error("Sign in again.");
  const event = (): AdminEvent => ({
    id: randomUUID(),
    actor: u.id,
    target: u.id,
    action: action(),
    at: new Date().toISOString(),
    detail: "",
  });
  const stateKey = u.id + ":admin-mfa";
  if (useMongo())
    return mongoTransaction(async (d, session) => {
      const sessions = d.collection<any>("sessions"),
        state = d.collection<any>("study_state");
      const row = await sessions.findOne(
        { _id: id, user: u.id, expiresAt: { $gt: new Date() } },
        { session },
      );
      if (!row) throw new Error("Your session expired. Sign in again.");
      const f = change(
        (await state.findOne({ _id: stateKey }, { session }))?.payload || {},
      );
      await state.updateOne(
        { _id: stateKey },
        { $set: { owner: u.id, payload: f } },
        { upsert: true, session },
      );
      if (elevate)
        await sessions.updateOne(
          { _id: id },
          {
            $set: {
              device: {
                ...(row.device || {
                  id,
                  owner: u.id,
                  method: "password",
                  createdAt: new Date(
                    row.expiresAt.getTime() - 7 * 86400000,
                  ).toISOString(),
                  agent: "Existing device",
                }),
                mfaVersion: f.enabledAt,
                mfaUntil: Date.now() + 15 * 60000,
              },
            },
          },
          { session },
        );
      const e = event();
      await d
        .collection<any>("admin_audit")
        .insertOne(
          { _id: e.id, ...e, expiresAt: new Date(Date.now() + 180 * 86400000) },
          { session },
        );
      return f;
    });
  await readState(u.id, "admin-mfa", {});
  await deviceSession(id, u.id);
  auditSetup();
  return transaction(() => {
    const row = db()
      .prepare(
        "SELECT s.expires,d.payload FROM sessions s LEFT JOIN session_devices d ON d.id=s.token_hash WHERE s.token_hash=? AND s.user_id=? AND s.expires>?",
      )
      .get(id, u.id, Date.now());
    if (!row) throw new Error("Your session expired. Sign in again.");
    const saved = db()
        .prepare("SELECT payload FROM study_state WHERE id=?")
        .get(stateKey),
      f = change(saved ? JSON.parse(String(saved.payload)) : {});
    db()
      .prepare(
        "INSERT INTO study_state VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(stateKey, u.id, JSON.stringify(f));
    if (elevate) {
      const device = row.payload
        ? JSON.parse(String(row.payload))
        : {
            id,
            owner: u.id,
            method: "password",
            createdAt: new Date(
              Number(row.expires) - 7 * 86400000,
            ).toISOString(),
            agent: "Existing device",
          };
      db()
        .prepare(
          "INSERT INTO session_devices VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
        )
        .run(
          id,
          JSON.stringify({
            ...device,
            mfaVersion: f.enabledAt,
            mfaUntil: Date.now() + 15 * 60000,
          }),
        );
    }
    const e = event();
    db()
      .prepare("INSERT INTO admin_audit VALUES (?,?,?)")
      .run(e.id, e.at, JSON.stringify(e));
    return f;
  });
}
export async function mfaStatus(u: Account, req: Request) {
  eligible(u);
  const f = await readState<Factor>(u.id, "admin-mfa", {}),
    id = sessionKey(req),
    device = id ? await deviceSession(id, u.id) : null;
  return {
    configured: mfaConfigured(),
    enrolled: !!f.enabledAt,
    verified: !!u.adminAuthenticated,
    verifiedUntil: u.adminAuthenticated ? device?.mfaUntil : null,
    recoveryRemaining: f.recovery?.length || 0,
  };
}
export async function beginMfa(u: Account, req: Request, password: unknown) {
  eligible(u);
  encryptionKey();
  const f = await readState<Factor>(u.id, "admin-mfa", {});
  if (f.enabledAt)
    throw new Error(
      "An authenticator is already enrolled. Use a current code or a saved recovery code.",
    );
  const account = await accountByEmail(u.email),
    id = sessionKey(req),
    device = id ? await deviceSession(id, u.id) : null;
  const passwordValid =
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 1024 &&
    account &&
    passwordMatches(password, String(account.password));
  const recentOAuth =
    device?.method === "oauth" &&
    Date.now() - Date.parse(device.createdAt) < 5 * 60000;
  if (!passwordValid && !recentOAuth)
    throw new Error(
      "Confirm your password, or sign in again with Google and enroll within five minutes.",
    );
  if (!id || !device) throw new Error("Sign in again.");
  const secret = encode(randomBytes(20)),
    pending = {
      id: randomUUID(),
      secret: seal(u.id, secret),
      until: Date.now() + 10 * 60000,
      session: id,
    };
  await changeFactor(
    u,
    req,
    () => "mfa.setup_started",
    (old) => {
      if (old.enabledAt)
        throw new Error("An authenticator is already enrolled.");
      return { pending };
    },
  );
  return {
    id: pending.id,
    secret,
    uri: `otpauth://totp/${encodeURIComponent("Syaahi Admin:" + u.email)}?secret=${secret}&issuer=Syaahi&algorithm=SHA1&digits=6&period=30`,
  };
}
export async function confirmMfa(
  u: Account,
  req: Request,
  id: unknown,
  code: string,
) {
  eligible(u);
  const key = sessionKey(req);
  if (!key) throw new Error("Sign in again.");
  const recovery = Array.from({ length: 8 }, () =>
      randomBytes(16).toString("hex"),
    ),
    version = randomUUID();
  await changeFactor(
    u,
    req,
    () => "mfa.enrolled",
    (f) => {
      if (
        f.enabledAt ||
        !f.pending ||
        f.pending.id !== id ||
        f.pending.session !== key ||
        f.pending.until < Date.now()
      )
        throw new Error("Setup expired or changed. Start again.");
      const counter = validCounter(open(u.id, f.pending.secret), code);
      if (counter === null)
        throw new Error(
          "Code not accepted. Check your authenticator and time settings.",
        );
      return {
        enabledAt: version,
        secret: f.pending.secret,
        lastCounter: counter,
        recovery: recovery.map((c) => digest(u.id + ":" + c)),
      };
    },
    true,
  );
  return recovery;
}
export async function challengeMfa(u: Account, req: Request, code: string) {
  eligible(u);
  const key = sessionKey(req);
  if (!key) throw new Error("Sign in again.");
  const normalized = code.replace(/[-\s]/g, "").toLowerCase();
  let recoveryUsed = false;
  await changeFactor(
    u,
    req,
    () => (recoveryUsed ? "mfa.recovery_used" : "mfa.verified"),
    (f) => {
      recoveryUsed = false;
      if (!f.enabledAt || !f.secret)
        throw new Error("Enroll an authenticator first.");
      const counter = validCounter(
        open(u.id, f.secret),
        normalized,
        f.lastCounter,
      );
      if (counter !== null) return { ...f, lastCounter: counter };
      const hash = digest(u.id + ":" + normalized);
      if (/^[a-f0-9]{32}$/.test(normalized) && f.recovery?.includes(hash)) {
        recoveryUsed = true;
        return { ...f, recovery: f.recovery.filter((c) => c !== hash) };
      }
      throw new Error(
        "Code not accepted or already used. Use a new authenticator code or an unused recovery code.",
      );
    },
    true,
  );
}
