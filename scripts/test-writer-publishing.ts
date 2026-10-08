import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "writer-publishing-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  ADMIN_EMAILS: "publishing-editor@example.test",
  ADMIN_MFA_ENFORCE: "0",
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
      { markEmailVerified } = await import("../lib/billing/rewards"),
      { enrollWriter } = await import("../lib/writing/profile"),
      stories = await import("../lib/writing/stories"),
      publishing = await import("../lib/writing/publishing"),
      { textDocument } = await import("../lib/writing/document");
    const author = await auth.register(
        "Writer",
        "publishing-writer@example.test",
        "fixture-password-safe",
      ),
      other = await auth.register(
        "Other Writer",
        "publishing-other@example.test",
        "fixture-password-safe",
      ),
      editor = await auth.register(
        "Editor",
        "publishing-editor@example.test",
        "fixture-password-safe",
      );
    for (const u of [author, other, editor]) {
      await markEmailVerified(u.id);
      await enrollWriter(u);
    }
    const body =
      "Functional dependencies explain how attributes determine one another. A database normalization example must preserve a lossless reconstruction and avoid redundant data.";
    const create = (extra: any = {}) =>
      stories.saveStory(author.id, {
        title: "Database design for university students",
        summary: "A practical normalization guide.",
        body,
        document: textDocument(body),
        tags: ["databases"],
        authorName: author.name,
        submit: true,
        ...extra,
      });
    const submit = await create(),
      reviews = await Promise.allSettled([
        stories.reviewStory(
          submit.id,
          "publish",
          "Reviewed",
          editor.id,
          submit.updatedAt,
        ),
        stories.reviewStory(
          submit.id,
          "changes",
          "Add more examples",
          editor.id,
          submit.updatedAt,
        ),
      ]);
    assert.equal(
      reviews.filter((r) => r.status === "fulfilled").length,
      1,
      "One concurrent editorial decision must win",
    );
    let parent = (await stories.ownedStory(author.id, submit.id))!;
    if (parent.status !== "published") {
      parent = await stories.saveStory(author.id, {
        ...parent,
        expectedUpdatedAt: parent.updatedAt,
        submit: true,
      });
      parent = await stories.reviewStory(
        parent.id,
        "publish",
        "Reviewed",
        editor.id,
      );
    }
    const slug = parent.slug!,
      firstDate = parent.publishedAt;
    await assert.rejects(
      () => publishing.beginRevision(other.id, parent.id, parent.updatedAt),
      /not found/,
    );
    await assert.rejects(
      () => publishing.beginRevision(author.id, parent.id, "old-version"),
      /changed/,
    );
    const revisions = await Promise.allSettled([
      publishing.beginRevision(author.id, parent.id, parent.updatedAt),
      publishing.beginRevision(author.id, parent.id, parent.updatedAt),
    ]);
    const opened = revisions.filter(
      (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled",
    );
    assert(opened.length >= 1, revisions.map(r => r.status === "rejected" ? String(r.reason) : "ok").join("; "));
    assert.equal(
      new Set(opened.map((r) => r.value.id)).size,
      1,
      "Retries may return the same pending revision",
    );
    let revision = opened[0].value;
    parent = (await stories.ownedStory(author.id, parent.id))!;
    await assert.rejects(
      () => publishing.unpublishStory(author.id, parent.id, parent.updatedAt),
      /pending revision/,
    );
    assert.equal((await stories.getPublicStory(slug))!.body, body);
    revision = await stories.saveStory(author.id, {
      ...revision,
      title: "A clearer normalization explanation",
      body: body + " The new worked example is still private.",
      document: textDocument(
        body + " The new worked example is still private.",
      ),
      expectedUpdatedAt: revision.updatedAt,
      submit: true,
    });
    assert.equal(
      (await stories.getPublicStory(slug))!.title,
      parent.title,
      "Submitted revision must not replace live content",
    );
    const result = await stories.reviewStory(
      revision.id,
      "publish",
      "Revision reviewed",
      editor.id,
      revision.updatedAt,
    );
    assert.equal(result.status, "archived");
    parent = (await stories.ownedStory(author.id, parent.id))!;
    assert.equal(parent.title, revision.title);
    assert.equal(parent.slug, slug);
    assert.equal(parent.publishedAt, firstDate);
    assert.equal(parent.pendingRevisionId, null);
    await Promise.all(
      Array.from({ length: 8 }, () => stories.recordPublicStoryView(slug)),
    );
    assert.equal(
      (await stories.getPublicStory(slug))!.analytics!.views,
      8,
      "Analytics increments must not overwrite each other",
    );
    parent = (await stories.ownedStory(author.id, parent.id))!;
    await Promise.all([
      publishing.unpublishStory(author.id, parent.id, parent.updatedAt),
      stories.recordPublicStoryView(slug),
    ]);
    assert.equal(
      await stories.getPublicStory(slug),
      null,
      "A concurrent page view must not resurrect an unpublished article",
    );
    parent = (await stories.ownedStory(author.id, parent.id))!;
    revision = await publishing.beginRevision(
      author.id,
      parent.id,
      parent.updatedAt,
    );
    await stories.deleteDraft(author.id, revision.id);
    parent = (await stories.ownedStory(author.id, parent.id))!;
    assert.equal(parent.pendingRevisionId, null);
    revision = await publishing.beginRevision(
      author.id,
      parent.id,
      parent.updatedAt,
    );
    revision = await stories.saveStory(author.id, {
      ...revision,
      expectedUpdatedAt: revision.updatedAt,
      submit: true,
    });
    await stories.reviewStory(
      revision.id,
      "publish",
      "Republish reviewed",
      editor.id,
    );
    assert.equal((await stories.getPublicStory(slug))!.slug, slug);
    const future = Date.now() + 120000;
    let scheduled = await create({
      requestedPublishAt: new Date(future).toISOString(),
    });
    assert.equal(
      (await publishing.publishDueStories(future + 1)).published,
      0,
      "Unreviewed requests never execute",
    );
    scheduled = await stories.reviewStory(
      scheduled.id,
      "publish",
      "Approved schedule",
      editor.id,
      scheduled.updatedAt,
    );
    assert.equal(scheduled.status, "scheduled");
    assert.equal(scheduled.slug, null);
    assert.equal((await publishing.publishDueStories(future - 1)).published, 0);
    const executed = await Promise.all([
      publishing.publishDueStories(future + 1),
      publishing.publishDueStories(future + 1),
    ]);
    assert.equal(
      executed.reduce((sum, r) => sum + r.published, 0),
      1,
      "Workers must publish once",
    );
    assert.equal(
      (await stories.ownedStory(author.id, scheduled.id))!.status,
      "published",
    );
    let cancelled = await create({
      requestedPublishAt: new Date(future).toISOString(),
    });
    cancelled = await stories.reviewStory(
      cancelled.id,
      "publish",
      "Approved",
      editor.id,
    );
    await assert.rejects(
      () =>
        publishing.cancelStorySchedule(
          other.id,
          cancelled.id,
          cancelled.updatedAt,
        ),
      /not found/,
    );
    cancelled = await publishing.cancelStorySchedule(
      author.id,
      cancelled.id,
      cancelled.updatedAt,
    );
    assert.equal(cancelled.status, "draft");
    assert.equal(cancelled.reviewedAt, null);
    assert.equal((await publishing.publishDueStories(future + 1)).published, 0);
    parent = (await stories.ownedStory(author.id, parent.id))!;
    revision = await publishing.beginRevision(
      author.id,
      parent.id,
      parent.updatedAt,
    );
    revision = await stories.saveStory(author.id, {
      ...revision,
      expectedUpdatedAt: revision.updatedAt,
      submit: true,
      requestedPublishAt: new Date(future).toISOString(),
    });
    revision = await stories.reviewStory(
      revision.id,
      "publish",
      "Approved revision schedule",
      editor.id,
    );
    await stories.removeStory(
      parent.id,
      editor.id,
      "Removed due to verified content concern.",
    );
    await publishing.publishDueStories(future + 1);
    assert.equal(await stories.getPublicStory(slug), null);
    assert.equal(
      (await stories.ownedStory(author.id, revision.id))!.status,
      "changes_requested",
      "A schedule cannot bypass later moderation",
    );
    await assert.rejects(
      () => create({ requestedPublishAt: "not-a-time" }),
      /Choose a publication time/,
    );
    const api = await import("../app/api/writer/publishing/route"),
      cookie = (
        await auth.startSession(other, new Request("https://www.syaahii.in"))
      ).headers
        .get("set-cookie")!
        .split(";")[0];
    const denied = await api.POST(
      new NextRequest("https://www.syaahii.in/api/writer/publishing", {
        method: "POST",
        headers: {
          cookie,
          origin: "https://www.syaahii.in",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: parent.id,
          expectedUpdatedAt: parent.updatedAt,
          action: "unpublish",
        }),
      }),
    );
    assert.equal(denied.status, 404);
    console.log(
      `PASS writer publishing (${replica ? "MongoDB" : "SQLite"}): private revision/approval, stable URL, concurrent review and workers, withdrawal, schedule cancellation, moderation protection, exact analytics increments and owner-only API.`,
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
