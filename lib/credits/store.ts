import { useMongo } from "@/lib/storage/mongo";
import {
  mongoBalance,
  mongoGrant,
  mongoSpend,
} from "@/lib/storage/mongo-billing";
import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/db";
export function validCount(n: number) {
  if (!Number.isSafeInteger(n) || n <= 0 || n > 100000)
    throw new Error("Credits must be a positive integer.");
}
export async function balance(user: string): Promise<number> {
  if (useMongo()) return mongoBalance(user);
  return Number(
    db().prepare("SELECT balance FROM wallets WHERE user_id=?").get(user)
      ?.balance ?? 0,
  );
}
export async function spend(user: string, pages: number): Promise<number> {
  validCount(pages);
  if (useMongo()) return mongoSpend(user, pages);
  return transaction(() => {
    const result = db()
      .prepare(
        "UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?",
      )
      .run(pages, user, pages);
    if (!result.changes) throw new Error("Insufficient credits.");
    db()
      .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
      .run(randomUUID(), user, -pages, "Generation", new Date().toISOString());
    return Number(
      db().prepare("SELECT balance FROM wallets WHERE user_id=?").get(user)!
        .balance,
    );
  });
}
export async function grant(
  user: string,
  credits: number,
  eventId = randomUUID(),
): Promise<number> {
  validCount(credits);
  if (useMongo()) return mongoGrant(user, credits, eventId);
  return transaction(() => {
    if (!db().prepare("SELECT id FROM ledger WHERE id=?").get(eventId)) {
      if (
        !db().prepare("SELECT user_id FROM wallets WHERE user_id=?").get(user)
      )
        throw new Error("Unknown wallet.");
      db()
        .prepare("UPDATE wallets SET balance=balance+? WHERE user_id=?")
        .run(credits, user);
      db()
        .prepare("INSERT INTO ledger VALUES (?,?,?,?,?)")
        .run(eventId, user, credits, "Credit grant", new Date().toISOString());
    }
    return Number(
      db().prepare("SELECT balance FROM wallets WHERE user_id=?").get(user)
        ?.balance ?? 0,
    );
  });
}
