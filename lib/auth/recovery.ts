import { createHash, randomBytes } from "node:crypto";
import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
import { passwordHash } from "./server";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS password_resets (user_id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,expires INTEGER NOT NULL)",
  );
}
export async function issueReset(user: { id: string; password: string }) {
  const token = randomBytes(32).toString("hex"),
    expires = Date.now() + 30 * 60000;
  if (useMongo())
    await (
      await collection("password_resets")
    ).updateOne(
      { _id: user.id },
      {
        $set: {
          tokenHash: hash(token),
          credential: hash(user.password),
          expires,
          expiresAt: new Date(expires),
        },
      },
      { upsert: true },
    );
  else {
    setup();
    db()
      .prepare(
        "INSERT INTO password_resets VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,password_hash=excluded.password_hash,expires=excluded.expires",
      )
      .run(user.id, hash(token), hash(user.password), expires);
  }
  return token;
}
export async function resetPassword(token: string, password: string) {
  if (
    !/^[a-f0-9]{64}$/.test(token) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    throw new Error(
      "Use a valid reset link and a password of 10–128 characters.",
    );
  const tokenHash = hash(token),
    encoded = passwordHash(password);
  if (useMongo())
    return mongoTransaction(async (d, session) => {
      const resets = d.collection<any>("password_resets"),
        row = await resets.findOne(
          { tokenHash, expires: { $gt: Date.now() } },
          { session },
        );
      if (!row)
        throw new Error("Reset link is invalid or expired. Request a new one.");
      const users = d.collection<any>("users"),
        user = await users.findOne({ _id: row._id }, { session });
      if (!user || hash(String(user.password)) !== row.credential)
        throw new Error("Your password changed. Request a new reset link.");
      await users.updateOne(
        { _id: row._id },
        { $set: { password: encoded } },
        { session },
      );
      await d.collection("sessions").deleteMany({ user: row._id }, { session });
      await resets.deleteOne({ _id: row._id, tokenHash }, { session });
      return row._id as string;
    });
  setup();
  return transaction(() => {
    const row = db()
      .prepare("SELECT * FROM password_resets WHERE token_hash=? AND expires>?")
      .get(tokenHash, Date.now());
    if (!row)
      throw new Error("Reset link is invalid or expired. Request a new one.");
    const user = db()
      .prepare("SELECT password FROM users WHERE id=?")
      .get(row.user_id);
    if (!user || hash(String(user.password)) !== row.password_hash)
      throw new Error("Your password changed. Request a new reset link.");
    db()
      .prepare("UPDATE users SET password=? WHERE id=?")
      .run(encoded, row.user_id);
    db().prepare("DELETE FROM sessions WHERE user_id=?").run(row.user_id);
    db()
      .prepare("DELETE FROM password_resets WHERE user_id=?")
      .run(row.user_id);
    return String(row.user_id);
  });
}
export const recoveryConfigured = () =>
  !!(
    process.env.RESEND_API_KEY &&
    process.env.EMAIL_FROM &&
    process.env.NEXT_PUBLIC_APP_URL
  );
export async function sendReset(user: {
  id: string;
  email: string;
  password: string;
}) {
  if (!recoveryConfigured())
    throw new Error("Email recovery is not configured.");
  const token = await issueReset(user),
    url = new URL("/forgot-password", process.env.NEXT_PUBLIC_APP_URL);
  url.hash = token;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [user.email],
      subject: "Reset your Syaahi password",
      text: `Use this link within 30 minutes to choose a new password. Resetting signs out all existing sessions.\n${url.href}\nIf you did not request this, ignore this message. Your password has not changed.`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  return response.ok;
}
