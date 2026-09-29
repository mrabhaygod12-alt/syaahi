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
    const unverifiedSession = await auth.startSession(
      user,
      new Request("http://localhost"),
    );
    const unverifiedCookie = unverifiedSession.headers
      .get("set-cookie")!
      .split(";")[0];
    assert.equal(
      await auth.currentUser(
        new Request("http://localhost", {
          headers: { cookie: unverifiedCookie },
        }),
      ),
      null,
      "unverified users cannot authenticate with a session cookie",
    );
    assert.equal(
      await (await mongo()).database.collection("sessions").countDocuments({
        user: user.id,
      }),
      0,
    );
    const { markEmailVerified } = await import("../lib/billing/rewards");
    await markEmailVerified(user.id);
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
    assert.equal(await balance(user.id), 19);
    await spend(user.id, 14);
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
    assert.equal(await balance(owner.id), 19);
    await state.mutateState(user.id, "test", { value: 0 }, (s) => ({
      value: s.value + 1,
    }));
    assert.equal(
      (await state.readState(user.id, "test", { value: 0 })).value,
      1,
    );
    const stories = await import("../lib/writing/stories");
    const engagement = await import("../lib/writing/engagement");
    const draft = await stories.saveStory(owner.id, {
      authorName: "Owner",
      title: "Mongo study guide regression",
      summary: "A practical revision guide for students.",
      body: "# Review your mistakes\n\nKeep a short record of incorrect answers and practise the underlying concept again. Review your record after each focused study session.",
      tags: ["revision"],
      submit: true,
    });
    const published = await stories.reviewStory(
      draft.id,
      "publish",
      "Reviewed for test publication.",
    );
    await engagement.setGuideReaction(user.id, published.slug!, "upvote", true);
    const bookmarked = await engagement.setGuideReaction(
      user.id,
      published.slug!,
      "bookmark",
      true,
    );
    assert.equal(bookmarked.viewer?.upvoted, true);
    assert.equal(bookmarked.viewer?.bookmarked, true);
    const requestId = "01900000-0000-4000-8000-000000000001";
    await Promise.all([
      engagement.tipGuideCreator(user.id, published.slug!, 1, requestId),
      engagement.tipGuideCreator(user.id, published.slug!, 1, requestId),
    ]);
    assert.equal(
      await balance(user.id),
      4,
      "concurrent tip replay debits only once",
    );
    assert.equal(await balance(owner.id), 20);
    await assert.rejects(() =>
      engagement.tipGuideCreator(user.id, published.slug!, 2, requestId),
    );
    const docs = await import("../lib/documents/store");
    const textbook = await docs.saveDocument(user.id, "Test.pdf", 1, [
      { num: 1, text: "Dijkstra shortest path algorithm" },
    ]);
    assert.equal(await docs.getDocument(owner.id, textbook.id), null);
    assert.equal(
      (await docs.documentEvidence(user.id, textbook.id, "Dijkstra")).matches
        .length,
      1,
    );
    assert.equal(await docs.deleteDocument(user.id, textbook.id), true);
    assert.equal(await docs.getDocument(user.id, textbook.id), null);
    const vectorBook = await docs.saveDocument(
      user.id,
      "Vector.pdf",
      17,
      Array.from({ length: 17 }, (_, i) => ({
        num: i + 1,
        text: `Chapter ${i + 1} Dijkstra paths`,
      })),
    );
    process.env.QDRANT_URL = "https://vectors.example.test";
    process.env.GEMINI_EMBEDDING_API_KEY = "test-only-embedding-key";
    const originalFetch = globalThis.fetch;
    let indexedPoints = 0,
      deletedVectors = false;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.hostname === "generativelanguage.googleapis.com")
        return Response.json({
          embeddings: body.requests.map(() => ({
            values: Array(768).fill(0.01),
          })),
        });
      assert.equal(
        url.hostname,
        "vectors.example.test",
        "no unintended external calls",
      );
      if (url.pathname.endsWith("/points")) {
        indexedPoints += body.points.length;
        assert.equal(body.points[0].payload.owner, user.id);
        assert.equal(body.points[0].payload.text, undefined);
      }
      if (url.pathname.endsWith("/points/query")) {
        assert.deepEqual(body.filter.must, [
          { key: "owner", match: { value: user.id } },
          { key: "documentId", match: { value: vectorBook.id } },
          { key: "page", range: { gte: 2, lte: 5 } },
        ]);
        return Response.json({
          result: {
            points: [
              { payload: { chunkId: "P3C1" } },
              { payload: { chunkId: "foreign-chunk" } },
            ],
          },
        });
      }
      if (url.pathname.endsWith("/points/delete")) {
        assert.equal(body.filter.must[0].match.value, user.id);
        deletedVectors = true;
      }
      return Response.json({ result: {} });
    };
    try {
      const vectors = await import("../lib/documents/vectors");
      await vectors.indexDocumentBatch();
      assert.equal(
        (await docs.getDocument(user.id, vectorBook.id))?.vectorOffset,
        16,
      );
      await vectors.indexDocumentBatch();
      assert.equal(indexedPoints, 17);
      assert.equal(
        (await docs.getDocument(user.id, vectorBook.id))?.vectorReady,
        true,
      );
      const hybrid = await docs.documentEvidence(
        user.id,
        vectorBook.id,
        "different terminology",
        { from: 2, to: 5 },
      );
      assert.equal(hybrid.method, "BM25 + semantic retrieval");
      assert.deepEqual(
        hybrid.matches.map((chunk) => chunk.id),
        ["P3C1"],
      );
      await docs.deleteDocument(user.id, vectorBook.id);
      await (
        await mongo()
      ).database
        .collection("study_documents")
        .updateOne(
          { _id: vectorBook.id as any },
          { $set: { deletedAt: Date.now() - 180000 } },
        );
      await vectors.indexDocumentBatch();
      assert.equal(deletedVectors, true);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.QDRANT_URL;
      delete process.env.GEMINI_EMBEDDING_API_KEY;
    }
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
