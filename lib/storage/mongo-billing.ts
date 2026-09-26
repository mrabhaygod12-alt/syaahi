import { RewardError } from "../billing/rewards";
import { randomUUID, randomBytes } from "node:crypto";
import { collection, mongoTransaction } from "./mongo";
export async function mongoBalance(user: string) {
  return Number(
    (await (await collection("wallets")).findOne({ _id: user }))?.balance || 0,
  );
}
export async function mongoGrant(user: string, units: number, event: string) {
  return mongoTransaction(async (d, session) => {
    const opts = { session },
      ledger = d.collection<any>("ledger");
    if (!(await ledger.findOne({ _id: event }, opts))) {
      const changed = await d
        .collection<any>("wallets")
        .updateOne({ _id: user }, { $inc: { balance: units } }, opts);
      if (!changed.matchedCount) throw new Error("Unknown wallet.");
      await ledger.insertOne(
        {
          _id: event,
          user,
          delta: units,
          reason: "Grant",
          createdAt: new Date(),
        },
        opts,
      );
    }
    return Number(
      (await d.collection<any>("wallets").findOne({ _id: user }, opts))
        ?.balance || 0,
    );
  });
}
export async function mongoSpend(user: string, units: number) {
  return mongoTransaction(async (d, session) => {
    const opts = { session };
    const changed = await d
      .collection<any>("wallets")
      .updateOne(
        { _id: user, balance: { $gte: units } },
        { $inc: { balance: -units } },
        opts,
      );
    if (!changed.modifiedCount) throw new Error("Insufficient balance.");
    await d.collection<any>("ledger").insertOne(
      {
        _id: randomUUID(),
        user,
        delta: -units,
        reason: "Generation",
        createdAt: new Date(),
      },
      opts,
    );
    return Number(
      (await d.collection<any>("wallets").findOne({ _id: user }, opts))
        ?.balance || 0,
    );
  });
}
export async function mongoReferralCode(user: string) {
  const c = await collection("referral_codes");
  const result = await c.findOneAndUpdate(
    { _id: user },
    { $setOnInsert: { code: randomBytes(9).toString("hex") } },
    { upsert: true, returnDocument: "after" },
  );
  return String(result!.code);
}
export async function mongoClaimReferral(user: string, code: string) {
  return mongoTransaction(async (d, session) => {
    const opts = { session };
    const inviter = await d
      .collection<any>("referral_codes")
      .findOne({ code }, opts);
    if (!inviter || inviter._id === user)
      throw new RewardError("Invalid referral code.");
    const account = await d
      .collection<any>("users")
      .findOne({ _id: user }, opts);
    if (!account || Date.now() - Date.parse(account.createdAt) > 86400000)
      throw new RewardError("Apply within 24 hours of signup.");
    if (await d.collection<any>("orders").findOne({ user, paid: true }, opts))
      throw new RewardError("Apply before your first purchase.");
    const referrals = d.collection<any>("referrals"),
      old = await referrals.findOne({ _id: user }, opts);
    if (old) {
      if (old.inviter === inviter._id) return;
      throw new RewardError("A referral is already attached.");
    }
    await referrals.insertOne(
      {
        _id: user,
        referred: user,
        inviter: inviter._id,
        createdAt: new Date(),
        rewardedAt: null,
      },
      opts,
    );
  });
}
export async function mongoCapture(
  payment: {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  },
  owner?: string,
) {
  return mongoTransaction(async (d, session) => {
    const opts = { session },
      orders = d.collection<any>("orders"),
      wallets = d.collection<any>("wallets"),
      ledger = d.collection<any>("ledger");
    const order = await orders.findOne({ _id: payment.order_id }, opts);
    if (!order || (owner && order.user !== owner))
      throw new Error("Unknown payment order.");
    if (
      payment.status !== "captured" ||
      payment.currency !== "INR" ||
      payment.amount !== order.amount
    )
      throw new Error("Payment does not match the order.");
    if (order.paid) {
      if (order.paymentId !== payment.id)
        throw new Error("Order already settled.");
    } else {
      await orders.updateOne(
        { _id: order._id },
        { $set: { paid: true, paymentId: payment.id, updatedAt: new Date() } },
        opts,
      );
      const credited = await wallets.updateOne(
        { _id: order.user },
        { $inc: { balance: order.credits } },
        opts,
      );
      if (!credited.matchedCount) throw new Error("Unknown payment wallet.");
      await ledger.insertOne(
        {
          _id: `payment:${payment.id}`,
          user: order.user,
          delta: order.credits,
          reason: "Captured payment",
          createdAt: new Date(),
        },
        opts,
      );
    }
    return Number(
      (await wallets.findOne({ _id: order.user }, opts))?.balance || 0,
    );
  });
}
