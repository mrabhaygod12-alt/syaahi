import { db } from "@/lib/db";
import { useMongo, collection } from "@/lib/storage/mongo";
export async function saveOrder(
  id: string,
  user: string,
  pack: string,
  amount: number,
  credits: number,
) {
  if (useMongo()) {
    await (
      await collection("orders")
    ).insertOne({
      _id: id,
      user,
      pack,
      amount,
      credits,
      paid: false,
      createdAt: new Date(),
    });
    return;
  }
  db()
    .prepare(
      "INSERT INTO orders (id,user_id,pack,amount,credits) VALUES (?,?,?,?,?)",
    )
    .run(id, user, pack, amount, credits);
}
export async function ownsOrder(id: string, user: string) {
  if (useMongo())
    return !!(await (await collection("orders")).findOne({ _id: id, user }));
  return !!db()
    .prepare("SELECT id FROM orders WHERE id=? AND user_id=?")
    .get(id, user);
}

export interface OrderSummary {
  id: string;
  pack: string;
  amount: number;
  credits: number;
  paid: boolean;
  paymentId: string | null;
}

/** Filter by the authenticated owner in the database, before returning records. */
export async function userOrders(
  user: string,
  id?: string,
): Promise<OrderSummary[]> {
  if (useMongo()) {
    const rows = await (
      await collection("orders")
    )
      .find({ user, ...(id ? { _id: id } : {}) })
      .sort({ createdAt: -1 })
      .limit(id ? 1 : 50)
      .toArray();
    return rows.map((row) => ({
      id: String(row._id),
      pack: String(row.pack),
      amount: Number(row.amount),
      credits: Number(row.credits),
      paid: row.paid === true,
      paymentId: typeof row.paymentId === "string" ? row.paymentId : null,
    }));
  }
  const rows = id
    ? db()
        .prepare("SELECT * FROM orders WHERE user_id=? AND id=?")
        .all(user, id)
    : db()
        .prepare(
          "SELECT * FROM orders WHERE user_id=? ORDER BY rowid DESC LIMIT 50",
        )
        .all(user);
  return rows.map((row) => ({
    id: String(row.id),
    pack: String(row.pack),
    amount: Number(row.amount),
    credits: Number(row.credits),
    paid: Boolean(row.paid),
    paymentId: typeof row.payment_id === "string" ? row.payment_id : null,
  }));
}
