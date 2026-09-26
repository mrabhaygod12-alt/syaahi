import Razorpay from "razorpay";
import { useMongo } from "@/lib/storage/mongo";
import { mongoCapture } from "@/lib/storage/mongo-billing";
import { rewardReferral } from "./referrals";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, transaction } from "@/lib/db";
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
  const id = process.env.RAZORPAY_KEY_ID,
    secret = process.env.RAZORPAY_KEY_SECRET;
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
  } catch {
    throw new Error(
      "Payment provider unavailable. Check server merchant configuration or retry later.",
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
  if (useMongo()) return mongoCapture(payment, owner);
  return transaction(() => {
    const order = db()
      .prepare("SELECT * FROM orders WHERE id=?")
      .get(payment.order_id);
    if (!order || (owner && order.user_id !== owner))
      throw new Error("Unknown payment order.");
    if (
      payment.status !== "captured" ||
      payment.currency !== "INR" ||
      payment.amount !== Number(order.amount)
    )
      throw new Error("Payment is not captured or does not match the order.");
    if (!order.paid) {
      db()
        .prepare("UPDATE orders SET paid=1,payment_id=? WHERE id=? AND paid=0")
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
}
