import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    replica = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "8.0.12" },
    });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
    process.env.MONGODB_DATABASE = "reward_test";
  } else {
    delete process.env.MONGODB_URI;
    process.env.DATA_BACKEND = "sqlite";
    process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-rewards-"));
  }
  try {
    const { register, startSession } = await import("../lib/auth/server");
    const { balance } = await import("../lib/credits/store");
    const { referralCode, claimReferral } =
      await import("../lib/billing/referrals");
    const { rewardSummary, markEmailVerified, transferRewards } =
      await import("../lib/billing/rewards");
    const { issueVerification, confirmVerification } =
      await import("../lib/auth/verification");
    const owner = await register(
      "Inviter",
      "inviter@example.test",
      "long-test-password",
    );
    const friend = await register(
      "Friend",
      "friend@example.test",
      "long-test-password",
    );
    const google = await register(
      "Google",
      "google@example.test",
      "random-test-password",
      "verified-google-subject",
    );
    assert.equal(await balance(owner.id), 21);
    assert.equal(await balance(google.id), 21);
    await startSession(owner, new Request("https://test.local"));
    await startSession(owner, new Request("https://test.local"));
    assert.equal(await balance(owner.id), 21);
    await assert.rejects(() =>
      register("Duplicate", "inviter@example.test", "long-test-password"),
    );
    assert.equal(await balance(owner.id), 21);
    const code = await referralCode(owner.id);
    await assert.rejects(() => claimReferral(owner.id, code));
    await claimReferral(friend.id, code);
    assert.equal((await rewardSummary(owner.id)).rewardBalance, 0);
    const token = await issueVerification(friend.id);
    await assert.rejects(() => confirmVerification(owner.id, token));
    await assert.rejects(() => confirmVerification(friend.id, "bad"));
    await confirmVerification(friend.id, token);
    await assert.rejects(() => confirmVerification(friend.id, token));
    await markEmailVerified(friend.id);
    await claimReferral(friend.id, code);
    assert.equal((await rewardSummary(owner.id)).rewardBalance, 5);
    assert.equal(await balance(owner.id), 21);
    assert.equal(await balance(friend.id), 21);
    const id = randomUUID();
    await Promise.all([
      transferRewards(owner.id, 5, id),
      transferRewards(owner.id, 5, id),
    ]);
    assert.equal(await balance(owner.id), 26);
    assert.equal((await rewardSummary(owner.id)).rewardBalance, 0);
    await assert.rejects(() => transferRewards(owner.id, 4, id));
    await assert.rejects(() => transferRewards(owner.id, -5, randomUUID()));
    await assert.rejects(() => transferRewards(friend.id, 5, randomUUID()));
    await markEmailVerified(google.id);
    await claimReferral(google.id, code);
    assert.equal((await rewardSummary(owner.id)).rewardBalance, 5);
    const attempts = await Promise.allSettled([
      transferRewards(owner.id, 5, randomUUID()),
      transferRewards(owner.id, 5, randomUUID()),
    ]);
    assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(await balance(owner.id), 31);
    for (let i = 0; i < 19; i++) {
      const u = await register(
        "Member",
        `cap${i}@example.test`,
        "long-test-password",
      );
      await claimReferral(u.id, code);
      await markEmailVerified(u.id);
    }
    assert.equal((await rewardSummary(owner.id)).rewardEarned, 100);
    assert.equal((await rewardSummary(owner.id)).rewardBalance, 90);
    console.log(
      "PASS: " +
        (replica ? "Mongo" : "SQLite") +
        " signup21, login no regrant, duplicate account rollback, verified referral5, verification isolation/replay, Google identity path, atomic transfers and monthly cap.",
    );
  } finally {
    if (replica) {
      const { mongo } = await import("../lib/storage/mongo");
      await (await mongo()).client.close();
      await replica.stop();
    } else {
      const { db } = await import("../lib/db");
      db().close();
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
