import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const state = globalThis as unknown as { syaahiDb?: DatabaseSync };
export function db(): DatabaseSync {
  if (state.syaahiDb) return state.syaahiDb;
  const dir = process.env.DATA_DIR || join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const connection = new DatabaseSync(join(dir, "syaahi.sqlite"));
  connection.exec(`
    PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL, password TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_identities (subject TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL
      REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wallets (user_id TEXT PRIMARY KEY, balance INTEGER NOT NULL CHECK(balance >= 0));
    CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL,
      payload TEXT NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0, lease_token TEXT);
    CREATE INDEX IF NOT EXISTS jobs_user ON jobs(user_id);
    CREATE TABLE IF NOT EXISTS reservations (job_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      remaining INTEGER NOT NULL CHECK(remaining >= 0));
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pack TEXT NOT NULL,
      amount INTEGER NOT NULL, credits INTEGER NOT NULL, payment_id TEXT UNIQUE, paid INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS referral_codes (code TEXT PRIMARY KEY, user_id TEXT UNIQUE NOT NULL REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS referrals (referred TEXT PRIMARY KEY REFERENCES users(id), inviter TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, rewarded_at TEXT, payment_id TEXT UNIQUE);
  `);
  state.syaahiDb = connection;
  return connection;
}
// Single-host durable storage. Transactions must contain synchronous work only.
export function transaction<T>(fn: () => T): T {
  db().exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db().exec("COMMIT");
    return result;
  } catch (error) {
    db().exec("ROLLBACK");
    throw error;
  }
}
