import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-referrals-"));
async function main() {
  const { register } = await import("../lib/auth/server");
  const { db } = await import("../lib/db");
  const { referralCode, claimReferral } =
    await import("../lib/billing/referrals");
  const { capturePayment } = await import("../lib/billing/payments");
  const inviter = await register(
      "Inviter",
      "inviter@example.test",
      "long-test-password",
    ),
    friend = await register(
      "Friend",
      "friend@example.test",
      "long-test-password",
    );
  const code = await referralCode(inviter.id);
  assert.equal(code, await referralCode(inviter.id));
  await assert.rejects(async () => await claimReferral(inviter.id, code));
  await claimReferral(friend.id, code);
  await claimReferral(friend.id, code);
  const balance = (id: string) =>
    Number(
      db().prepare("SELECT balance FROM wallets WHERE user_id=?").get(id)
        ?.balance,
    );
  assert.equal(balance(inviter.id), 21);
  db()
    .prepare(
      "INSERT INTO orders (id,user_id,pack,amount,credits) VALUES (?,?,?,?,?)",
    )
    .run("referral-order", friend.id, "try", 900, 3);
  const payment = {
    id: "referral-payment",
    order_id: "referral-order",
    amount: 900,
    currency: "INR",
    status: "captured",
  };
  await assert.rejects(
    async () => await capturePayment({ ...payment, amount: 1 }),
  );
  await capturePayment(payment, friend.id);
  assert.equal(balance(inviter.id), 21);
  assert.equal(balance(friend.id), 24);
  await capturePayment(payment, friend.id);
  assert.equal(balance(inviter.id), 21);
  assert.equal(balance(friend.id), 24);
  assert.equal(
    db()
      .prepare(
        "SELECT COUNT(*) AS n FROM ledger WHERE reason='Referral reward: one token'",
      )
      .get()?.n,
    0,
  );
  console.log(
    "PASS: referral eligibility, self-referral rejection, verified capture, no signup reward on payment alone, payment replay protection.",
  );
  db().close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
