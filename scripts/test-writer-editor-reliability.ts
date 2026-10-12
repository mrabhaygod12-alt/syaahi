import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "writer-editor-")),
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
      { enrollWriter } = await import("../lib/writing/profile"),
      { markEmailVerified } = await import("../lib/billing/rewards"),
      stories = await import("../lib/writing/stories"),
      api = await import("../app/api/stories/route"),
      { textDocument } = await import("../lib/writing/document");
    const user = await auth.register(
      "Writer",
      "editor-reliability@example.test",
      "fixture-password-safe",
    );
    await markEmailVerified(user.id);
    await enrollWriter(user);
    const session = await auth.startSession(
      user,
      new Request("http://localhost:3160"),
    );
    const cookie = session.headers.get("set-cookie")!.split(";")[0];
    const post = (data: any) =>
      api.POST(
        new NextRequest("http://localhost:3160/api/stories", {
          method: "POST",
          headers: {
            origin: "http://localhost:3160",
            cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify(data),
        }),
      );
    const data = {
      draftId: randomUUID(),
      title: "Cybersecurity roadmap for university students",
      authorByline: "Chandan Pandey",
      body: "",
      tags: ["Cybersecurity"],
      document: textDocument(
        "Understand networking, operating systems, application security and ethical practice. ".repeat(
          400,
        ),
      ),
      action: "save",
    };
    const results = await Promise.all([post(data), post(data), post(data)]);
    for (const r of results) assert.equal(r.status, 200);
    const saved = (await results[0].json()).story;
    assert.equal(saved.id, data.draftId);
    assert.equal(saved.authorByline, "Chandan Pandey");
    assert.equal(
      (await post({ ...data, authorByline: "A changed retry" })).status,
      409,
    );
    assert.equal(
      (
        await post({
          ...data,
          draftId: randomUUID(),
          authorByline: { name: "Bad type" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post({
          ...data,
          draftId: randomUUID(),
          authorByline: "<script>Invalid</script>",
        })
      ).status,
      400,
    );
    assert.equal(
      (await stories.listStories(user.id)).length,
      1,
      "Lost-response create retries must not duplicate drafts",
    );
    assert.equal(
      (
        await post({
          ...data,
          title: "A different payload must not overwrite the retry",
        })
      ).status,
      409,
    );
    const other = await auth.register(
      "Other",
      "editor-other@example.test",
      "fixture-password-safe",
    );
    await assert.rejects(
      stories.saveStory(other.id, {
        ...data,
        summary: "",
        authorName: other.name,
      }),
      /already saved/,
    );
    const past = new Date(Date.now() - 86400000).toISOString();
    const updated = await stories.saveStory(user.id, {
      ...saved,
      title: "A retained draft even after its requested time",
      expectedUpdatedAt: saved.updatedAt,
      requestedPublishAt: past,
    });
    assert.equal(updated.status, "draft");
    assert.equal(updated.requestedPublishAt, past);
    await assert.rejects(
      stories.saveStory(user.id, {
        ...updated,
        expectedUpdatedAt: updated.updatedAt,
        submit: true,
      }),
      /publication time/,
    );
    const changes = await post({
      id: updated.id,
      expectedUpdatedAt: updated.updatedAt,
      title: updated.title,
      document: data.document,
      tags: [],
      action: "save",
    });
    assert.equal(
      changes.status,
      200,
      "Draft text saves with an expired optional schedule",
    );
    const current = (await changes.json()).story;
    const submitted = await post({
      id: current.id,
      expectedUpdatedAt: current.updatedAt,
      title: current.title,
      document: data.document,
      tags: [],
      requestedPublishAt: null,
      action: "submit",
    });
    assert.equal(submitted.status, 200);
    assert.equal((await submitted.json()).story.status, "submitted");
    assert.equal(
      (
        await post({
          id: current.id,
          expectedUpdatedAt: current.updatedAt,
          title: current.title,
          document: data.document,
          tags: [],
          action: "save",
        })
      ).status,
      409,
    );
    assert.equal(
      (await (await import("../lib/blog-feed")).blogFeed()).entries.some(
        (e) => e.title === current.title,
      ),
      false,
      "Submitted stories must stay out of the public Blog",
    );
    const before = (await stories.ownedStory(user.id, current.id))!;
    const live = await stories.reviewStory(
      before.id,
      "publish",
      "Reviewed fixture",
      "editor-fixture",
      before.updatedAt,
    );
    const feed = await (await import("../lib/blog-feed")).blogFeed();
    assert.equal(
      feed.entries.find((e) => e.slug === live.slug)?.author,
      "Chandan Pandey",
    );
    const pub = await import("../lib/writing/publishing");
    const revision = await pub.beginRevision(user.id, live.id, live.updatedAt);
    const changed = await stories.saveStory(user.id, {
      ...revision,
      authorByline: "",
      expectedUpdatedAt: revision.updatedAt,
      submit: true,
    });
    await stories.reviewStory(
      changed.id,
      "publish",
      "Updated credit",
      "editor-fixture",
      changed.updatedAt,
    );
    assert.equal(
      (await (await import("../lib/blog-feed")).blogFeed()).entries.find(
        (e) => e.slug === live.slug,
      )?.author,
      "Writer",
      "Clearing the byline in an approved revision restores profile credit",
    );
    console.log(
      `PASS editor reliability (${replica ? "MongoDB" : "SQLite"}): 33k-character draft, concurrent retry deduplication, cross-owner isolation, expired schedule saves, clear schedule submission and stale revision rejection.`,
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
