import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import { markEmailVerified, RewardError } from "@/lib/billing/rewards";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS email_verification (user_id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,expires INTEGER NOT NULL)",
  );
}
export async function issueVerification(user: string) {
  const token = randomBytes(32).toString("hex"),
    expires = Date.now() + 3600000;
  if (useMongo())
    await (
      await collection("email_verification")
    ).updateOne(
      { _id: user },
      { $set: { tokenHash: hash(token), expires } },
      { upsert: true },
    );
  else {
    setup();
    db()
      .prepare(
        "INSERT INTO email_verification VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires=excluded.expires",
      )
      .run(user, hash(token), expires);
  }
  return token;
}
export async function confirmVerification(user: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new RewardError("Verification link is invalid or expired.");
  let valid = false;
  if (useMongo())
    valid = !!(await (
      await collection("email_verification")
    ).findOne({
      _id: user,
      tokenHash: hash(token),
      expires: { $gt: Date.now() },
    }));
  else {
    setup();
    valid = !!db()
      .prepare(
        "SELECT 1 FROM email_verification WHERE user_id=? AND token_hash=? AND expires>?",
      )
      .get(user, hash(token), Date.now());
  }
  if (!valid) throw new RewardError("Verification link is invalid or expired.");
  await markEmailVerified(user);
  if (useMongo())
    await (
      await collection("email_verification")
    ).deleteOne({ _id: user, tokenHash: hash(token) });
  else
    db()
      .prepare(
        "DELETE FROM email_verification WHERE user_id=? AND token_hash=?",
      )
      .run(user, hash(token));
}
export async function sendVerification(user: { id: string; email: string }) {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !process.env.NEXT_PUBLIC_APP_URL
  )
    throw new RewardError(
      "Email verification delivery is not configured. Contact support; no referral reward is issued until verification.",
    );
  const token = await issueVerification(user.id);
  const url = new URL("/verify-email", process.env.NEXT_PUBLIC_APP_URL);
  // Fragment keeps the bearer token out of HTTP access logs and referrers.
  url.hash = token;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [user.email],
      subject: "Verify your Syaahi email",
      text: `Verify your email to qualify your referral. Sign in to the same account, then open this link within one hour:\n${url.href}\nIf you did not request this, ignore this message.`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new RewardError(
      "Verification email could not be sent. Please retry later.",
    );
}
