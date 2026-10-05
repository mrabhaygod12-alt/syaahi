import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { MongoMemoryReplSet } from "mongodb-memory-server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-social-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";
process.env.SUPABASE_ADMIN_SYNC = "false";
async function run(backend: string) {
  const { register, startSession } = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { enrollWriter } = await import("../lib/writing/profile"),
    { saveStory, reviewStory, removeStory } =
      await import("../lib/writing/stories"),
    social = await import("../lib/writing/social"),
    { mutateRecord } = await import("../lib/workspace-records");
  const author = await register(
      "Writer fixture",
      `${backend}-author@example.test`,
      "safe-social-password",
    ),
    reader = await register(
      "Reader fixture",
      `${backend}-reader@example.test`,
      "safe-social-password",
    ),
    foreign = await register(
      "Foreign fixture",
      `${backend}-foreign@example.test`,
      "safe-social-password",
    );
  await markEmailVerified(author.id);
  await markEmailVerified(reader.id);
  await markEmailVerified(foreign.id);
  const profile = await enrollWriter(author);
  const draft = await saveStory(author.id, {
    title: "Research with clear evidence",
    summary: "A readable fixture article",
    body: "Evidence stays in the source. Read the original before quoting it. ".repeat(
      20,
    ),
    tags: ["research"],
    authorName: profile.name,
    creatorSlug: profile.slug,
    canonicalUrl: "https://example.com/original",
    submit: true,
  });
  const story = await reviewStory(draft.id, "publish", "Reviewed", author.id);
  assert.equal(story.canonicalUrl, "https://example.com/original");
  await social.followWriter(reader.id, profile.slug, true);
  await social.followWriter(reader.id, profile.slug, true);
  assert.equal(
    (await social.followStatus(profile.slug, reader.id)).followers,
    1,
  );
  assert.equal(
    (await social.followStatus(profile.slug, foreign.id)).following,
    false,
  );
  await social.followWriter(reader.id, profile.slug, false);
  assert.equal((await social.followStatus(profile.slug)).followers, 0);
  await assert.rejects(
    () => social.followWriter(author.id, profile.slug, true),
    /own/,
  );
  const event = randomUUID();
  const response = await social.respond(
    reader.id,
    reader.name,
    story.slug!,
    "A useful explanation",
    event,
  );
  await social.respond(
    reader.id,
    reader.name,
    story.slug!,
    "A useful explanation",
    event,
  );
  assert.equal((await social.publicResponses(story.slug!)).length, 1);
  assert(!("owner" in (await social.publicResponses(story.slug!))[0]));
  await assert.rejects(
    () => social.removeResponse(foreign.id, story.slug!, response.id),
    /unavailable/,
  );
  await social.removeResponse(author.id, story.slug!, response.id);
  assert.equal((await social.publicResponses(story.slug!)).length, 0);
  let state = await social.readerAction(reader.id, story.slug!, {
    action: "start",
  });
  await social.readerAction(reader.id, story.slug!, {
    action: "highlight",
    quote: "Evidence stays in the source.",
    note: "Private thought",
  });
  assert.equal(
    (await social.readerState(reader.id, story.slug!))!.highlights.length,
    1,
  );
  assert.equal(await social.readerState(foreign.id, story.slug!), null);
  await assert.rejects(
    () =>
      social.readerAction(reader.id, story.slug!, {
        action: "highlight",
        quote: "Invented passage",
      }),
    /passage/,
  );
  state = await social.readerAction(reader.id, story.slug!, {
    action: "progress",
    fraction: 0.5,
    seconds: 35,
  });
  assert(
    state.seconds < 5,
    "Immediate calls cannot invent elapsed reading time",
  );
  await mutateRecord<typeof state>(state.id, (old) => ({
    ...old!,
    lastPing: Date.now() - 31000,
  }));
  state = await social.readerAction(reader.id, story.slug!, {
    action: "progress",
    fraction: 0.8,
    seconds: 31,
  });
  assert(state.qualified);
  assert.equal((await social.writerReaderStats(author.id)).qualifiedReaders, 1);
  const cookie = (
    await startSession(foreign, new Request("http://localhost:3153"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const route = await import("../app/api/publications/[slug]/reader/route");
  const result = await route.GET(
    new NextRequest("http://localhost:3153/api/publications/x/reader", {
      headers: { cookie },
    }),
    { params: Promise.resolve({ slug: story.slug! }) },
  );
  assert.equal((await result.json()).reader, null);
  const publicRoute =
    await import("../app/api/publications/[slug]/responses/route");
  const projection = await publicRoute.GET(
    new NextRequest("http://localhost:3153/api/publications/x/responses"),
    { params: Promise.resolve({ slug: story.slug! }) },
  );
  assert(!JSON.stringify(await projection.json()).includes("Private thought"));
  await removeStory(story.id, author.id, "Removed fixture");
  await assert.rejects(
    () =>
      social.respond(
        reader.id,
        reader.name,
        story.slug!,
        "New response",
        randomUUID(),
      ),
    /unavailable/,
  );
  console.log(
    `PASS writer social ${backend}: replay-safe following/responses, owner moderation, private source-checked highlights, time-bounded reader stats, canonical persistence, cross-account API isolation and removed-story access.`,
  );
}
async function main() {
  await run("sqlite");
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    process.env.DATA_BACKEND = "mongo";
    process.env.MONGODB_URI = repl.getUri();
    await run("mongo");
  } finally {
    const state = globalThis as any;
    if (state.mongoClient) await (await state.mongoClient).close();
    await repl.stop();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
