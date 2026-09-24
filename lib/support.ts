import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
export interface TicketIndex {
  id: string;
  user: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
}
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS support_index (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS support_user ON support_index(user_id,created_at)",
  );
}
export async function listTickets(user?: string): Promise<TicketIndex[]> {
  if (useMongo())
    return (
      await (
        await collection("support_index")
      )
        .find(user ? { user } : {})
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray()
    ).map(({ _id, ...t }) => t as TicketIndex);
  setup();
  const rows = user
    ? db()
        .prepare(
          "SELECT payload FROM support_index WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        )
        .all(user)
    : db()
        .prepare(
          "SELECT payload FROM support_index ORDER BY created_at DESC LIMIT 100",
        )
        .all();
  return rows.map((r) => JSON.parse(String(r.payload)));
}
export async function findTicket(id: string): Promise<TicketIndex | null> {
  if (useMongo()) {
    const row = await (await collection("support_index")).findOne({ _id: id });
    return row as TicketIndex | null;
  }
  setup();
  const row = db()
    .prepare("SELECT payload FROM support_index WHERE id=?")
    .get(id);
  return row ? JSON.parse(String(row.payload)) : null;
}
export async function saveTicketIndex(t: TicketIndex) {
  if (useMongo()) {
    await (
      await collection("support_index")
    ).updateOne({ _id: t.id }, { $set: t }, { upsert: true });
    return;
  }
  setup();
  db()
    .prepare(
      "INSERT INTO support_index VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload",
    )
    .run(t.id, t.user, t.status, t.createdAt, JSON.stringify(t));
}
