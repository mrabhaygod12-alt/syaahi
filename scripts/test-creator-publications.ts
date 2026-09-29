import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-creator-test-"));
process.env.DATA_BACKEND = "sqlite";
delete process.env.MONGODB_URI;

async function main() {
  const auth = await import("../lib/auth/server");
  const stories = await import("../lib/writing/stories");
  const user = await auth.register(
    "Ava Learner",
    "ava@example.test",
    "long-test-password",
  );
  const created = await stories.saveStory(user.id, {
    authorName: "Ava Learner",
    title: "A practical guide to exam revision",
    summary: "A short and useful plan for spaced revision.",
    body: "# Start small\n\nCreate one focused revision block, then review errors before scheduling the next block. Keep the plan realistic and record what worked.",
    tags: ["study skills", "revision"],
    submit: false,
  });
  assert.equal(created.status, "draft");
  assert.match(created.creatorSlug, /^ava-learner-/);
  const revised = await stories.saveStory(user.id, {
    id: created.id,
    authorName: "Ava Learner",
    title: "A practical guide to exam revision",
    summary: "A short and useful plan for spaced revision.",
    body: "# Start small\n\nCreate one focused revision block, then review errors before scheduling the next block. Keep the plan realistic, record what worked, and improve it during the next session.",
    tags: ["study skills", "revision"],
    submit: true,
  });
  assert.equal(revised.status, "submitted");
  assert.equal(revised.versions?.length, 1);
  const published = await stories.reviewStory(
    created.id,
    "publish",
    "Clear and useful.",
  );
  assert.equal(published.status, "published");
  const profile = await stories.listPublicStoriesByCreator(created.creatorSlug);
  assert.equal(profile.length, 1);
  assert.equal(profile[0].authorName, "Ava Learner");
  assert.equal(profile[0].body.includes("focused revision"), true);
  const guide = await stories.getPublicStory(published.slug!);
  assert.equal(guide?.id, published.id);
  const reporter = await auth.register(
    "Noah Reader",
    "noah@example.test",
    "another-long-password",
  );
  const report = await stories.reportPublicStory(
    reporter.id,
    published.slug!,
    "misleading",
    "The worked example needs a clearer source citation before readers rely on it.",
  );
  assert.equal(report.status, "open");
  await assert.rejects(
    () =>
      stories.reportPublicStory(
        reporter.id,
        published.slug!,
        "misleading",
        "This is the same unresolved concern submitted twice.",
      ),
    /already have an open report/,
  );
  const actioned = await stories.resolveContentReport(
    report.id,
    "takedown",
    "moderator-1",
    "Removed while the source citation concern is reviewed.",
  );
  assert.equal(actioned.status, "actioned");
  assert.equal(await stories.getPublicStory(published.slug!), null);
  const restored = await stories.restoreStory(
    published.id,
    "moderator-1",
    "Citation issue resolved after review.",
  );
  assert.equal(restored.status, "published");
  const engagement = await import("../lib/writing/engagement");
  await engagement.setGuideReaction(
    reporter.id,
    published.slug!,
    "upvote",
    true,
  );
  await engagement.setGuideReaction(
    reporter.id,
    published.slug!,
    "bookmark",
    true,
  );
  const tipId = "00000000-0000-4000-8000-000000000001";
  const tipped = await engagement.tipGuideCreator(
    reporter.id,
    published.slug!,
    2,
    tipId,
  );
  const replay = await engagement.tipGuideCreator(
    reporter.id,
    published.slug!,
    2,
    tipId,
  );
  assert.equal(replay.tippedCredits, 2, "Retried request must not debit twice");
  await assert.rejects(
    () => engagement.tipGuideCreator(reporter.id, published.slug!, 3, tipId),
    /already used/,
  );
  assert.equal(tipped.upvotes, 1);
  assert.equal(tipped.bookmarks, 1);
  assert.equal(tipped.tippedCredits, 2);
  await assert.rejects(
    () => engagement.tipGuideCreator(user.id, published.slug!, 1, tipId),
    /cannot tip your own guide/,
  );
  await stories.recordPublicStoryView(published.slug!);
  const analytics = await stories.creatorAnalytics(user.id);
  assert.equal(analytics.published, 1);
  assert.equal(analytics.approximateGuideOpens, 1);
  assert.equal(await stories.getPublicStory("unpublished-guide"), null);
  console.log(
    "PASS: reviewed guides support creator metrics, community reports, takedown, and restoration.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
