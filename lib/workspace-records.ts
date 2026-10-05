import { collection, useMongo, mongoTransaction } from "@/lib/storage/mongo";
import { db, transaction } from "@/lib/db";
export interface WorkspaceRecord {
  id: string;
  owner: string;
  kind: string;
  updatedAt: string;
}
export async function record<T extends WorkspaceRecord>(
  id: string,
): Promise<T | null> {
  if (useMongo())
    return ((await (await collection("workspace_records")).findOne({ _id: id }))
      ?.payload || null) as T | null;
  const row = db()
    .prepare("SELECT payload FROM workspace_records WHERE id=?")
    .get(id);
  return row ? JSON.parse(String(row.payload)) : null;
}
export async function records<T extends WorkspaceRecord>(
  kind: string,
  owner?: string,
): Promise<T[]> {
  if (useMongo())
    return (
      await (
        await collection("workspace_records")
      )
        .find({ kind, ...(owner ? { owner } : {}) })
        .sort({ updatedAt: -1 })
        .limit(80)
        .toArray()
    ).map((row) => row.payload as T);
  return (
    owner
      ? db()
          .prepare(
            "SELECT payload FROM workspace_records WHERE kind=? AND owner=? ORDER BY updated_at DESC LIMIT 80",
          )
          .all(kind, owner)
      : db()
          .prepare(
            "SELECT payload FROM workspace_records WHERE kind=? ORDER BY updated_at DESC LIMIT 80",
          )
          .all(kind)
  ).map((row) => JSON.parse(String(row.payload)));
}
export async function mutateRecord<T extends WorkspaceRecord>(
  id: string,
  change: (old: T | null) => T,
  credit?: { delta: number; event: string; reason?: string },
): Promise<T> {
  if (useMongo())
    return mongoTransaction(async (database, session) => {
      const c = database.collection<any>("workspace_records"),
        old = (await c.findOne({ _id: id }, { session }))?.payload || null;
      const next = change(old);
      if (
        credit &&
        !(await database
          .collection<any>("ledger")
          .findOne({ _id: credit.event }, { session }))
      ) {
        const wallet = await database.collection<any>("wallets").updateOne(
          {
            _id: next.owner,
            ...(credit.delta < 0 ? { balance: { $gte: -credit.delta } } : {}),
          },
          { $inc: { balance: credit.delta } },
          { session },
        );
        if (!wallet.matchedCount) throw new Error("Insufficient credits.");
        await database.collection<any>("ledger").insertOne(
          {
            _id: credit.event,
            user: next.owner,
            delta: credit.delta,
            reason: credit.reason || "Presentation",
            createdAt: new Date(),
          },
          { session },
        );
      }
      await c.updateOne(
        { _id: id },
        {
          $set: {
            owner: next.owner,
            kind: next.kind,
            updatedAt: next.updatedAt,
            payload: next,
            ...(next.kind === "presentation-source"
              ? { sourceCacheExpiresAt: new Date(Date.now() + 86400000) }
              : {}),
          },
        },
        { upsert: true, session },
      );
      return next;
    });
  return transaction(() => {
    const row = db()
        .prepare("SELECT payload FROM workspace_records WHERE id=?")
        .get(id),
      next = change(row ? JSON.parse(String(row.payload)) : null);
    if (
      credit &&
      !db().prepare("SELECT id FROM ledger WHERE id=?").get(credit.event)
    ) {
      const changed = db()
        .prepare(
          "UPDATE wallets SET balance=balance+? WHERE user_id=? AND balance>=?",
        )
        .run(credit.delta, next.owner, Math.max(0, -credit.delta));
      if (!changed.changes) throw new Error("Insufficient credits.");
      db()
        .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
        .run(
          credit.event,
          next.owner,
          credit.delta,
          credit.reason || "Presentation",
          new Date().toISOString(),
        );
    }
    db()
      .prepare(
        "INSERT INTO workspace_records VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,kind=excluded.kind,updated_at=excluded.updated_at,payload=excluded.payload",
      )
      .run(id, next.owner, next.kind, next.updatedAt, JSON.stringify(next));
    return next;
  });
}
