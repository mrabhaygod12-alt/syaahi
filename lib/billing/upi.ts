import { UPI_MERCHANTS, type UpiMerchant } from "./upi-merchants";
/**
 * UPI Payment System — Core Library
 * ----------------------------------
 * Two methods:
 *   1. Direct UPI QR + UTR  → user scans, pays, submits UTR, admin approves
 *   2. Auto-Gateway (webhook) → third-party handles reconciliation
 *
 * All amounts are in paisa (INR × 100).
 */

import { randomUUID } from "node:crypto";
import { useMongo, collection, mongoTransaction } from "@/lib/storage/mongo";

import { PACKS } from "./packs";

/* ───────────────────── Types ───────────────────── */

export type PaymentMethod = "upi_qr" | "upi_gateway";
export type PaymentStatus =
  | "pending" // created, waiting for user action
  | "utr_submitted" // user submitted UTR, awaiting verification
  | "verifying" // admin is reviewing
  | "approved" // payment confirmed, credits granted
  | "rejected" // admin rejected / fraudulent
  | "expired" // TTL exceeded (30 min)
  | "auto_verified"; // gateway confirmed automatically

export interface UpiPayment {
  _id: string;
  user: string;
  userName?: string;
  userEmail?: string;
  pack: string;
  amount: number; // paisa
  credits: number;
  method: PaymentMethod;
  status: PaymentStatus;
  upiId: string; // Immutable receiving account snapshot
  qrProvider?: string;
  payeeName?: string;
  utr?: string; // submitted by user
  gatewayRef?: string; // auto-gateway reference
  paymentToken?: string; // Legacy field; never used for authorization
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string; // admin ID
  rejectionReason?: string;
  creditEventId?: string; // idempotency key for credit grant
}

/* ───────────────────── Config ───────────────────── */

const PAYMENT_TTL_MS = 30 * 60 * 1000; // 30 minutes
export class PaymentError extends Error {}
export function merchant(provider: string = "phonepe") {
  if (!Object.hasOwn(UPI_MERCHANTS, provider))
    throw new PaymentError("Unknown receiving QR.");
  return UPI_MERCHANTS[provider as UpiMerchant];
}
export function paymentPage(value: unknown): number {
  const n = Number(value || 1);
  if (!Number.isSafeInteger(n) || n < 1 || n > 10000)
    throw new PaymentError("Invalid page.");
  return n;
}
export async function isAdmin(userId: string): Promise<boolean> {
  if (
    (process.env.PAYMENT_ADMIN_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(userId)
  )
    return true;
  return (
    useMongo() &&
    !!(await (
      await collection("payment_admins")
    ).findOne({ _id: userId, active: true }))
  );
}
async function requireAdmin(id: string) {
  if (!(await isAdmin(id)))
    throw new PaymentError("Payment administrator access required.");
}

/** Validate UTR format (12-digit bank reference) */
export function isValidUTR(utr: string): boolean {
  const clean = utr.trim().replace(/\s/g, "").toUpperCase();
  // UTR can be 12-22 chars, alphanumeric
  return /^[A-Za-z0-9]{12,22}$/.test(clean);
}

/** Generate UPI deep-link for QR code */
export function upiDeepLink(
  orderId: string,
  amount: number,
  name: string,
  upiId = merchant().id as string,
): string {
  const amountInr = (amount / 100).toFixed(2);
  const tn = `Syaahi-${orderId.slice(0, 8)}`;
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amountInr}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${encodeURIComponent(orderId)}`;
}

/* ───────────── MongoDB index bootstrap ─────────── */

let indexesReady: Promise<void> | null = null;
export async function ensureUpiIndexes(): Promise<void> {
  if (!useMongo()) return;
  if (indexesReady) return indexesReady;
  indexesReady = (async () => {
    const col = await collection("upi_payments");
    // Financial records must never expire. Remove the legacy destructive TTL index.
    for (const index of await col
      .listIndexes()
      .toArray()
      .catch((e) => {
        if (e.code === 26) return [];
        throw e;
      })) {
      if (
        index.key?.expiresAt &&
        index.expireAfterSeconds !== undefined &&
        index.name
      )
        await col.dropIndex(index.name).catch((e) => {
          if (e.code !== 27) throw e;
        });
    }
    await Promise.all([
      col.createIndex({ user: 1, createdAt: -1 }),
      col.createIndex({ status: 1, createdAt: -1 }),
      col.createIndex(
        { utr: 1 },
        {
          unique: true,
          partialFilterExpression: { utr: { $type: "string" } },
        },
      ),
      col.createIndex(
        { utr: 1 },
        {
          name: "utr_case_insensitive",
          unique: true,
          collation: { locale: "en", strength: 2 },
          partialFilterExpression: { utr: { $type: "string" } },
        },
      ),
      col.createIndex({ expiresAt: 1 }),
    ]);
  })().catch((e) => {
    indexesReady = null;
    throw e;
  });
  return indexesReady;
}

/* ───────────── CREATE payment order ─────────────── */

export async function createUpiPayment(
  userId: string,
  packId: string,
  method: PaymentMethod = "upi_qr",
  userInfo?: { name?: string; email?: string },
  qrProvider = "phonepe",
): Promise<UpiPayment> {
  if (!useMongo()) throw new Error("UPI payments require MongoDB backend.");
  if (method !== "upi_qr")
    throw new PaymentError("Use Razorpay checkout for automatic payments.");
  const payee = merchant(qrProvider);
  if (
    !(process.env.PAYMENT_ADMIN_IDS || "").trim() &&
    !(await (await collection("payment_admins")).findOne({ active: true }))
  )
    throw new PaymentError(
      "Manual payment review is not configured yet. Please use automatic checkout or contact support.",
    );
  if (!Object.hasOwn(PACKS, packId)) throw new PaymentError("Unknown pack.");
  const pack = PACKS[packId];

  await ensureUpiIndexes();

  const col = await collection("upi_payments");
  await expirePending(userId);
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
    upiId: payee.id,
    qrProvider,
    payeeName: payee.name,
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

  const clean = utr.trim().replace(/\s/g, "").toUpperCase();
  if (!isValidUTR(clean))
    throw new PaymentError(
      "Invalid UTR format. Enter 12-22 character alphanumeric reference.",
    );

  const col = await collection("upi_payments");
  const replay = await col.findOne({ _id: orderId, user: userId, utr: clean });
  if (
    replay &&
    ["utr_submitted", "verifying", "approved"].includes(replay.status)
  )
    return replay as UpiPayment;

  // Check if UTR is already used
  const existing = await col.findOne({ utr: clean, status: { $exists: true } });
  if (existing && existing._id !== orderId)
    throw new PaymentError(
      "This UTR has already been submitted for another payment.",
    );

  const result = await col
    .findOneAndUpdate(
      {
        _id: orderId,
        user: userId,
        method: "upi_qr",
        status: { $in: ["pending", "expired"] },
        createdAt: { $gt: new Date(Date.now() - 7 * 86400000) },
      },
      {
        $set: {
          utr: clean,
          status: "utr_submitted" as PaymentStatus,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    )
    .catch((e) => {
      if (e.code === 11000)
        throw new PaymentError(
          "This UTR is already attached to another payment. Contact support if this is incorrect.",
        );
      throw e;
    });

  if (!result)
    throw new PaymentError(
      "Payment not found or not eligible. Contact support if you have already paid.",
    );
  return result as unknown as UpiPayment;
}

/* ───────── ADMIN: list pending payments ──────────── */

export async function listPendingPayments(
  page = 1,
  limit = 20,
  statusFilter?: PaymentStatus | "all",
  search = "",
): Promise<{ payments: UpiPayment[]; total: number }> {
  if (!useMongo()) return { payments: [], total: 0 };
  await ensureUpiIndexes();

  const col = await collection("upi_payments");
  await expirePending();
  page = paymentPage(page);
  const filter: Record<string, any> =
    statusFilter === "all"
      ? {}
      : statusFilter
        ? { status: statusFilter }
        : { status: { $in: ["utr_submitted", "verifying", "pending"] } };
  if (search.trim()) {
    const literal = search
      .trim()
      .slice(0, 120)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["user", "userName", "userEmail", "_id", "utr"].map((key) => ({
      [key]: { $regex: literal, $options: "i" },
    }));
  }
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

  await requireAdmin(adminId);
  return mongoTransaction(async (d, session) => {
    const opts = { session },
      col = d.collection<any>("upi_payments");
    const payment = await col.findOne({ _id: orderId, method: "upi_qr" }, opts);
    if (!payment) throw new PaymentError("Payment not found.");
    if (payment.status === "approved") return payment as UpiPayment;
    if (
      !["utr_submitted", "verifying"].includes(payment.status) ||
      !payment.utr
    )
      throw new PaymentError("A submitted UTR is required before approval.");
    const creditEventId = `upi_credit:${orderId}`;
    // Keep compatibility with any legacy grant already committed outside approval.
    const ledger = d.collection<any>("ledger");
    const prior = await ledger.findOne({ _id: creditEventId }, opts);
    if (
      prior &&
      (prior.user !== payment.user || prior.delta !== payment.credits)
    )
      throw new Error("Ledger mismatch");
    if (!prior) {
      const changed = await d
        .collection<any>("wallets")
        .updateOne(
          { _id: payment.user },
          { $inc: { balance: payment.credits } },
          opts,
        );
      if (!changed.matchedCount) throw new Error("Unknown wallet");
      await ledger.insertOne(
        {
          _id: creditEventId,
          user: payment.user,
          delta: payment.credits,
          reason: "Verified manual UPI payment",
          createdAt: new Date(),
        },
        opts,
      );
    }
    await d.collection<any>("orders").updateOne(
      { _id: orderId },
      {
        $setOnInsert: {
          user: payment.user,
          pack: payment.pack,
          amount: payment.amount,
          credits: payment.credits,
          paid: true,
          paymentId: `upi:${payment.utr}`,
          method: "upi_qr",
        },
      },
      { ...opts, upsert: true },
    );
    const updated = await col.findOneAndUpdate(
      { _id: orderId },
      {
        $set: {
          status: "approved",
          approvedBy: adminId,
          creditEventId,
          updatedAt: new Date(),
        },
      },
      { ...opts, returnDocument: "after" },
    );
    return updated as UpiPayment;
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

  await requireAdmin(adminId);
  const col = await collection("upi_payments");
  const result = await col.findOneAndUpdate(
    { _id: orderId, status: { $in: ["utr_submitted", "verifying"] } },
    {
      $set: {
        status: "rejected" as PaymentStatus,
        approvedBy: adminId,
        rejectionReason:
          reason.trim().slice(0, 500) || "Payment could not be verified.",
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!result)
    throw new PaymentError("Payment not found or not in rejectable state.");
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
  await expirePending(userId);
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
  await expirePending(userId);
  page = paymentPage(page);
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

async function expirePending(user?: string) {
  const col = await collection("upi_payments");
  await col.updateMany(
    {
      ...(user ? { user } : {}),
      status: "pending",
      expiresAt: { $lte: new Date() },
    },
    { $set: { status: "expired", updatedAt: new Date() } },
  );
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
