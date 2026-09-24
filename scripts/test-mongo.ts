import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
async function main() {
  const replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.12" },
  });
  process.env.MONGODB_URI = replica.getUri();
  process.env.DATA_BACKEND = "mongo";
  process.env.MONGODB_DATABASE = "syaahi_test";
  try {
    const auth = await import("../lib/auth/server");
    const jobs = await import("../lib/jobs/store");
    const { balance, spend } = await import("../lib/credits/store");
    const { saveOrder } = await import("../lib/billing/orders");
    const { capturePayment } = await import("../lib/billing/payments");
    const { referralCode, claimReferral } =
      await import("../lib/billing/referrals");
    const state = await import("../lib/study/state");
    const { mongo } = await import("../lib/storage/mongo");
    const owner = await auth.register(
      "Owner",
      "mongo-owner@example.test",
      "long-test-password",
    );
    const user = await auth.register(
      "Learner",
      "mongo-learner@example.test",
      "long-test-password",
    );
    const response = await auth.startSession(
      user,
      new Request("http://localhost"),
    );
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (
        await auth.currentUser(
          new Request("http://localhost", { headers: { cookie } }),
        )
      )?.id,
      user.id,
    );
    assert.equal(await balance(user.id), 21);
    await spend(user.id, 16);
    const results = await Promise.allSettled([
      jobs.createJob(user.id, ["A", "B", "C"], "concise"),
      jobs.createJob(user.id, ["D", "E", "F"], "concise"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const job = (
      results.find(
        (r) => r.status === "fulfilled",
      ) as PromiseFulfilledResult<any>
    ).value;
    assert.equal(await balance(user.id), 2);
    const claims = await Promise.all([
      jobs.claimJob(job.id),
      jobs.claimJob(job.id),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    const lease = claims.find(Boolean)!;
    await jobs.commitPage(job.id, lease.token, 0, {
      topic: "A",
      markdown: "A saved section.",
      provider: "fixture",
      model: "fixture",
    });
    assert.equal(
      await jobs.commitPage(job.id, lease.token, 0, {
        topic: "A",
        markdown: "Replay.",
        provider: "fixture",
        model: "fixture",
      }),
      false,
    );
    await jobs.finishJob(job.id, lease.token, "Test interruption");
    await jobs.finishJob(job.id, lease.token);
    assert.equal(await balance(user.id), 4);
    assert(await jobs.resumeJob(job.id));
    const next = await jobs.claimJob(job.id);
    assert(next);
    for (let i = 1; i < 3; i++)
      await jobs.commitPage(job.id, next.token, i, {
        topic: "topic",
        markdown: "Completed section.",
        provider: "fixture",
        model: "fixture",
      });
    await jobs.finishJob(job.id, next.token);
    assert.equal((await jobs.getJob(job.id))?.status, "done");
    await claimReferral(user.id, await referralCode(owner.id));
    await saveOrder("order_mongo", user.id, "try", 900, 3);
    const payment = {
      id: "pay_mongo",
      order_id: "order_mongo",
      amount: 900,
      currency: "INR",
      status: "captured",
    };
    await assert.rejects(() => capturePayment({ ...payment, amount: 1 }));
    await Promise.all([
      capturePayment(payment, user.id),
      capturePayment(payment, user.id),
    ]);
    assert.equal(await balance(user.id), 5);
    assert.equal(await balance(owner.id), 21);
    await state.mutateState(user.id, "test", { value: 0 }, (s) => ({
      value: s.value + 1,
    }));
    assert.equal(
      (await state.readState(user.id, "test", { value: 0 })).value,
      1,
    );
    await auth.endSession(
      new Request("http://localhost", { headers: { cookie } }),
    );
    assert.equal(
      await auth.currentUser(
        new Request("http://localhost", { headers: { cookie } }),
      ),
      null,
    );
    console.log(
      "PASS: Mongo replica-set authentication, competing reservations and leases, page replay, refund/restart, payment replay, referral rewards, study state and logout.",
    );
    await (await mongo()).client.close();
  } finally {
    await replica.stop();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
