import { db, transaction } from "@/lib/db";
import { collection, mongoTransaction, useMongo } from "@/lib/storage/mongo";
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS study_state (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL)",
  );
}
export async function readState<T>(
  owner: string,
  key: string,
  fallback: T,
): Promise<T> {
  const id = `${owner}:${key}`;
  if (useMongo())
    return (
      (await (await collection("study_state")).findOne({ _id: id }))?.payload ??
      fallback
    );
  setup();
  const row = db()
    .prepare("SELECT payload FROM study_state WHERE id=? AND owner=?")
    .get(id, owner);
  return row ? JSON.parse(String(row.payload)) : fallback;
}
export async function mutateState<T>(
  owner: string,
  key: string,
  fallback: T,
  change: (value: T) => T,
): Promise<T> {
  const id = `${owner}:${key}`;
  if (useMongo())
    return mongoTransaction(async (d, session) => {
      const c = d.collection<any>("study_state");
      const row = await c.findOne({ _id: id }, { session });
      const result = change(row?.payload ?? fallback);
      await c.updateOne(
        { _id: id },
        { $set: { owner, payload: result } },
        { upsert: true, session },
      );
      return result;
    });
  setup();
  return transaction(() => {
    const row = db()
      .prepare("SELECT payload FROM study_state WHERE id=? AND owner=?")
      .get(id, owner);
    const result = change(row ? JSON.parse(String(row.payload)) : fallback);
    db()
      .prepare(
        "INSERT INTO study_state VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(id, owner, JSON.stringify(result));
    return result;
  });
}
