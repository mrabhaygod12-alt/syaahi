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
    ).insertOne({ _id: id, user, pack, amount, credits, paid: false });
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
