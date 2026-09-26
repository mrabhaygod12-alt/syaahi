/**
 * UPI Payment System — Core Library
 * ----------------------------------
 * Two methods:
 *   1. Direct UPI QR + UTR  → user scans, pays, submits UTR, admin approves
 *   2. Auto-Gateway (webhook) → third-party handles reconciliation
 *
 * All amounts are in paisa (INR × 100).
 */

import { createHmac, randomUUID } from "node:crypto";
import { useMongo, collection, mongoTransaction } from "@/lib/storage/mongo";
import { grant } from "@/lib/credits/store";
import { PACKS } from "./packs";

/* ───────────────────── Types ───────────────────── */

export type PaymentMethod = "upi_qr" | "upi_gateway";
export type PaymentStatus =
  | "pending"       // created, waiting for user action
  | "utr_submitted" // user submitted UTR, awaiting verification
  | "verifying"     // admin is reviewing
  | "approved"      // payment confirmed, credits granted
  | "rejected"      // admin rejected / fraudulent
  | "expired"       // TTL exceeded (30 min)
  | "auto_verified"; // gateway confirmed automatically

export interface UpiPayment {
  _id: string;
  user: string;
  userName?: string;
  userEmail?: string;
  pack: string;
  amount: number;         // paisa
  credits: number;
  method: PaymentMethod;
  status: PaymentStatus;
  upiId: string;          // merchant UPI ID
  utr?: string;           // submitted by user
  gatewayRef?: string;    // auto-gateway reference
  paymentToken: string;   // HMAC-signed token for verification
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;    // admin ID
  rejectionReason?: string;
  creditEventId?: string; // idempotency key for credit grant
}

/* ───────────────────── Config ───────────────────── */

const PAYMENT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const UPI_ID = () => process.env.UPI_MERCHANT_ID || "syaahi@upi";
const HMAC_SECRET = () =>
  process.env.UPI_HMAC_SECRET || process.env.BACKEND_PROXY_SECRET || "syaahi-upi-default-secret";

/* ───────────────────── Helpers ───────────────────── */

/** Generate HMAC-signed payment token */
function signPayment(orderId: string, amount: number): string {
  return createHmac("sha256", HMAC_SECRET())
    .update(`${orderId}:${amount}`)
    .digest("hex");
}

/** Validate UTR format (12-digit bank reference) */
export function isValidUTR(utr: string): boolean {
  const clean = utr.trim().replace(/\s/g, "");
  // UTR can be 12-22 chars, alphanumeric
  return /^[A-Za-z0-9]{12,22}$/.test(clean);
}

/** Generate UPI deep-link for QR code */
export function upiDeepLink(
  orderId: string,
  amount: number,
  name: string,
): string {
  const amountInr = (amount / 100).toFixed(2);
  const upiId = UPI_ID();
  const tn = `Syaahi-${orderId.slice(0, 8)}`;
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amountInr}&cu=INR&tn=${encodeURIComponent(tn)}`;
}

/* ───────────── MongoDB index bootstrap ─────────── */

let indexesReady: Promise<void> | null = null;
export async function ensureUpiIndexes(): Promise<void> {
  if (!useMongo()) return;
  if (indexesReady) return indexesReady;
  indexesReady = (async () => {
    const col = await collection("upi_payments");
    await Promise.all([
      col.createIndex({ user: 1, createdAt: -1 }),
      col.createIndex({ status: 1, createdAt: -1 }),
      col.createIndex({ utr: 1 }, {
        unique: true,
        partialFilterExpression: { utr: { $type: "string" } },
      }),
      col.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },   // auto-cleanup expired docs after TTL
      ),
    ]);
  })();
  return indexesReady;
}

/* ───────────── CREATE payment order ─────────────── */

export async function createUpiPayment(
  userId: string,
  packId: string,
  method: PaymentMethod = "upi_qr",
  userInfo?: { name?: string; email?: string },
): Promise<UpiPayment> {
  if (!useMongo()) throw new Error("UPI payments require MongoDB backend.");
  const pack = PACKS[packId];
  if (!pack) throw new Error("Unknown pack.");

  await ensureUpiIndexes();

  // Expire any pending orders for this user+pack
  const col = await collection("upi_payments");
  await col.updateMany(
    { user: userId, pack: packId, status: "pending" },
    { $set: { status: "expired", updatedAt: new Date() } },
  );

  const orderId = `upi_${randomUUID().replace(/-/g, "")}`;
  const now = new Date();
  const payment: UpiPayment = {
    _id: orderId,
    user: userId,
    userName: userInfo?.name || undefined,
    userEmail: userInfo?.email || undefined,
    pack: packId,
    amount: pack.inr * 100,
    credits: pack.credits,
    method,
    status: "pending",
    upiId: UPI_ID(),
    paymentToken: signPayment(orderId, pack.inr * 100),
    expiresAt: new Date(now.getTime() + PAYMENT_TTL_MS),
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(payment);
  return payment;
}

/* ───────────── SUBMIT UTR ────────────────────────── */

export async function submitUTR(
  orderId: string,
  userId: string,
  utr: string,
): Promise<UpiPayment> {
  if (!useMongo()) throw new Error("UPI payments require MongoDB backend.");
  await ensureUpiIndexes();

  const clean = utr.trim().replace(/\s/g, "");
  if (!isValidUTR(clean)) throw new Error("Invalid UTR format. Enter 12-22 character alphanumeric reference.");

  const col = await collection("upi_payments");

  // Check if UTR is already used
  const existing = await col.findOne({ utr: clean, status: { $in: ["approved", "auto_verified", "utr_submitted", "verifying"] } });
  if (existing && existing._id !== orderId)
    throw new Error("This UTR has already been submitted for another payment.");

  const result = await col.findOneAndUpdate(
    {
      _id: orderId,
      user: userId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        utr: clean,
        status: "utr_submitted" as PaymentStatus,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!result) throw new Error("Payment not found, already processed, or expired.");
  return result as unknown as UpiPayment;
}

/* ───────── ADMIN: list pending payments ──────────── */

export async function listPendingPayments(
  page = 1,
  limit = 20,
  statusFilter?: PaymentStatus,
): Promise<{ payments: UpiPayment[]; total: number }> {
  if (!useMongo()) return { payments: [], total: 0 };
  await ensureUpiIndexes();

  const col = await collection("upi_payments");
  const filter = statusFilter
    ? { status: statusFilter }
    : { status: { $in: ["utr_submitted", "verifying", "pending"] } };
  const total = await col.countDocuments(filter);
  const payments = await col
    .find(filter)
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return { payments: payments as unknown as UpiPayment[], total };
}

/* ───────── ADMIN: approve payment ────────────────── */

export async function approvePayment(
  orderId: string,
  adminId: string,
): Promise<UpiPayment> {
  if (!useMongo()) throw new Error("UPI payments require MongoDB backend.");
  await ensureUpiIndexes();

  return mongoTransaction(async (d, session) => {
    const col = d.collection<any>("upi_payments");
    const payment = await col.findOne(
      { _id: orderId, status: { $in: ["utr_submitted", "verifying"] } },
      { session },
    );
    if (!payment) throw new Error("Payment not found or not in approvable state.");

    const creditEventId = `upi_credit:${orderId}`;
    await col.updateOne(
      { _id: orderId },
      {
        $set: {
          status: "approved" as PaymentStatus,
          approvedBy: adminId,
          creditEventId,
          updatedAt: new Date(),
        },
      },
      { session },
    );

    // Grant credits — uses existing billing infra
    // grant() internally records in the ledger, so no separate ledger insert needed
    await grant(payment.user, payment.credits, creditEventId as any);

    // Also record in orders collection for consistency with Razorpay flow
    const orders = d.collection<any>("orders");
    const existingOrder = await orders.findOne({ _id: orderId }, { session });
    if (!existingOrder) {
      await orders.insertOne(
        {
          _id: orderId,
          user: payment.user,
          pack: payment.pack,
          amount: payment.amount,
          credits: payment.credits,
          paid: true,
          paymentId: `upi:${payment.utr || orderId}`,
          method: "upi_qr",
        },
        { session },
      );
    }

    const updated = await col.findOne({ _id: orderId }, { session });
    return updated as unknown as UpiPayment;
  });
}

/* ───────── ADMIN: reject payment ─────────────────── */

export async function rejectPayment(
  orderId: string,
  adminId: string,
  reason: string,
): Promise<UpiPayment> {
  if (!useMongo()) throw new Error("UPI payments require MongoDB backend.");
  await ensureUpiIndexes();

  const col = await collection("upi_payments");
  const result = await col.findOneAndUpdate(
    { _id: orderId, status: { $in: ["utr_submitted", "verifying"] } },
    {
      $set: {
        status: "rejected" as PaymentStatus,
        approvedBy: adminId,
        rejectionReason: reason || "Payment could not be verified.",
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!result) throw new Error("Payment not found or not in rejectable state.");
  return result as unknown as UpiPayment;
}

/* ───────── USER: get payment status ──────────────── */

export async function getPaymentStatus(
  orderId: string,
  userId: string,
): Promise<UpiPayment | null> {
  if (!useMongo()) return null;
  await ensureUpiIndexes();
  const col = await collection("upi_payments");
  const payment = await col.findOne({ _id: orderId, user: userId });
  return payment as unknown as UpiPayment | null;
}

/* ───────── USER: list own payments ───────────────── */

export async function listUserPayments(
  userId: string,
  page = 1,
  limit = 10,
): Promise<{ payments: UpiPayment[]; total: number }> {
  if (!useMongo()) return { payments: [], total: 0 };
  await ensureUpiIndexes();

  const col = await collection("upi_payments");
  const filter = { user: userId };
  const total = await col.countDocuments(filter);
  const payments = await col
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return { payments: payments as unknown as UpiPayment[], total };
}

/* ───────── AUTO-GATEWAY: webhook verification ────── */

export async function gatewayWebhookVerify(
  orderId: string,
  gatewayRef: string,
  amount: number,
  signature: string,
  secret: string,
): Promise<UpiPayment> {
  if (!useMongo()) throw new Error("UPI payments require MongoDB backend.");
  await ensureUpiIndexes();

  // Verify signature
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${gatewayRef}|${amount}`)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) throw new Error("Invalid gateway signature.");

  const { timingSafeEqual } = await import("node:crypto");
  if (!timingSafeEqual(sigBuf, expBuf))
    throw new Error("Invalid gateway signature.");

  return mongoTransaction(async (d, session) => {
    const col = d.collection<any>("upi_payments");
    const payment = await col.findOne(
      { _id: orderId, status: "pending" },
      { session },
    );
    if (!payment) throw new Error("Payment not found or already processed.");

    if (amount !== payment.amount)
      throw new Error("Amount mismatch.");

    const creditEventId = `upi_auto:${orderId}`;
    await col.updateOne(
      { _id: orderId },
      {
        $set: {
          status: "auto_verified" as PaymentStatus,
          gatewayRef,
          creditEventId,
          updatedAt: new Date(),
        },
      },
      { session },
    );

    await grant(payment.user, payment.credits, creditEventId as any);

    // Record in orders
    await d.collection<any>("orders").insertOne(
      {
        _id: orderId,
        user: payment.user,
        pack: payment.pack,
        amount: payment.amount,
        credits: payment.credits,
        paid: true,
        paymentId: `gateway:${gatewayRef}`,
        method: "upi_gateway",
      },
      { session },
    );

    const updated = await col.findOne({ _id: orderId }, { session });
    return updated as unknown as UpiPayment;
  });
}

/* ───────── ADMIN CHECK ───────────────────────────── */

export function isAdmin(userId: string): boolean {
  const admins = (process.env.SUPPORT_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return admins.includes(userId);
}

/* ───────── STATS for admin dashboard ─────────────── */

export async function paymentStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  totalRevenue: number;
}> {
  if (!useMongo())
    return { pending: 0, approved: 0, rejected: 0, totalRevenue: 0 };
  await ensureUpiIndexes();

  const col = await collection("upi_payments");
  const [pending, approved, rejected, revenue] = await Promise.all([
    col.countDocuments({ status: { $in: ["utr_submitted", "verifying"] } }),
    col.countDocuments({ status: { $in: ["approved", "auto_verified"] } }),
    col.countDocuments({ status: "rejected" }),
    col
      .aggregate([
        { $match: { status: { $in: ["approved", "auto_verified"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .toArray(),
  ]);

  return {
    pending,
    approved,
    rejected,
    totalRevenue: (revenue[0]?.total || 0) / 100,
  };
}
