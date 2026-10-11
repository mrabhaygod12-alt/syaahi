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
  pending?: {
    id: string;
    secret: string;
    until: number;
    session: string;
    replaces?: string;
  };
}
/** Only deliberately authored validation messages may leave the MFA service. */
export class MfaError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "MfaError";
  }
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
    throw new MfaError("Administrator access required.", 403);
};
function normalizeCode(code: unknown) {
  if (typeof code !== "string" || code.length > 64)
    throw new MfaError(
      "Enter a current authenticator or unused recovery code.",
    );
  return code.replace(/[-\s]/g, "").toLowerCase();
}
function consumeFactor(u: Account, f: Factor, code: string) {
  if (!f.enabledAt || !f.secret)
    throw new MfaError("Enroll an authenticator first.");
  const counter = validCounter(open(u.id, f.secret), code, f.lastCounter);
  if (counter !== null)
    return { factor: { ...f, lastCounter: counter }, recoveryUsed: false };
  const hash = digest(u.id + ":" + code);
  if (/^[a-f0-9]{32}$/.test(code) && f.recovery?.includes(hash))
    return {
      factor: { ...f, recovery: f.recovery.filter((c) => c !== hash) },
      recoveryUsed: true,
    };
  throw new MfaError(
    "Code not accepted or already used. Use a new authenticator code or an unused recovery code.",
  );
}
async function confirmIdentity(u: Account, req: Request, password: unknown) {
  const account = await accountByEmail(u.email),
    id = sessionKey(req),
    device = id ? await deviceSession(id, u.id) : null;
  if (!id || !device) throw new MfaError("Sign in again.", 401);
  const passwordValid =
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 1024 &&
    account &&
    passwordMatches(password, String(account.password));
  const age = Date.now() - Date.parse(device.createdAt);
  const recentOAuth = device.method === "oauth" && age >= 0 && age < 5 * 60000;
  if (!passwordValid && !recentOAuth)
    throw new MfaError(
      "Confirm your password, or sign in again with Google and enroll within five minutes.",
    );
  return id;
}
const recoveryCodes = () =>
  Array.from({ length: 8 }, () => randomBytes(16).toString("hex"));
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
  if (!id) throw new MfaError("Sign in again.", 401);
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
      if (!row) throw new MfaError("Your session expired. Sign in again.", 401);
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
    if (!row) throw new MfaError("Your session expired. Sign in again.", 401);
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
    throw new MfaError(
      "An authenticator is already enrolled. Use a current code or a saved recovery code.",
    );
  const id = await confirmIdentity(u, req, password);
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
        throw new MfaError("An authenticator is already enrolled.");
      return { pending };
    },
  );
  return {
    id: pending.id,
    secret,
    uri: `otpauth://totp/${encodeURIComponent("Syaahi Admin:" + u.email)}?secret=${secret}&issuer=Syaahi&algorithm=SHA1&digits=6&period=30`,
  };
}
/** Keep the current factor active until the replacement has been verified. */
export async function beginMfaReplacement(
  u: Account,
  req: Request,
  password: unknown,
  code: unknown,
) {
  eligible(u);
  const normalized = normalizeCode(code),
    id = await confirmIdentity(u, req, password),
    secret = encode(randomBytes(20)),
    pending = {
      id: randomUUID(),
      secret: seal(u.id, secret),
      until: Date.now() + 10 * 60000,
      session: id,
    };
  await changeFactor(
    u,
    req,
    () => "mfa.replacement_started",
    (f) => {
      const consumed = consumeFactor(u, f, normalized).factor;
      return { ...consumed, pending: { ...pending, replaces: f.enabledAt } };
    },
  );
  return {
    id: pending.id,
    secret,
    replacing: true,
    uri: `otpauth://totp/${encodeURIComponent("Syaahi Admin:" + u.email)}?secret=${secret}&issuer=Syaahi&algorithm=SHA1&digits=6&period=30`,
  };
}
/** Fresh password/Google proof plus a single-use factor; audit and rotation are atomic. */
export async function rotateMfaRecovery(
  u: Account,
  req: Request,
  password: unknown,
  code: unknown,
) {
  eligible(u);
  const normalized = normalizeCode(code);
  await confirmIdentity(u, req, password);
  const codes = recoveryCodes(),
    version = randomUUID();
  await changeFactor(
    u,
    req,
    () => "mfa.recovery_rotated",
    (f) => {
      const consumed = consumeFactor(u, f, normalized).factor;
      return {
        ...consumed,
        pending: undefined,
        enabledAt: version,
        recovery: codes.map((c) => digest(u.id + ":" + c)),
      };
    },
    true,
  );
  return codes;
}
export async function cancelMfaReplacement(
  u: Account,
  req: Request,
  id: unknown,
) {
  eligible(u);
  const key = sessionKey(req);
  await changeFactor(
    u,
    req,
    () => "mfa.replacement_cancelled",
    (f) => {
      if (
        !f.pending?.replaces ||
        f.pending.id !== id ||
        f.pending.session !== key
      )
        throw new MfaError(
          "Setup expired or changed. Reload security settings.",
          409,
        );
      const { pending, ...current } = f;
      return current;
    },
  );
}
export async function confirmMfa(
  u: Account,
  req: Request,
  id: unknown,
  code: unknown,
) {
  eligible(u);
  const key = sessionKey(req),
    normalized = normalizeCode(code);
  if (!key) throw new MfaError("Sign in again.", 401);
  const recovery = recoveryCodes(),
    version = randomUUID();
  let replacing = false;
  await changeFactor(
    u,
    req,
    () => (replacing ? "mfa.replaced" : "mfa.enrolled"),
    (f) => {
      replacing = !!f.pending?.replaces;
      if (
        !f.pending ||
        (replacing ? f.pending.replaces !== f.enabledAt : !!f.enabledAt) ||
        f.pending.id !== id ||
        f.pending.session !== key ||
        f.pending.until < Date.now()
      )
        throw new MfaError("Setup expired or changed. Start again.", 409);
      const counter = validCounter(open(u.id, f.pending.secret), normalized);
      if (counter === null)
        throw new MfaError(
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
export async function challengeMfa(u: Account, req: Request, code: unknown) {
  eligible(u);
  const key = sessionKey(req);
  if (!key) throw new MfaError("Sign in again.", 401);
  const normalized = normalizeCode(code);
  let recoveryUsed = false;
  await changeFactor(
    u,
    req,
    () => (recoveryUsed ? "mfa.recovery_used" : "mfa.verified"),
    (f) => {
      recoveryUsed = false;
      const consumed = consumeFactor(u, f, normalized);
      recoveryUsed = consumed.recoveryUsed;
      return consumed.factor;
    },
    true,
  );
}
