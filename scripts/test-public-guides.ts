import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-public-guides-"));
process.env.DATA_BACKEND = "sqlite";
delete process.env.MONGODB_URI;

async function main() {
  const stories = await import("../lib/writing/stories");
  const auth = await import("../lib/auth/server");
  const { publicGuides, publicGuide } = await import("../lib/writing/public");
  const owner = await auth.register(
    "Guide Author",
    "guide@example.test",
    "test-long-password",
  );
  const draft = await stories.saveStory(owner.id, {
    title: "A guide to spaced practice",
    authorName: "Guide Author",
    summary: "Learn with regular retrieval practice.",
    body: "# Recall before rereading\n\nTest yourself on the main concepts, identify mistakes and revisit them in your next practice session. Record your progress honestly.",
    tags: ["study"],
    submit: true,
  });
  assert.equal(
    (await publicGuides()).length,
    0,
    "submitted drafts are private",
  );
  const published = await stories.reviewStory(
    draft.id,
    "publish",
    "Approved for fixture.",
  );
  const safe = publicGuide(published);
  for (const key of [
    "user",
    "reviewNote",
    "versions",
    "moderationEvents",
    "analytics",
  ])
    assert.equal(key in safe, false);
  assert.equal(
    (await publicGuides("slug", published.slug!))[0].title,
    published.title,
  );
  assert.equal(
    (await publicGuides("creator", published.creatorSlug)).length,
    1,
  );
  process.env.APP_ROLE = "frontend";
  process.env.BACKEND_URL = "https://backend.example.test";
  process.env.BACKEND_PROXY_SECRET = "test-only-secret";
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://backend.example.test");
    assert.equal(url.pathname, "/api/publications");
    assert.equal(url.searchParams.get("slug"), published.slug);
    assert.equal(
      new Headers(options?.headers).get("x-syaahi-proxy"),
      "test-only-secret",
    );
    assert.equal(
      options?.cache,
      "no-store",
      "takedowns are not retained in frontend caches",
    );
    return Response.json({ stories: [safe] });
  };
  try {
    assert.equal(
      (await publicGuides("slug", published.slug!))[0].slug,
      published.slug,
    );
    globalThis.fetch = async () => new Response("unavailable", { status: 502 });
    await assert.rejects(
      () => publicGuides("slug", published.slug!),
      /temporarily unavailable/,
    );
  } finally {
    globalThis.fetch = original;
  }
  console.log(
    "PASS: unpublished guides remain private, public payload excludes internal fields, frontend uses backend authentication and reports outages.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
