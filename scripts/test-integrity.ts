import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-ledger-test-"));
async function main() {
  const { register, passwordMatches, passwordHash } =
    await import("../lib/auth/server");
  const { db } = await import("../lib/db");
  const {
    createJob,
    claimJob,
    commitPage,
    finishJob,
    resumeJob,
    getJob,
    deleteJob,
  } = await import("../lib/jobs/store");
  const { capturePayment, verifySignature } =
    await import("../lib/billing/payments");
  const { createHmac } = await import("node:crypto");
  const user = await register(
    "Test Learner",
    "ledger@example.test",
    "test-password-123",
  );
  const balance = () =>
    Number(
      db().prepare("SELECT balance FROM wallets WHERE user_id=?").get(user.id)
        ?.balance,
    );
  assert.equal(balance(), 5);
  assert(passwordMatches("secret", passwordHash("secret")));
  assert(!passwordMatches("wrong", passwordHash("secret")));
  const results = await Promise.allSettled([
    createJob(user.id, ["A", "B", "C"], "detailed"),
    createJob(user.id, ["D", "E", "F"], "detailed"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(balance(), 2);
  const job = (
    results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>
  ).value;
  const lease = (await claimJob(job.id))!;
  assert(lease);
  assert.equal(await claimJob(job.id), null);
  await assert.rejects(
    async () =>
      await commitPage(job.id, "wrong", 0, {
        topic: "A",
        markdown: "content",
        provider: "test",
        model: "test",
      }),
  );
  assert.equal(
    await commitPage(job.id, lease.token, 0, {
      topic: "A",
      markdown: "content",
      provider: "test",
      model: "test",
    }),
    true,
  );
  assert.equal(
    await commitPage(job.id, lease.token, 0, {
      topic: "A",
      markdown: "duplicate",
      provider: "test",
      model: "test",
    }),
    false,
  );
  await finishJob(job.id, lease.token, "provider unavailable");
  assert.equal(balance(), 4);
  await finishJob(job.id, lease.token);
  assert.equal(balance(), 4);
  assert(await resumeJob(job.id));
  assert.equal(balance(), 2);
  const second = (await claimJob(job.id))!;
  await commitPage(job.id, second.token, 1, {
    topic: "B",
    markdown: "content",
    provider: "test",
    model: "test",
  });
  await commitPage(job.id, second.token, 2, {
    topic: "C",
    markdown: "content",
    provider: "test",
    model: "test",
  });
  await finishJob(job.id, second.token);
  assert.equal((await getJob(job.id))?.status, "done");
  assert.equal(balance(), 2);
  db()
    .prepare(
      "INSERT INTO orders (id,user_id,pack,amount,credits) VALUES (?,?,?,?,?)",
    )
    .run("order_test", user.id, "starter", 1900, 2);
  const payment = {
    id: "pay_test",
    order_id: "order_test",
    amount: 1900,
    currency: "INR",
    status: "captured",
  };
  await assert.rejects(
    async () => await capturePayment({ ...payment, amount: 1 }),
  );
  await assert.rejects(async () => await capturePayment(payment, "other-user"));
  assert.equal(await capturePayment(payment, user.id), 4);
  assert.equal(await capturePayment(payment, user.id), 4);
  await assert.rejects(
    async () => await capturePayment({ ...payment, id: "pay_other" }),
  );
  const sig = createHmac("sha256", "secret").update("body").digest("hex");
  assert(verifySignature("body", sig, "secret"));
  assert(!verifySignature("tampered", sig, "secret"));
  assert(await deleteJob(job.id));
  assert.equal(await getJob(job.id), null);
  console.log(
    "PASS: 23 assertions covering reservations, competing jobs, lease ownership, page replay, refunds, resume, payment identity/replay, signatures, and deletion.",
  );
  db().close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
