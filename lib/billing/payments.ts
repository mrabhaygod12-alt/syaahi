import Razorpay from "razorpay";
import { useMongo, collection } from "@/lib/storage/mongo";
import { mongoCapture } from "@/lib/storage/mongo-billing";
import { rewardReferral } from "./referrals";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, transaction } from "@/lib/db";
import { razorpayCredentials } from "./configuration";
export function verifySignature(
  raw: string,
  signature: string,
  secret: string,
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export async function razorpay(path: string, body?: unknown) {
  const { keyId: id, keySecret: secret } = razorpayCredentials();
  if (!id || !secret)
    throw new Error(
      "Payments are not configured yet. Your free credits are available after signup.",
    );
  const client = new Razorpay({ key_id: id, key_secret: secret });
  // SDK exposes an Axios transport; bound its request timeout like the previous HTTP adapter.
  (
    client as unknown as { api: { rq: { defaults: { timeout: number } } } }
  ).api.rq.defaults.timeout = 15000;
  try {
    if (path === "orders" && body)
      return await client.orders.create(
        body as Parameters<typeof client.orders.create>[0],
      );
    if (/^payments\/pay_[a-zA-Z0-9]+$/.test(path) && !body) {
      const payment = await client.payments.fetch(path.split("/")[1]);
      return { ...payment, amount: Number(payment.amount) };
    }
    throw new Error("Unsupported payment operation.");
  } catch (error) {
    const failure = error as {
      statusCode?: unknown;
      code?: unknown;
      error?: { code?: unknown };
    };
    // Keep merchant credentials and provider response bodies out of logs while
    // preserving the status/code needed to diagnose a bad key or outage.
    console.error("Razorpay request failed", {
      statusCode:
        typeof failure.statusCode === "number" ? failure.statusCode : undefined,
      code:
        typeof failure.error?.code === "string"
          ? failure.error.code
          : typeof failure.code === "string"
            ? failure.code
            : undefined,
    });
    throw new Error(
      failure.statusCode === 401
        ? "Payments need a merchant configuration update. Please contact support."
        : "Payment provider is temporarily unavailable. Please try again shortly.",
    );
  }
}
export async function capturePayment(
  payment: {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  },
  owner?: string,
): Promise<number> {
  const balance = useMongo()
    ? await mongoCapture(payment, owner)
    : transaction(() => {
        const order = db()
          .prepare("SELECT * FROM orders WHERE id=?")
          .get(payment.order_id);
        if (!order || (owner && order.user_id !== owner))
          throw new Error("Unknown payment order.");
        if (
          payment.status !== "captured" ||
          payment.currency !== (order.currency || "INR") ||
          payment.amount !== Number(order.amount)
        )
          throw new Error(
            "Payment is not captured or does not match the order.",
          );
        if (!order.paid) {
          db()
            .prepare(
              "UPDATE orders SET paid=1,payment_id=? WHERE id=? AND paid=0",
            )
            .run(payment.id, payment.order_id);
          const credited = db()
            .prepare("UPDATE wallets SET balance=balance+? WHERE user_id=?")
            .run(Number(order.credits), String(order.user_id));
          if (!credited.changes) throw new Error("Unknown payment wallet.");
          db()
            .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
            .run(
              `payment:${payment.id}`,
              String(order.user_id),
              Number(order.credits),
              "Captured payment",
              new Date().toISOString(),
            );
          rewardReferral(String(order.user_id), payment.id);
        } else if (order.payment_id !== payment.id)
          throw new Error("Order was already settled with another payment.");
        return Number(
          db()
            .prepare("SELECT balance FROM wallets WHERE user_id=?")
            .get(String(order.user_id))?.balance ?? 0,
        );
      });
  // Only confirmed settlement reaches measurement. A replay keeps the same event
  // key, and an analytics outage must never turn a successful payment into an error.
  try {
    const user =
      owner ??
      (useMongo()
        ? (
            await (
              await collection("orders")
            ).findOne({ _id: payment.order_id }, { projection: { user: 1 } })
          )?.user
        : db()
            .prepare("SELECT user_id FROM orders WHERE id=?")
            .get(payment.order_id)?.user_id);
    if (typeof user === "string") {
      const { ownerMetric } = await import("@/lib/growth/metrics");
      await ownerMetric(user, "paid", payment.id);
    }
  } catch {
    /* Optional, consented measurement does not affect purchased credits. */
  }
  return balance;
}
