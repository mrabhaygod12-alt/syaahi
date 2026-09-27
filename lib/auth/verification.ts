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
export async function confirmVerification(
  userOrToken: string,
  maybeToken?: string,
) {
  const token = maybeToken || userOrToken;
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new RewardError("Verification link is invalid or expired.");
  const tokenHash = hash(token);
  let userId = maybeToken ? userOrToken : "";

  if (useMongo()) {
    const col = await collection("email_verification");
    if (!userId) {
      const match = await col.findOne({
        tokenHash,
        expires: { $gt: Date.now() },
      });
      if (!match)
        throw new RewardError("Verification link is invalid or expired.");
      userId = match._id;
    } else {
      const match = await col.findOne({
        _id: userId,
        tokenHash,
        expires: { $gt: Date.now() },
      });
      if (!match)
        throw new RewardError("Verification link is invalid or expired.");
    }
    await markEmailVerified(userId);
    await col.deleteOne({ _id: userId });
  } else {
    setup();
    if (!userId) {
      const row = db()
        .prepare(
          "SELECT user_id FROM email_verification WHERE token_hash=? AND expires>?",
        )
        .get(tokenHash, Date.now());
      if (!row)
        throw new RewardError("Verification link is invalid or expired.");
      userId = String((row as any).user_id);
    } else {
      const row = db()
        .prepare(
          "SELECT 1 FROM email_verification WHERE user_id=? AND token_hash=? AND expires>?",
        )
        .get(userId, tokenHash, Date.now());
      if (!row)
        throw new RewardError("Verification link is invalid or expired.");
    }
    await markEmailVerified(userId);
    db().prepare("DELETE FROM email_verification WHERE user_id=?").run(userId);
  }
  return userId;
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
