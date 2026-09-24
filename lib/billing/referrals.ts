import { useMongo, collection } from "@/lib/storage/mongo";
import {
  mongoReferralCode,
  mongoClaimReferral,
} from "@/lib/storage/mongo-billing";
import { randomBytes } from "node:crypto";
import { db, transaction } from "@/lib/db";
export async function referralCode(user: string) {
  if (useMongo()) return mongoReferralCode(user);
  return transaction(() => {
    const saved = db()
      .prepare("SELECT code FROM referral_codes WHERE user_id=?")
      .get(user);
    if (saved) return String(saved.code);
    const code = randomBytes(9).toString("hex");
    db().prepare("INSERT INTO referral_codes VALUES (?,?)").run(code, user);
    return code;
  });
}
export async function claimReferral(user: string, code: string) {
  if (useMongo()) return mongoClaimReferral(user, code);
  return transaction(() => {
    const inviter = db()
      .prepare("SELECT user_id FROM referral_codes WHERE code=?")
      .get(code);
    if (!inviter || inviter.user_id === user)
      throw new Error("Invalid referral code.");
    const account = db()
      .prepare("SELECT created_at FROM users WHERE id=?")
      .get(user);
    if (
      !account ||
      Date.now() - Date.parse(String(account.created_at)) > 86400000
    )
      throw new Error(
        "Referral codes must be applied within 24 hours of signup.",
      );
    if (
      db().prepare("SELECT id FROM orders WHERE user_id=? AND paid=1").get(user)
    )
      throw new Error("Apply a referral before your first purchase.");
    const existing = db()
      .prepare("SELECT inviter FROM referrals WHERE referred=?")
      .get(user);
    if (existing) {
      if (existing.inviter === inviter.user_id) return;
      throw new Error("A referral is already attached to this account.");
    }
    db()
      .prepare(
        "INSERT INTO referrals (referred,inviter,created_at) VALUES (?,?,?)",
      )
      .run(user, String(inviter.user_id), new Date().toISOString());
  });
}
// Called inside the payment transaction: reward and capture commit together.
export function rewardReferral(user: string, payment: string) {
  const referral = db()
    .prepare("SELECT * FROM referrals WHERE referred=? AND rewarded_at IS NULL")
    .get(user);
  if (!referral) return;
  const earlier = db()
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id=? AND paid=1")
    .get(user);
  if (Number(earlier?.n) !== 1) return;
  const month = new Date().toISOString().slice(0, 7);
  const count = Number(
    db()
      .prepare(
        "SELECT COUNT(*) AS n FROM referrals WHERE inviter=? AND rewarded_at LIKE ?",
      )
      .get(String(referral.inviter), month + "%")?.n || 0,
  );
  if (count >= 20) return;
  const at = new Date().toISOString();
  db()
    .prepare(
      "UPDATE referrals SET rewarded_at=?,payment_id=? WHERE referred=? AND rewarded_at IS NULL",
    )
    .run(at, payment, user);
  for (const [target, kind] of [
    [String(referral.inviter), "inviter"],
    [user, "new-member"],
  ]) {
    db()
      .prepare("UPDATE wallets SET balance=balance+3 WHERE user_id=?")
      .run(target);
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(
        `referral:${user}:${kind}`,
        target,
        3,
        "Referral reward: one token",
        at,
      );
  }
}

export async function referralStats(user: string) {
  if (useMongo()) {
    const c = await collection("referrals");
    return {
      thisMonth:await c.countDocuments({inviter:user,rewardedAt:{$gte:new Date(new Date().toISOString().slice(0,7)+'-01T00:00:00Z')}}),
      invited: await c.countDocuments({ inviter: user }),
      rewarded: await c.countDocuments({
        inviter: user,
        rewardedAt: { $type: "date" },
      }),
      claimed: !!(await c.findOne({ _id: user })),
    };
  }
  const rows = db()
    .prepare("SELECT rewarded_at FROM referrals WHERE inviter=?")
    .all(user);
  return {
    thisMonth:rows.filter(r=>String(r.rewarded_at||'').startsWith(new Date().toISOString().slice(0,7))).length,
    invited: rows.length,
    rewarded: rows.filter((r) => r.rewarded_at).length,
    claimed: !!db()
      .prepare("SELECT referred FROM referrals WHERE referred=?")
      .get(user),
  };
}
