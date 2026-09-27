import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
export const INVITE_CREDITS = 5;
export class RewardError extends Error {}
function setup() {
  db()
    .exec(`CREATE TABLE IF NOT EXISTS verified_accounts (user_id TEXT PRIMARY KEY, verified_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reward_wallets (user_id TEXT PRIMARY KEY,balance INTEGER NOT NULL DEFAULT 0,earned INTEGER NOT NULL DEFAULT 0,month TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS reward_events (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,credits INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reward_transfers (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,credits INTEGER NOT NULL,created_at TEXT NOT NULL);`);
}
async function qualify(user: string, verify: boolean) {
  const at = new Date(),
    month = at.toISOString().slice(0, 7);
  if (useMongo())
    return mongoTransaction(async (d, session) => {
      const o = { session },
        verified = d.collection<any>("verified_accounts");
      if (verify)
        await verified.updateOne(
          { _id: user },
          { $setOnInsert: { verifiedAt: at } },
          { ...o, upsert: true },
        );
      if (!(await verified.findOne({ _id: user }, o))) return;
      const refs = d.collection<any>("referrals"),
        ref = await refs.findOne({ _id: user }, o);
      if (!ref || ref.rewardedAt || ref.inviter === user) return;
      const banks = d.collection<any>("reward_wallets");
      await banks.updateOne(
        { _id: ref.inviter },
        { $setOnInsert: { balance: 0, earned: 0, month, count: 0 } },
        { ...o, upsert: true },
      );
      const bank = await banks.findOne({ _id: ref.inviter }, o);
      const count = bank.month === month ? bank.count : 0;
      if (count >= 20) return;
      await banks.updateOne(
        { _id: ref.inviter },
        {
          $inc: { balance: INVITE_CREDITS, earned: INVITE_CREDITS },
          $set: { month, count: count + 1 },
        },
        o,
      );
      await d.collection<any>("reward_events").insertOne(
        {
          _id: `signup:${user}`,
          user: ref.inviter,
          credits: INVITE_CREDITS,
          createdAt: at,
        },
        o,
      );
      await refs.updateOne(
        { _id: user },
        {
          $set: {
            rewardedAt: at,
            rewardKind: "verified-signup",
            rewardCredits: INVITE_CREDITS,
          },
        },
        o,
      );
    });
  setup();
  transaction(() => {
    if (verify)
      db()
        .prepare("INSERT OR IGNORE INTO verified_accounts VALUES (?,?)")
        .run(user, at.toISOString());
    if (
      !db().prepare("SELECT 1 FROM verified_accounts WHERE user_id=?").get(user)
    )
      return;
    const ref = db()
      .prepare("SELECT * FROM referrals WHERE referred=?")
      .get(user);
    if (!ref || ref.rewarded_at || ref.inviter === user) return;
    const inviter = String(ref.inviter);
    db()
      .prepare("INSERT OR IGNORE INTO reward_wallets VALUES (?,0,0,?,0)")
      .run(inviter, month);
    const bank = db()
      .prepare("SELECT * FROM reward_wallets WHERE user_id=?")
      .get(inviter)!;
    const count = bank.month === month ? Number(bank.count) : 0;
    if (count >= 20) return;
    db()
      .prepare(
        "UPDATE reward_wallets SET balance=balance+?,earned=earned+?,month=?,count=? WHERE user_id=?",
      )
      .run(INVITE_CREDITS, INVITE_CREDITS, month, count + 1, inviter);
    db()
      .prepare("INSERT INTO reward_events VALUES (?,?,?,?)")
      .run(`signup:${user}`, inviter, INVITE_CREDITS, at.toISOString());
    db()
      .prepare("UPDATE referrals SET rewarded_at=? WHERE referred=?")
      .run(at.toISOString(), user);
  });
}
export const markEmailVerified = (user: string) => qualify(user, true);
export const qualifyReferral = (user: string) => qualify(user, false);
export async function rewardSummary(user: string) {
  const month = new Date().toISOString().slice(0, 7);
  if (useMongo()) {
    const bank = await (
      await collection("reward_wallets")
    ).findOne({ _id: user });
    return {
      thisMonth: bank?.month === month ? Number(bank.count) : 0,
      rewardBalance: Number(bank?.balance || 0),
      rewardEarned: Number(bank?.earned || 0),
      emailVerified: !!(await (
        await collection("verified_accounts")
      ).findOne({ _id: user })),
    };
  }
  setup();
  const bank = db()
    .prepare("SELECT * FROM reward_wallets WHERE user_id=?")
    .get(user);
  return {
    thisMonth: bank?.month === month ? Number(bank.count) : 0,
    rewardBalance: Number(bank?.balance || 0),
    rewardEarned: Number(bank?.earned || 0),
    emailVerified: !!db()
      .prepare("SELECT 1 FROM verified_accounts WHERE user_id=?")
      .get(user),
  };
}
export async function transferRewards(
  user: string,
  credits: number,
  id: string,
) {
  if (
    !Number.isSafeInteger(credits) ||
    credits < 1 ||
    credits > 100000 ||
    !/^[a-f0-9-]{36}$/i.test(id)
  )
    throw new RewardError("Choose a valid whole-credit amount.");
  const event = `reward-transfer:${user}:${id}`,
    at = new Date();
  if (useMongo())
    return mongoTransaction(async (d, session) => {
      const o = { session },
        transfers = d.collection<any>("reward_transfers");
      const old = await transfers.findOne({ _id: event }, o);
      if (old) {
        if (old.credits !== credits)
          throw new RewardError("This transfer reference was already used.");
        return;
      }
      const bank = await d
        .collection<any>("reward_wallets")
        .updateOne(
          { _id: user, balance: { $gte: credits } },
          { $inc: { balance: -credits } },
          o,
        );
      if (!bank.modifiedCount)
        throw new RewardError("Not enough reward credits.");
      const wallet = await d
        .collection<any>("wallets")
        .updateOne({ _id: user }, { $inc: { balance: credits } }, o);
      if (!wallet.matchedCount) throw new Error("Missing study wallet");
      await transfers.insertOne(
        { _id: event, user, credits, createdAt: at },
        o,
      );
      await d.collection<any>("ledger").insertOne(
        {
          _id: event,
          user,
          delta: credits,
          reason: "Referral credits transferred",
          createdAt: at,
        },
        o,
      );
    });
  setup();
  transaction(() => {
    const old = db()
      .prepare("SELECT credits FROM reward_transfers WHERE id=?")
      .get(event);
    if (old) {
      if (Number(old.credits) !== credits)
        throw new RewardError("This transfer reference was already used.");
      return;
    }
    if (
      !db()
        .prepare(
          "UPDATE reward_wallets SET balance=balance-? WHERE user_id=? AND balance>=?",
        )
        .run(credits, user, credits).changes
    )
      throw new RewardError("Not enough reward credits.");
    if (
      !db()
        .prepare("UPDATE wallets SET balance=balance+? WHERE user_id=?")
        .run(credits, user).changes
    )
      throw new Error("Missing study wallet");
    db()
      .prepare("INSERT INTO reward_transfers VALUES (?,?,?,?)")
      .run(event, user, credits, at.toISOString());
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(
        event,
        user,
        credits,
        "Referral credits transferred",
        at.toISOString(),
      );
  });
}
