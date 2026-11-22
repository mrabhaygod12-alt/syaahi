import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
import { balance } from "@/lib/credits/store";

export const ASSIGNMENT_LAUNCH_GIFT_CREDITS = 10;
const CAMPAIGN = "assignment-studio-launch-v1";
const REASON = "Assignment Studio launch gift";

function eventId(user: string) {
  return `${CAMPAIGN}:${user}`;
}

function assertSameCampaign(event: any, user: string) {
  if (
    String(event.user_id ?? event.user) !== user ||
    Number(event.delta) !== ASSIGNMENT_LAUNCH_GIFT_CREDITS ||
    String(event.reason) !== REASON
  )
    throw new Error(
      "Assignment launch credit event conflicts with this account.",
    );
}

export async function applyAssignmentLaunchGift(user: string) {
  const id = eventId(user);
  if (useMongo()) {
    try {
      return await mongoTransaction(async (database, session) => {
        const options = { session };
        const ledger = database.collection<any>("ledger");
        const previous = await ledger.findOne({ _id: id }, options);
        if (previous) {
          assertSameCampaign(previous, user);
          const wallet = await database
            .collection<any>("wallets")
            .findOne({ _id: user }, options);
          return { balance: Number(wallet?.balance || 0), granted: false };
        }

        const wallets = database.collection<any>("wallets");
        const updated = await wallets.updateOne(
          { _id: user },
          { $inc: { balance: ASSIGNMENT_LAUNCH_GIFT_CREDITS } },
          options,
        );
        if (!updated.matchedCount) throw new Error("Unknown credit wallet.");
        await ledger.insertOne(
          {
            _id: id,
            user,
            delta: ASSIGNMENT_LAUNCH_GIFT_CREDITS,
            reason: REASON,
            createdAt: new Date(),
          },
          options,
        );
        const wallet = await wallets.findOne({ _id: user }, options);
        return { balance: Number(wallet?.balance || 0), granted: true };
      });
    } catch (error) {
      // Concurrent first visits may both start the grant. If the unique ledger
      // event committed in the other transaction, treat this request as replay.
      if ((error as { code?: number })?.code !== 11000) throw error;
      const previous = await (await collection("ledger")).findOne({ _id: id });
      if (!previous) throw error;
      assertSameCampaign(previous, user);
      return { balance: await balance(user), granted: false };
    }
  }

  return transaction(() => {
    const previous = db()
      .prepare("SELECT user_id,delta,reason FROM ledger WHERE id=?")
      .get(id);
    if (previous) {
      assertSameCampaign(previous, user);
      return {
        balance: Number(
          db().prepare("SELECT balance FROM wallets WHERE user_id=?").get(user)
            ?.balance ?? 0,
        ),
        granted: false,
      };
    }
    const wallet = db()
      .prepare("SELECT user_id FROM wallets WHERE user_id=?")
      .get(user);
    if (!wallet) throw new Error("Unknown credit wallet.");
    db()
      .prepare("UPDATE wallets SET balance=balance+? WHERE user_id=?")
      .run(ASSIGNMENT_LAUNCH_GIFT_CREDITS, user);
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(
        id,
        user,
        ASSIGNMENT_LAUNCH_GIFT_CREDITS,
        REASON,
        new Date().toISOString(),
      );
    return {
      balance: Number(
        db().prepare("SELECT balance FROM wallets WHERE user_id=?").get(user)
          ?.balance ?? 0,
      ),
      granted: true,
    };
  });
}
