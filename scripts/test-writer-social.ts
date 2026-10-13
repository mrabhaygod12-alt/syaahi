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
  const legacy = await register(
    "Legacy reviewed author",
    `${backend}-legacy@example.test`,
    "safe-social-password",
  );
  const legacyDraft = await saveStory(legacy.id, {
    title: "A legacy article with readable structure",
    summary: "Headings and source references stay readable.",
    body: "# Read the evidence\n\nA **careful reader** checks [the original source](https://example.test/source) before repeating a claim.\n\n## Compare sources\n- Keep a citation\n- Verify the method\n\n1. Read\n2. Compare\n\n<script>alert('unsafe')</script>\n\n[Unsafe link](javascript:alert)\n\n```\nconst example = '<img onerror=alert(1)>';\n```",
    tags: ["research"],
    authorName: legacy.name,
    submit: true,
  });
  const { writerProfile, writerAccess } =
      await import("../lib/writing/profile"),
    { publicAuthorIdentity } = await import("../lib/writing/author-identity"),
    { publicCreator } = await import("../lib/writing/public-profile"),
    { readerDocumentText } = await import("../lib/writing/reader-document"),
    { writerConnections } = await import("../lib/writing/connections");
  assert.equal(
    await publicAuthorIdentity(legacyDraft.creatorSlug),
    null,
    "Submission alone does not expose an author identity",
  );
  await assert.rejects(
    () => social.followWriter(reader.id, legacyDraft.creatorSlug, true),
    /unavailable/,
  );
  const legacyArticle = await reviewStory(
    legacyDraft.id,
    "publish",
    "Reviewed fixture",
    author.id,
  );
  const identity = await publicAuthorIdentity(legacyArticle.creatorSlug);
  assert.equal(identity!.owner, legacy.id);
  const publicProfile = await publicCreator(legacyArticle.creatorSlug);
  assert.equal(publicProfile!.name, legacy.name);
  assert(!JSON.stringify(publicProfile).includes(legacy.id));
  assert(!JSON.stringify(publicProfile).includes(legacy.email));
  assert.equal(
    await writerProfile(legacy.id),
    null,
    "Reading/following never creates enrollment",
  );
  assert.equal((await writerAccess(legacy.id))!.status, 403);
  await social.followWriter(author.id, legacyArticle.creatorSlug, true);
  await social.followWriter(author.id, legacyArticle.creatorSlug, true);
  assert.equal(
    (await social.followStatus(legacyArticle.creatorSlug, author.id)).followers,
    1,
  );
  assert.equal(
    (await social.followStatus(legacyArticle.creatorSlug, reader.id)).following,
    false,
  );
  await assert.rejects(
    () => social.followWriter(legacy.id, legacyArticle.creatorSlug, true),
    /own/,
  );
  const followed = await writerConnections(
    author.id,
    "following",
    "",
    author.id,
  );
  assert(followed.writers.some((w) => w.slug === legacyArticle.creatorSlug));
  assert(!JSON.stringify(followed).includes(legacy.id));
  const visibleText = readerDocumentText(undefined, legacyArticle.body);
  assert(
    visibleText.includes(
      "A careful reader checks the original source before repeating a claim.",
    ),
  );
  await social.readerAction(reader.id, legacyArticle.slug!, {
    action: "highlight",
    quote: "careful reader checks the original source",
    note: "Only mine",
  });
  assert.equal(
    (await social.readerState(reader.id, legacyArticle.slug!))!.highlights
      .length,
    1,
  );
  await assert.rejects(
    () =>
      social.readerAction(reader.id, legacyArticle.slug!, {
        action: "highlight",
        quote: "https://example.test/source",
      }),
    /passage/,
    "Hidden Markdown link targets are not selectable prose",
  );
  const { renderToStaticMarkup } = await import("react-dom/server"),
    { createElement } = await import("react"),
    { default: StoryDocument } = await import("../components/StoryDocument");
  const html = renderToStaticMarkup(
    createElement(StoryDocument, { fallback: legacyArticle.body }),
  );
  assert.match(html, /<h2[^>]*>Read the evidence<\/h2>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<ol start="1">/);
  assert.match(html, /<strong>careful reader<\/strong>/);
  assert.match(html, /href="https:\/\/example.test\/source"/);
  assert.doesNotMatch(html, /<script|href="javascript:|<img onerror=/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<pre><code>/);
  const followApi = await import("../app/api/creators/[slug]/follow/route"),
    creatorApi = await import("../app/api/creators/[slug]/route");
  const followContext = {
    params: Promise.resolve({ slug: legacyArticle.creatorSlug }),
  };
  const creatorResponse = await creatorApi.GET(
    new Request("http://localhost:3153/api/creators/x"),
    followContext,
  );
  assert.equal(creatorResponse.status, 200);
  assert(!JSON.stringify(await creatorResponse.json()).includes(legacy.id));
  const authorCookie = (
    await startSession(author, new Request("http://localhost:3153"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const followRequest = (body: unknown) =>
    new NextRequest("http://localhost:3153/api/creators/x/follow", {
      method: "POST",
      headers: {
        cookie: authorCookie,
        origin: "http://localhost:3153",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  for (const body of [null, [], { active: "yes" }])
    assert.equal(
      (await followApi.POST(followRequest(body), followContext)).status,
      400,
    );
  // A failed storage mutation is a retryable service error with a redacted
  // support reference, not a misleading validation error or leaked DB message.
  const { db } = await import("../lib/db"),
    { mongo } = await import("../lib/storage/mongo");
  const configuredUri = process.env.MONGODB_URI;
  if (backend === "mongo") process.env.MONGODB_URI = "";
  else
    db().exec(
      "ALTER TABLE workspace_records RENAME TO unavailable_workspace_records",
    );
  try {
    const unavailable = await followApi.GET(
      new NextRequest("http://localhost:3153/api/creators/x/follow"),
      followContext,
    );
    assert.equal(
      unavailable.status,
      503,
      "A read outage must not pretend that an approved writer does not exist",
    );
    const safe = await unavailable.json();
    assert.match(safe.requestId, /^[a-f0-9-]{36}$/);
    assert.doesNotMatch(
      JSON.stringify(safe),
      /MongoDB|workspace_records|no such table|Atlas/i,
    );
  } finally {
    if (backend === "mongo") process.env.MONGODB_URI = configuredUri;
    else
      db().exec(
        "ALTER TABLE unavailable_workspace_records RENAME TO workspace_records",
      );
  }
  if (backend === "mongo")
    await (
      await mongo()
    ).database.command({
      collMod: "workspace_records",
      validator: { _id: { $exists: false } },
      validationLevel: "strict",
    });
  else
    db().exec(
      "CREATE TRIGGER reject_follow_update BEFORE UPDATE ON workspace_records BEGIN SELECT RAISE(ABORT,'PRIVATE_FOLLOW_STORAGE_FAILURE'); END",
    );
  try {
    const unavailable = await followApi.POST(
      followRequest({ active: false }),
      followContext,
    );
    assert.equal(unavailable.status, 503);
    const safe = await unavailable.json();
    assert.match(safe.requestId, /^[a-f0-9-]{36}$/);
    assert.doesNotMatch(
      JSON.stringify(safe),
      /PRIVATE_FOLLOW|validator|MongoServer|Sqlite/i,
    );
    assert.equal(
      (await social.followStatus(legacyArticle.creatorSlug, author.id))
        .following,
      true,
    );
  } finally {
    if (backend === "mongo")
      await (
        await mongo()
      ).database.command({ collMod: "workspace_records", validator: {} });
    else db().exec("DROP TRIGGER reject_follow_update");
  }
  assert.equal(
    (await followApi.POST(followRequest({ active: false }), followContext))
      .status,
    200,
  );
  assert.equal(
    (await social.followStatus(legacyArticle.creatorSlug, author.id)).followers,
    0,
  );
  const collision = await reviewStory(
    (
      await saveStory(foreign.id, {
        title: "A separately reviewed writer with a conflicting old slug",
        summary: "A synthetic migration conflict must fail closed.",
        body: "An unrelated author owns this article. A slug conflict never transfers follow relationships or permissions. ".repeat(
          3,
        ),
        tags: ["research"],
        authorName: foreign.name,
        submit: true,
      })
    ).id,
    "publish",
    "Reviewed synthetic conflict",
    author.id,
  );
  await (
    await import("../lib/writing/stories")
  ).commitStoryChanges([
    {
      before: collision,
      after: { ...collision, creatorSlug: legacyArticle.creatorSlug },
    },
  ]);
  assert.equal(
    await publicAuthorIdentity(legacyArticle.creatorSlug),
    null,
    "Two approved owners sharing a legacy slug must fail closed",
  );
  await assert.rejects(
    () => social.followWriter(reader.id, legacyArticle.creatorSlug, true),
    /unavailable/,
  );
  await removeStory(collision.id, author.id, "Remove synthetic collision");
  assert.equal(
    (await publicAuthorIdentity(legacyArticle.creatorSlug))!.owner,
    legacy.id,
  );
  await removeStory(legacyArticle.id, author.id, "Removed fixture");
  assert.equal(await publicAuthorIdentity(legacyArticle.creatorSlug), null);
  assert.equal(
    (
      await followApi.GET(
        new NextRequest("http://localhost:3153/api/creators/x/follow"),
        followContext,
      )
    ).status,
    404,
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
    `PASS writer social ${backend}: enrolled and reviewed legacy following without enrollment; idempotence/self and ambiguous-owner guards; typed 400/404 and redacted read/write 503 recovery; safe Markdown and rendered source highlights; account isolation, moderation and removed-story access.`,
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
