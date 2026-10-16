import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahii-video-reviews-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  WORKER_MODE: "external",
  APP_ROLE: "all",
});
async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    replica = await (
      await import("mongodb-memory-server")
    ).MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  try {
    const auth = await import("../lib/auth/server"),
      jobs = await import("../lib/jobs/store"),
      video = await import("../lib/youtube/jobs"),
      reviews = await import("../lib/growth/reviews");
    const storage = await import("../lib/workspace-records");
    const { markEmailVerified } = await import("../lib/billing/rewards");
    const user = await auth.register(
        "Fixture learner",
        "video-review@example.test",
        "fixture-only-password",
      ),
      other = await auth.register(
        "Other learner",
        "video-review-other@example.test",
        "fixture-only-password",
      );
    await markEmailVerified(user.id);
    await markEmailVerified(other.id);
    const cookie = (
      await auth.startSession(user, new Request("http://localhost:3188"))
    ).headers
      .get("set-cookie")!
      .split(";")[0];
    const account = (await auth.currentUser(
      new Request("http://localhost:3188", { headers: { cookie } }),
    ))!;
    assert.equal(await reviews.reviewEligibility(account), false);
    await assert.rejects(
      reviews.submitReview(account, {
        stars: 5,
        text: "A useful lesson helped me understand database normalization clearly.",
        consent: true,
      }),
      /complete a lesson/,
    );
    const lesson = await jobs.createJob(user.id, ["Normalization"], "concise");
    assert.equal(lesson.pdfTemplate, "sketchnote");
    const lease = (await jobs.claimJob(lesson.id))!;
    await jobs.commitPage(lesson.id, lease.token, 0, {
      topic: "Normalization",
      markdown:
        "## Normalization\n**Definition:** Reduce redundant data.\n### Example\n- Separate departments from students.\nSummary: Keep each fact in one place.",
      provider: "fixture",
      model: "fixture",
    });
    await jobs.finishJob(lesson.id, lease.token);
    assert.equal(await reviews.reviewEligibility(account), true);
    for (const input of [
      { stars: 6 },
      { stars: 5, consent: false },
      { stars: 5, consent: true, website: "bot" },
      {
        stars: 5,
        consent: true,
        text: "Visit https://spam.test to buy an entirely unrelated product instead.",
      },
    ])
      assert.throws(() =>
        reviews.reviewInput({
          text: "A useful lesson helped me understand database normalization clearly.",
          consent: true,
          ...input,
        }),
      );
    const submitted = await reviews.submitReview(account, {
      stars: 2,
      text: "The outline was useful, but I would like clearer examples for database transactions.",
      consent: true,
    });
    assert.equal((await reviews.publicReviews()).length, 0);
    await assert.rejects(
      reviews.moderateReview(
        submitted.id,
        "publish",
        user.id,
        submitted.revision,
        "Self approval",
      ),
      /Another editor/,
    );
    await assert.rejects(
      reviews.moderateReview(submitted.id, "publish", other.id, 999, "Stale"),
      /changed/,
    );
    const published = await reviews.moderateReview(
      submitted.id,
      "publish",
      other.id,
      submitted.revision,
      "Genuine product feedback; no private details.",
    );
    const projection = (await reviews.publicReviews())[0];
    assert.equal(projection.stars, 2);
    assert(!("owner" in projection));
    assert(!("moderation" in projection));
    assert(!("fingerprint" in projection));
    const edited = await reviews.submitReview(account, {
      stars: 3,
      text: "My revised feedback asks for clearer examples and a faster mobile preview.",
      consent: true,
      revision: published.revision,
    });
    assert.equal(edited.status, "pending");
    assert.equal((await reviews.publicReviews()).length, 0);
    const input = "https://www.youtube.com/watch?v=abcdefghijk";
    const queued = await video.enqueueVideo(user.id, input);
    assert.equal(
      (await video.enqueueVideo(user.id, "https://youtu.be/abcdefghijk")).id,
      queued.id,
    );
    assert.equal(await video.ownedVideo(queued.id, other.id), null);
    await assert.rejects(
      video.enqueueVideo(user.id, "http://127.0.0.1/private"),
      /valid public/,
    );
    const claims = await Promise.all([
      video.claimVideo(queued.id),
      video.claimVideo(queued.id),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    await storage.mutateRecord<any>(queued.id, (old) => ({
      ...old,
      leaseUntil: Date.now() - 1,
    }));
    const recovered = (await video.claimVideo(queued.id))!;
    assert.equal(recovered.attempts, 2);
    assert.notEqual(recovered.lease, claims.find(Boolean)!.lease);
    await storage.mutateRecord<any>(queued.id, (old) => ({
      ...old,
      leaseUntil: 0,
    }));
    let reads = 0;
    await video.processVideo(queued.id, {
      assertAccountActive: async () => {},
      fetchYouTube: async () => {
        reads++;
        return {
          videoId: "abcdefghijk",
          title: "DBMS lecture",
          author: "Fixture",
          durationSeconds: 240,
          transcript:
            "Source-grounded fixture material about database normalization. ".repeat(
              10,
            ),
          transcriptSource: "video-digest",
          transcriptChars: 600,
        } as any;
      },
      assessVideo: async () => ({
        classification: "educational",
        reason: "Teaches normalization",
        topics: ["DBMS"],
      }),
    });
    const done = (await video.ownedVideo(queued.id, user.id))!;
    assert.equal(done.status, "done");
    assert.match(done.result!.warning!, /not a verbatim transcript/);
    await video.processVideo(queued.id);
    assert.equal(reads, 1);
    const failure = await video.enqueueVideo(other.id, input);
    await video.processVideo(failure.id, {
      assertAccountActive: async () => {},
      fetchYouTube: async () => {
        throw new Error("missing captions");
      },
      assessVideo: async () => {
        throw new Error("must not assess missing source");
      },
    });
    const failed = (await video.ownedVideo(failure.id, other.id))!;
    assert.equal(failed.status, "needs_input");
    assert(!failed.result);
    const retry = await video.enqueueVideo(
      other.id,
      "https://youtu.be/lmnopqrstuv",
    );
    await video.processVideo(retry.id, {
      assertAccountActive: async () => {},
      fetchYouTube: async () => done.result as any,
      assessVideo: async () => {
        throw new Error("temporary outage");
      },
    });
    const retrying = (await video.ownedVideo(retry.id, other.id))!;
    assert.equal(retrying.status, "queued");
    assert(retrying.retryAt! > Date.now());
    assert.equal(await video.claimVideo(retry.id), null);
    const pendingA = await video.enqueueVideo(
      user.id,
      "https://youtu.be/11111111111",
    );
    await video.enqueueVideo(user.id, "https://youtu.be/22222222222");
    assert.equal(
      (await video.enqueueVideo(user.id, input)).status,
      "done",
      "Cached extraction is reusable even when two other videos are processing",
    );
    await assert.rejects(
      video.enqueueVideo(user.id, "https://youtu.be/33333333333"),
      /Two lectures/,
    );
    assert.equal(await video.cancelVideo(pendingA.id, other.id), null);
    let releaseSource!: (source: any) => void, entered!: () => void;
    const readingStarted = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const inFlight = video.processVideo(pendingA.id, {
      assertAccountActive: async () => {},
      fetchYouTube: async () => {
        entered();
        return new Promise<any>((resolve) => {
          releaseSource = resolve;
        });
      },
      assessVideo: async () => {
        throw new Error("Cancelled work must not start assessment");
      },
    });
    await readingStarted;
    assert.equal(
      (await video.cancelVideo(pendingA.id, user.id))?.status,
      "cancelled",
    );
    releaseSource(done.result);
    await inFlight;
    assert.equal(
      (await video.ownedVideo(pendingA.id, user.id))?.status,
      "cancelled",
    );
    assert(
      (await video.listOwnedVideos(other.id)).every(
        (item) => item.id !== pendingA.id && !(item as any).result,
      ),
    );
    const route = await import("../app/api/youtube/[id]/route");
    const foreignCookie = (
      await auth.startSession(other, new Request("http://localhost:3188"))
    ).headers
      .get("set-cookie")!
      .split(";")[0];
    assert.equal(
      (
        await route.GET(
          new NextRequest(`http://localhost:3188/api/youtube/${queued.id}`, {
            headers: { cookie: foreignCookie },
          }),
          { params: Promise.resolve({ id: queued.id }) },
        )
      ).status,
      404,
    );
    const admin = await import("../app/api/admin/reviews/route");
    assert.equal(
      (
        await admin.GET(
          new NextRequest("http://localhost:3188/api/admin/reviews", {
            headers: { cookie },
          }),
        )
      ).status,
      403,
    );
    const revoked = await auth.endSession(
      new Request("http://localhost:3188", { headers: { cookie } }),
    );
    assert.match(revoked.headers.get("set-cookie")!, /Max-Age=0/i);
    assert.equal(
      await auth.currentUser(
        new Request("http://localhost:3188", { headers: { cookie } }),
      ),
      null,
    );
    console.log(
      `PASS video/reviews (${process.env.DATA_BACKEND}): owned resumable queue, duplicate jobs, competing leases, worker recovery, digest labels, no fabricated fallback, backoff, verified eligibility, spam validation, moderated negative feedback, consent, private projection, edit re-review, RBAC and session revocation.`,
    );
  } finally {
    if (replica) {
      await (
        await (await import("../lib/storage/mongo")).mongo()
      ).client.close();
      await replica.stop();
    }
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
