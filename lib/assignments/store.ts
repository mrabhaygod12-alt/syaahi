import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
import type { Assignment } from "./types";
import { ASSIGNMENT_CREDITS } from "./types";

const decode = (value: unknown): Assignment =>
  JSON.parse(String(value)) as Assignment;
const cleanDoc = (doc: any): Assignment | null => {
  if (!doc) return null;
  const { _id, leaseUntil, leaseToken, ...assignment } = doc;
  return { ...assignment, id: assignment.id || _id } as Assignment;
};

export class AssignmentQueueFullError extends Error {}

export async function createAssignment(
  assignment: Assignment,
): Promise<Assignment> {
  if (useMongo()) {
    try {
      return await mongoTransaction(async (d, session) => {
        const opts = { session };
        const jobs = d.collection<any>("assignment_jobs");
        const existing = cleanDoc(
          await jobs.findOne({ _id: assignment.id }, opts),
        );
        if (existing) {
          if (existing.user !== assignment.user)
            throw new Error("Invalid assignment request.");
          return existing;
        }
        const active = await jobs.countDocuments(
          {
            user: assignment.user,
            status: { $in: ["queued", "working", "outline"] },
          },
          opts,
        );
        if (active >= 1)
          throw new AssignmentQueueFullError(
            "Finish or cancel your current assignment before starting another.",
          );
        const globalLimit = Math.max(
          1,
          Math.min(200, Number(process.env.ASSIGNMENT_QUEUE_LIMIT) || 40),
        );
        const totalActive = await jobs.countDocuments(
          { status: { $in: ["queued", "working", "outline"] } },
          opts,
        );
        if (totalActive >= globalLimit)
          throw new AssignmentQueueFullError(
            "The assignment queue is busy. Please try again shortly.",
          );
        const wallet = await d
          .collection<any>("wallets")
          .updateOne(
            { _id: assignment.user, balance: { $gte: ASSIGNMENT_CREDITS } },
            { $inc: { balance: -ASSIGNMENT_CREDITS } },
            opts,
          );
        if (!wallet.modifiedCount)
          throw new Error(
            "This assignment needs 8 credits. Add credits and try again.",
          );
        await d
          .collection<any>("ledger")
          .insertOne(
            {
              _id: `assignment:${assignment.id}`,
              user: assignment.user,
              delta: -ASSIGNMENT_CREDITS,
              reason: "Assignment Studio",
              createdAt: new Date(),
            },
            opts,
          );
        await jobs.insertOne(
          { _id: assignment.id, ...assignment, leaseUntil: 0 },
          opts,
        );
        return assignment;
      });
    } catch (error) {
      const existing = await getAssignment(assignment.id, assignment.user);
      if (existing) return existing;
      throw error;
    }
  }
  return transaction(() => {
    const existingRow = db()
      .prepare("SELECT payload FROM assignment_jobs WHERE id=?")
      .get(assignment.id);
    if (existingRow) {
      const existing = decode(existingRow.payload);
      if (existing.user !== assignment.user)
        throw new Error("Invalid assignment request.");
      return existing;
    }
    const active = Number(
      db()
        .prepare(
          "SELECT COUNT(*) AS count FROM assignment_jobs WHERE user_id=? AND status IN ('queued','working','outline')",
        )
        .get(assignment.user)?.count || 0,
    );
    if (active >= 1)
      throw new AssignmentQueueFullError(
        "Finish or cancel your current assignment before starting another.",
      );
    const globalLimit = Math.max(
      1,
      Math.min(200, Number(process.env.ASSIGNMENT_QUEUE_LIMIT) || 40),
    );
    const totalActive = Number(
      db()
        .prepare(
          "SELECT COUNT(*) AS count FROM assignment_jobs WHERE status IN ('queued','working','outline')",
        )
        .get()?.count || 0,
    );
    if (totalActive >= globalLimit)
      throw new AssignmentQueueFullError(
        "The assignment queue is busy. Please try again shortly.",
      );
    const wallet = db()
      .prepare(
        "UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?",
      )
      .run(ASSIGNMENT_CREDITS, assignment.user, ASSIGNMENT_CREDITS);
    if (!wallet.changes)
      throw new Error(
        "This assignment needs 8 credits. Add credits and try again.",
      );
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(
        `assignment:${assignment.id}`,
        assignment.user,
        -ASSIGNMENT_CREDITS,
        "Assignment Studio",
        assignment.createdAt,
      );
    db()
      .prepare(
        "INSERT INTO assignment_jobs (id,user_id,status,payload,lease_until) VALUES (?,?,?,?,0)",
      )
      .run(
        assignment.id,
        assignment.user,
        assignment.status,
        JSON.stringify(assignment),
      );
    return assignment;
  });
}

export async function getAssignment(
  id: string,
  user: string,
): Promise<Assignment | null> {
  if (!/^[a-f0-9-]{24,40}$/i.test(id)) return null;
  if (useMongo())
    return cleanDoc(
      await (await collection("assignment_jobs")).findOne({ _id: id, user }),
    );
  const row = db()
    .prepare("SELECT payload FROM assignment_jobs WHERE id=? AND user_id=?")
    .get(id, user);
  return row ? decode(row.payload) : null;
}

export async function listAssignments(
  user: string,
  limit = 12,
): Promise<Assignment[]> {
  if (useMongo())
    return (
      await (
        await collection("assignment_jobs")
      )
        .find({ user })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
    )
      .map(cleanDoc)
      .filter((item): item is Assignment => Boolean(item));
  return db()
    .prepare(
      "SELECT payload FROM assignment_jobs WHERE user_id=? ORDER BY rowid DESC LIMIT ?",
    )
    .all(user, Math.min(30, Math.max(1, limit)))
    .map((row) => decode(row.payload));
}

export async function updateOwnedAssignment(
  id: string,
  user: string,
  change: (assignment: Assignment) => Assignment,
): Promise<Assignment | null> {
  if (useMongo())
    return mongoTransaction(async (d, session) => {
      const jobs = d.collection<any>("assignment_jobs"),
        opts = { session };
      const old = cleanDoc(await jobs.findOne({ _id: id, user }, opts));
      if (!old) return null;
      const next = change(old);
      if (next.id !== id || next.user !== user)
        throw new Error("Invalid assignment update.");
      const { id: _id, ...fields } = next;
      await jobs.updateOne({ _id: id, user }, { $set: fields }, opts);
      return next;
    });
  return transaction(() => {
    const row = db()
      .prepare("SELECT payload FROM assignment_jobs WHERE id=? AND user_id=?")
      .get(id, user);
    if (!row) return null;
    const next = change(decode(row.payload));
    if (next.id !== id || next.user !== user)
      throw new Error("Invalid assignment update.");
    db()
      .prepare(
        "UPDATE assignment_jobs SET status=?,payload=? WHERE id=? AND user_id=?",
      )
      .run(next.status, JSON.stringify(next), id, user);
    return next;
  });
}

export async function pendingAssignments(limit = 1): Promise<string[]> {
  const now = Date.now();
  if (useMongo())
    return (
      await (
        await collection("assignment_jobs")
      )
        .find({
          $or: [
            { status: "queued", leaseUntil: { $lt: now } },
            { status: "working", leaseUntil: { $lt: now } },
            // Recover older jobs that stopped at the outline approval screen.
            { status: "outline", leaseUntil: { $lt: now } },
          ],
        })
        .sort({ createdAt: 1 })
        .limit(limit)
        .project({ _id: 1 })
        .toArray()
    ).map((doc) => String(doc._id));
  return db()
    .prepare(
      "SELECT id FROM assignment_jobs WHERE status IN ('queued','working','outline') AND lease_until<? ORDER BY rowid LIMIT ?",
    )
    .all(now, limit)
    .map((row) => String(row.id));
}

export async function claimAssignment(
  id: string,
): Promise<{ assignment: Assignment; token: string } | null> {
  const token = randomUUID(),
    until = Date.now() + 5 * 60_000;
  if (useMongo()) {
    const doc = await (
      await collection("assignment_jobs")
    ).findOneAndUpdate(
      {
        _id: id,
        $or: [
          { status: "queued", leaseUntil: { $lt: Date.now() } },
          { status: "working", leaseUntil: { $lt: Date.now() } },
          { status: "outline", leaseUntil: { $lt: Date.now() } },
        ],
      },
      { $set: { status: "working", leaseToken: token, leaseUntil: until } },
      { returnDocument: "after" },
    );
    const assignment = cleanDoc(doc);
    return assignment ? { assignment, token } : null;
  }
  return transaction(() => {
    const row = db()
      .prepare(
        "SELECT payload FROM assignment_jobs WHERE id=? AND status IN ('queued','working','outline') AND lease_until<?",
      )
      .get(id, Date.now(), Date.now());
    if (!row) return null;
    const assignment = decode(row.payload);
    assignment.status = "working";
    db()
      .prepare(
        "UPDATE assignment_jobs SET status='working',payload=?,lease_until=?,lease_token=? WHERE id=?",
      )
      .run(JSON.stringify(assignment), until, token, id);
    return { assignment, token };
  });
}

export async function saveClaimedAssignment(
  id: string,
  token: string,
  assignment: Assignment,
  retryAt = 0,
): Promise<boolean> {
  if (useMongo()) {
    const { id: _id, ...fields } = assignment;
    const result = await (
      await collection("assignment_jobs")
    ).updateOne(
      { _id: id, leaseToken: token },
      { $set: { ...fields, leaseUntil: retryAt }, $unset: { leaseToken: "" } },
    );
    return result.modifiedCount > 0;
  }
  const result = db()
    .prepare(
      "UPDATE assignment_jobs SET status=?,payload=?,lease_until=?,lease_token=NULL WHERE id=? AND lease_token=?",
    )
    .run(assignment.status, JSON.stringify(assignment), retryAt, id, token);
  return result.changes > 0;
}
