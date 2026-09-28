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
  const published = await stories.reviewStory(created.id, "publish", "Clear and useful.");
  assert.equal(published.status, "published");
  const profile = await stories.listPublicStoriesByCreator(created.creatorSlug);
  assert.equal(profile.length, 1);
  assert.equal(profile[0].authorName, "Ava Learner");
  assert.equal(profile[0].body.includes("focused revision"), true);
  const guide = await stories.getPublicStory(published.slug!);
  assert.equal(guide?.id, published.id);
  assert.equal(await stories.getPublicStory("unpublished-guide"), null);
  console.log("PASS: approved guides create a privacy-preserving public creator profile.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
