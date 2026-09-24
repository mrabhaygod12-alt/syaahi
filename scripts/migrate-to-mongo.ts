import { loadEnvConfig } from "@next/env";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { mongo, mongoTransaction } from "../lib/storage/mongo";
loadEnvConfig(process.cwd());
async function main() {
  const source = new DatabaseSync(
    join(process.env.DATA_DIR || join(process.cwd(), "data"), "syaahi.sqlite"),
    { readOnly: true },
  );
  const rows = (table: string) => {
    const exists = source
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);
    return exists ? source.prepare(`SELECT * FROM ${table}`).all() : [];
  };
  source.exec("BEGIN");
  const sets: Record<string, any[]> = {
    verified_accounts: rows("verified_accounts").map((r) => ({
      _id: r.user_id,
      verifiedAt: new Date(String(r.verified_at)),
    })),
    reward_wallets: rows("reward_wallets").map((r) => ({
      _id: r.user_id,
      balance: r.balance,
      earned: r.earned,
      month: r.month,
      count: r.count,
    })),
    reward_events: rows("reward_events").map((r) => ({
      _id: r.id,
      user: r.user_id,
      credits: r.credits,
      createdAt: new Date(String(r.created_at)),
    })),
    reward_transfers: rows("reward_transfers").map((r) => ({
      _id: r.id,
      user: r.user_id,
      credits: r.credits,
      createdAt: new Date(String(r.created_at)),
    })),
    email_verification: rows("email_verification").map((r) => ({
      _id: r.user_id,
      tokenHash: r.token_hash,
      expires: r.expires,
    })),
    support_index: rows("support_index").map((r) => ({
      _id: r.id,
      ...JSON.parse(String(r.payload)),
    })),
    users: rows("users").map((r) => ({
      _id: r.id,
      id: r.id,
      email: r.email,
      name: r.name,
      password: r.password,
      createdAt: r.created_at,
    })),
    wallets: rows("wallets").map((r) => ({
      _id: r.user_id,
      balance: r.balance,
    })),
    ledger: rows("ledger").map((r) => ({
      _id: r.id,
      user: r.user_id,
      delta: r.delta,
      reason: r.reason,
      createdAt: new Date(String(r.created_at)),
    })),
    sessions: rows("sessions").map((r) => ({
      _id: r.token_hash,
      user: r.user_id,
      expiresAt: new Date(Number(r.expires)),
    })),
    jobs: rows("jobs").map((r) => ({
      _id: r.id,
      ...JSON.parse(String(r.payload)),
      leaseUntil: 0,
    })),
    reservations: rows("reservations").map((r) => ({
      _id: r.job_id,
      user: r.user_id,
      remaining: r.remaining,
    })),
    orders: rows("orders").map((r) => ({
      _id: r.id,
      user: r.user_id,
      pack: r.pack,
      amount: r.amount,
      credits: r.credits,
      paid: !!r.paid,
      ...(r.payment_id ? { paymentId: r.payment_id } : {}),
    })),
    study_state: rows("study_state").map((r) => ({
      _id: r.id,
      owner: r.owner,
      payload: JSON.parse(String(r.payload)),
    })),
    oauth_identities: rows("oauth_identities").map((r) => ({
      _id: r.subject,
      user: r.user_id,
    })),
    referral_codes: rows("referral_codes").map((r) => ({
      _id: r.user_id,
      code: r.code,
    })),
    referrals: rows("referrals").map((r) => ({
      _id: r.referred,
      referred: r.referred,
      inviter: r.inviter,
      createdAt: new Date(String(r.created_at)),
      rewardedAt: r.rewarded_at ? new Date(String(r.rewarded_at)) : null,
      ...(r.payment_id ? { paymentId: r.payment_id } : {}),
    })),
  };
  source.exec("COMMIT");
  source.close();
  console.log(
    "Source snapshot counts:",
    Object.fromEntries(
      Object.entries(sets).map(([name, docs]) => [name, docs.length]),
    ),
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      "Dry run only. Stop source writers, take a backup, then use --apply against an empty target.",
    );
    return;
  }
  if (!process.argv.includes("--source-stopped"))
    throw new Error(
      "Stop source API/workers and add --source-stopped to acknowledge the migration maintenance window.",
    );
  await mongoTransaction(async (d, session) => {
    for (const [name, docs] of Object.entries(sets)) {
      const c = d.collection<any>(name);
      if (await c.countDocuments({}, { session }))
        throw new Error(`Target ${name} is not empty; refusing to overwrite.`);
      if (docs.length) await c.insertMany(docs, { session });
    }
  });
  console.log(
    "Migration committed. Keep the source backup; do not restart source writers.",
  );
  await (await mongo()).client.close();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Migration failed.");
  process.exit(1);
});
