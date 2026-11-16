import { randomUUID } from "node:crypto";
import { AdminInputError } from "./accounts";
import { auditSetup, type AdminEvent } from "./audit";
import type { Account } from "@/lib/auth/server";
import { adminEligibility } from "@/lib/auth/admin";
import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
import { readState } from "@/lib/study/state";

const MAX_ADMIN_GRANT = 10_000;

export interface AdminCreditGrantInput {
  id: string;
  credits: number;
  reason: string;
  operationId: string;
}

function validate(actor: Account, input: AdminCreditGrantInput) {
  if (
    !adminEligibility(actor).users ||
    (!actor.adminAuthenticated &&
      (process.env.NODE_ENV === "production" ||
        process.env.ADMIN_MFA_ENFORCE === "1" ||
        actor.adminMfaEnrolled))
  )
    throw new AdminInputError(
      "Verified user-administrator access required.",
      403,
    );
  if (
    !input ||
    typeof input.id !== "string" ||
    input.id.length < 1 ||
    input.id.length > 80 ||
    !Number.isSafeInteger(input.credits) ||
    input.credits < 1 ||
    input.credits > MAX_ADMIN_GRANT ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.length > 300 ||
    typeof input.operationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.operationId,
    )
  )
    throw new AdminInputError(
      `Choose an existing account, 1–${MAX_ADMIN_GRANT} credits, a reason (5–300 characters), and a valid operation ID.`,
    );
}

function sameGrant(
  existing: any,
  target: string,
  credits: number,
  reason: string,
) {
  return (
    String(existing.user_id ?? existing.user) === target &&
    Number(existing.delta) === credits &&
    String(existing.reason) === reason
  );
}

function ensureActive(status: unknown) {
  if (status !== "active")
    throw new AdminInputError(
      "Credits can only be granted to an active account.",
      409,
    );
}

export async function grantAdminCredits(
  actor: Account,
  input: AdminCreditGrantInput,
) {
  validate(actor, input);
  const target = input.id,
    reason = `Admin grant: ${input.reason.trim()}`,
    eventId = `admin-credit:${actor.id}:${input.operationId}`,
    at = new Date().toISOString();
  const event: AdminEvent = {
    id: randomUUID(),
    actor: actor.id,
    target,
    action: "credit.grant",
    at,
    detail: `${input.credits} credits; ${input.reason.trim()}; reference ${eventId}`,
  };

  if (useMongo())
    return mongoTransaction(async (d, session) => {
      const opts = { session },
        ledger = d.collection<any>("ledger"),
        existing = await ledger.findOne({ _id: eventId }, opts);
      if (existing) {
        if (!sameGrant(existing, target, input.credits, reason))
          throw new AdminInputError("This operation ID was already used.", 409);
        const current = await d
          .collection<any>("wallets")
          .findOne({ _id: target }, opts);
        return {
          balance: Number(current?.balance || 0),
          eventId,
          replayed: true,
        };
      }

      const users = d.collection<any>("users"),
        user = await users.findOne({ _id: target }, opts);
      if (!user) throw new AdminInputError("User not found.", 404);
      const control = await d
        .collection<any>("study_state")
        .findOne({ _id: `${target}:account-control` }, opts);
      ensureActive(control?.payload?.status || "active");

      const wallets = d.collection<any>("wallets"),
        changed = await wallets.updateOne(
          { _id: target },
          { $inc: { balance: input.credits } },
          opts,
        );
      if (!changed.matchedCount)
        throw new AdminInputError("The account has no credit wallet.", 409);
      await ledger.insertOne(
        {
          _id: eventId,
          user: target,
          delta: input.credits,
          reason,
          createdAt: new Date(at),
        },
        opts,
      );
      await d.collection<any>("admin_audit").insertOne(
        {
          _id: event.id,
          ...event,
          expiresAt: new Date(Date.now() + 180 * 86400000),
        },
        opts,
      );
      const wallet = await wallets.findOne({ _id: target }, opts);
      return {
        balance: Number(wallet?.balance || 0),
        eventId,
        replayed: false,
      };
    });

  await readState("@admin", "setup", null);
  auditSetup();
  return transaction(() => {
    const old = db()
      .prepare("SELECT user_id,delta,reason FROM ledger WHERE id=?")
      .get(eventId);
    if (old) {
      if (!sameGrant(old, target, input.credits, reason))
        throw new AdminInputError("This operation ID was already used.", 409);
      const current = db()
        .prepare("SELECT balance FROM wallets WHERE user_id=?")
        .get(target);
      return {
        balance: Number(current?.balance || 0),
        eventId,
        replayed: true,
      };
    }
    const user = db()
      .prepare(
        "SELECT u.id,COALESCE(json_extract(a.payload,'$.status'),'active') AS status FROM users u LEFT JOIN study_state a ON a.id=u.id||':account-control' WHERE u.id=?",
      )
      .get(target);
    if (!user) throw new AdminInputError("User not found.", 404);
    ensureActive(user.status);
    const changed = db()
      .prepare("UPDATE wallets SET balance=balance+? WHERE user_id=?")
      .run(input.credits, target);
    if (!changed.changes)
      throw new AdminInputError("The account has no credit wallet.", 409);
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(eventId, target, input.credits, reason, at);
    db()
      .prepare("INSERT INTO admin_audit VALUES (?,?,?)")
      .run(event.id, event.at, JSON.stringify(event));
    const wallet = db()
      .prepare("SELECT balance FROM wallets WHERE user_id=?")
      .get(target);
    return { balance: Number(wallet?.balance || 0), eventId, replayed: false };
  });
}

export async function recentAdminCreditLedger(user: string, limit = 10) {
  const take = Math.max(1, Math.min(50, Math.floor(limit)));
  if (useMongo())
    return (
      await (
        await collection("ledger")
      )
        .find({ user, reason: { $regex: /^Admin grant:/ } })
        .sort({ createdAt: -1 })
        .limit(take)
        .toArray()
    ).map((entry) => ({
      reference: String(entry._id),
      delta: Number(entry.delta),
      reason: String(entry.reason),
      at: entry.createdAt,
    }));
  return db()
    .prepare(
      "SELECT id AS reference,delta,reason,created_at AS at FROM ledger WHERE user_id=? AND reason LIKE 'Admin grant:%' ORDER BY created_at DESC LIMIT ?",
    )
    .all(user, take);
}
