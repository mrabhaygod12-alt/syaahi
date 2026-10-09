import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { NextRequest } from "next/server";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "writer-connections-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
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
      profiles = await import("../lib/writing/profile"),
      social = await import("../lib/writing/social"),
      stories = await import("../lib/writing/stories"),
      engagement = await import("../lib/writing/engagement"),
      connections = await import("../lib/writing/connections"),
      { mutateRecord } = await import("../lib/workspace-records"),
      { markEmailVerified } = await import("../lib/billing/rewards");
    const author = await auth.register(
        "Public Writer",
        "connections-author@example.test",
        "fixture-password-safe",
      ),
      reader = await auth.register(
        "Reader Writer",
        "connections-reader@example.test",
        "fixture-password-safe",
      ),
      student = await auth.register(
        "Private Student",
        "connections-student@example.test",
        "fixture-password-safe",
      );
    for (const u of [author, reader, student]) await markEmailVerified(u.id);
    let p = await profiles.enrollWriter(author);
    const rp = await profiles.enrollWriter(reader);
    await social.followWriter(reader.id, p.slug, true);
    await social.followWriter(student.id, p.slug, true);
    await social.followWriter(author.id, rp.slug, true);
    assert.deepEqual(await connections.connectionCounts(author.id), {
      followers: 2,
      following: 1,
    });
    await assert.rejects(
      () => connections.writerConnections(author.id, "followers"),
      /private/,
    );
    const own = await connections.writerConnections(
      author.id,
      "followers",
      "",
      author.id,
    );
    assert.deepEqual(
      own.writers.map((w) => w.name),
      [rp.name],
    );
    assert(!JSON.stringify(own).includes(student.name));
    assert(!JSON.stringify(own).includes(reader.email));
    p = await profiles.updateWriterProfile(author.id, {
      showConnections: true,
      expectedUpdatedAt: p.updatedAt,
    });
    const publicList = await connections.writerConnections(
      author.id,
      "followers",
    );
    assert.equal(publicList.publicLists, true);
    assert.equal(publicList.writers.length, 1);
    assert.deepEqual(Object.keys(publicList.writers[0]).sort(), [
      "avatar",
      "bio",
      "name",
      "slug",
    ]);
    await assert.rejects(
      () =>
        profiles.updateWriterProfile(author.id, { showConnections: "true" }),
      /Choose whether/,
    );
    await assert.rejects(
      () => connections.writerConnections(author.id, "followers", "bad"),
      /cursor/,
    );
    // More than 80 recent inactive records cannot hide an older active follow.
    for (let i = 0; i < 83; i++) {
      const recordId = `follow-${createHash("sha256").update(`inactive-${i}`).digest("hex")}`;
      await mutateRecord<any>(recordId, () => ({
        id: recordId,
        owner: author.id,
        kind: "writer-follow",
        creator: `inactive-${i}`,
        slug: `inactive-${i}`,
        name: "Inactive",
        active: false,
        updatedAt: new Date(Date.now() + i + 1000).toISOString(),
      }));
    }
    assert.equal((await social.following(author.id)).length, 1);
    // Private student identities are filtered before pagination, not after its limit.
    for (let i = 0; i < 31; i++) {
      const recordId = `follow-${createHash("sha256").update(`student-${i}`).digest("hex")}`;
      await mutateRecord<any>(recordId, () => ({
        id: recordId,
        owner: `private-student-${i}`,
        kind: "writer-follow",
        creator: author.id,
        slug: p.slug,
        name: "Private fixture",
        active: true,
        updatedAt: new Date(Date.now() + i + 2000).toISOString(),
      }));
    }
    const first = await connections.writerConnections(
      author.id,
      "followers",
      "",
      author.id,
    );
    assert.equal(first.nextCursor, null);
    assert.equal(first.writers[0].slug, rp.slug);
    for (let i = 0; i < 31; i++) {
      const fixture = await auth.register(
        `Visible Writer ${i}`,
        `visible-writer-${i}@example.test`,
        "fixture-password-safe",
      );
      await markEmailVerified(fixture.id);
      await profiles.enrollWriter(fixture);
      await social.followWriter(fixture.id, p.slug, true);
    }
    const pageOne = await connections.writerConnections(
      author.id,
      "followers",
      "",
      author.id,
    );
    assert.equal(pageOne.writers.length, 30);
    assert(pageOne.nextCursor);
    const next = await connections.writerConnections(
      author.id,
      "followers",
      pageOne.nextCursor!,
      author.id,
    );
    assert.equal(next.writers.length, 2);
    assert(
      !next.writers.some((w) =>
        pageOne.writers.some((previous) => previous.slug === w.slug),
      ),
    );
    const draft = await stories.saveStory(author.id, {
      title: "Clear evidence for university readers",
      summary: "A source-aware guide",
      body: "Use sources responsibly and verify every claim before making a decision. ".repeat(
        5,
      ),
      tags: ["research"],
      authorName: p.name,
      creatorSlug: p.slug,
      submit: true,
    });
    const story = await stories.reviewStory(
      draft.id,
      "publish",
      "Fixture reviewed",
      author.id,
    );
    await engagement.setGuideReaction(reader.id, story.slug!, "upvote", true);
    await engagement.setGuideReaction(reader.id, story.slug!, "upvote", true);
    await stories.recordPublicStoryView(story.slug!);
    const comment = await social.respond(
      reader.id,
      reader.name,
      story.slug!,
      "A useful worked example.",
      randomUUID(),
    );
    const activity = (
      await (
        await import("../lib/writing/activity")
      ).storyActivities([(await stories.getPublicStory(story.slug!))!])
    ).get(story.id)!;
    assert.deepEqual(activity, { likes: 1, comments: 1, views: 1 });
    assert.equal(
      (await engagement.guideEngagement(story.slug!, author.id)).viewer
        ?.ownStoryId,
      story.id,
    );
    assert.equal(
      (await engagement.guideEngagement(story.slug!, reader.id)).viewer
        ?.ownStoryId,
      undefined,
    );
    await social.removeResponse(author.id, story.slug!, comment.id);
    assert.equal((await engagement.guideEngagement(story.slug!)).comments, 0);
    const publicDTO = (
      await (
        await import("../lib/writing/public")
      ).publicStoryViews([(await stories.getPublicStory(story.slug!))!])
    )[0];
    assert.equal(publicDTO.activity?.likes, 1);
    assert(!("user" in publicDTO));
    assert(!("id" in publicDTO));
    const route = await import("../app/api/writer/connections/route");
    assert.equal(
      (
        await route.GET(
          new NextRequest("http://localhost/api/writer/connections"),
        )
      ).status,
      401,
    );
    const cookie = (
      await auth.startSession(author, new Request("http://localhost"))
    ).headers
      .get("set-cookie")!
      .split(";")[0];
    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/writer/connections?mode=following&owner=" +
          reader.id,
        { headers: { cookie } },
      ),
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.writers[0].slug, rp.slug);
    p = await profiles.updateWriterProfile(author.id, {
      showConnections: false,
      expectedUpdatedAt: p.updatedAt,
    });
    const publicRoute =
      await import("../app/api/creators/[slug]/connections/route");
    assert.equal(
      (
        await publicRoute.GET(
          new NextRequest("http://localhost/api/creators/x/connections"),
          { params: Promise.resolve({ slug: p.slug }) },
        )
      ).status,
      403,
    );
    await stories.removeStory(story.id, author.id, "Fixture removed");
    assert.equal(
      (
        await (
          await import("../lib/writing/activity")
        ).storyActivities([(await stories.getStoryById(story.id))!])
      ).size,
      0,
    );
    console.log(
      `PASS writer connections/activity (${replica ? "MongoDB" : "SQLite"}): private default and explicit public opt-in, student identity redaction, owner-only paginated cursors, inactive follow filtering, real likes/comments/views, removed-comment exclusion and author-only story controls.`,
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
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
