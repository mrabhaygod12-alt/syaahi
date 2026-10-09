import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "writer-moderation-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  ADMIN_EMAILS: "moderation-editor@example.test",
  ADMIN_MFA_ENFORCE: "0",
  APP_ORIGIN: "https://www.syaahii.in",
  WORKER_MODE: "external",
});

async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    replica = await (
      await import("mongodb-memory-server")
    ).MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  try {
    const auth = await import("../lib/auth/server"),
      stories = await import("../lib/writing/stories"),
      { markEmailVerified } = await import("../lib/billing/rewards"),
      { enrollWriter } = await import("../lib/writing/profile"),
      { db } = await import("../lib/db"),
      { mongo } = await import("../lib/storage/mongo");
    const author = await auth.register(
        "Writer",
        "moderation-author@example.test",
        "fixture-password-safe",
      ),
      reader = await auth.register(
        "Reader",
        "moderation-reader@example.test",
        "fixture-password-safe",
      ),
      editor = await auth.register(
        "Editor",
        "moderation-editor@example.test",
        "fixture-password-safe",
      );
    for (const u of [author, reader, editor]) {
      await markEmailVerified(u.id);
      await enrollWriter(u);
    }
    let sequence = 0;
    const prepare = async () => {
      const draft = await stories.saveStory(author.id, {
        title: `Evidence for a university research project ${++sequence}`,
        summary: "A practical introduction to evaluating research sources.",
        body: "Check the source, examine the method, and compare the conclusion with independent evidence. A reproducible example makes the research easier to evaluate.",
        tags: ["research"],
        authorName: author.name,
        submit: true,
      });
      const story = await stories.reviewStory(
        draft.id,
        "publish",
        "Reviewed fixture.",
        editor.id,
      );
      const report = await stories.reportPublicStory(
        reader.id,
        story.slug!,
        "misleading",
        "The evidence in this example needs a clearer source citation.",
      );
      return { story, report };
    };
    const getReport = async (id: string) =>
      (await stories.listContentReports()).find((r) => r.id === id)!;
    const note =
      "Remove the article while the documented source issue is reviewed.";
    const first = await prepare();
    await assert.rejects(
      () =>
        stories.resolveContentReport(
          first.report.id,
          "takedown",
          editor.id,
          "short",
        ),
      /clear moderation note/,
    );
    assert.equal((await getReport(first.report.id)).status, "open");
    assert.equal(
      (await stories.getStoryById(first.story.id))!.status,
      "published",
    );

    // Force the second database write to fail. The story and its moderation event
    // must roll back with the unresolved report, on both supported databases.
    if (replica) {
      await (
        await mongo()
      ).database.command({
        collMod: "content_reports",
        validator: { status: { $ne: "actioned" } },
        validationLevel: "strict",
      });
    } else {
      db().exec(
        "CREATE TRIGGER reject_report_decision BEFORE UPDATE ON content_reports WHEN NEW.status='actioned' BEGIN SELECT RAISE(ABORT,'fixture report write failed'); END",
      );
    }
    try {
      await assert.rejects(() =>
        stories.resolveContentReport(
          first.report.id,
          "takedown",
          editor.id,
          note,
        ),
      );
      const faultAPI = await import("../app/api/admin/moderation/route");
      const editorCookie = (
        await auth.startSession(editor, new Request("https://www.syaahii.in"))
      ).headers
        .get("set-cookie")!
        .split(";")[0];
      const failure = await faultAPI.POST(
        new NextRequest("https://www.syaahii.in/api/admin/moderation", {
          method: "POST",
          headers: {
            cookie: editorCookie,
            origin: "https://www.syaahii.in",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            reportId: first.report.id,
            action: "takedown",
            note,
          }),
        }),
      );
      assert.equal(failure.status, 503);
      const safeFailure = await failure.json();
      assert(safeFailure.requestId);
      assert.doesNotMatch(
        JSON.stringify(safeFailure),
        /fixture report write failed|content_reports|validator|WriteError/i,
      );
      assert.equal((await getReport(first.report.id)).status, "open");
      const unchanged = (await stories.getStoryById(first.story.id))!;
      assert.equal(unchanged.status, "published");
      assert.equal(
        unchanged.moderationEvents?.filter((e) => e.action === "removed")
          .length || 0,
        0,
      );
    } finally {
      if (replica)
        await (
          await mongo()
        ).database.command({ collMod: "content_reports", validator: {} });
      else db().exec("DROP TRIGGER reject_report_decision");
    }
    await stories.recordPublicStoryView(first.story.slug!);
    const decision = await stories.resolveContentReport(
      first.report.id,
      "takedown",
      editor.id,
      note,
    );
    assert.equal(decision.status, "actioned");
    assert.equal(await stories.getPublicStory(first.story.slug!), null);
    const removed = (await stories.getStoryById(first.story.id))!;
    assert.equal(removed.analytics!.views, 1);
    assert.equal(removed.removedBy, editor.id);
    assert.equal(
      removed.moderationEvents!.filter((e) => e.action === "removed").length,
      1,
    );
    await assert.rejects(
      () =>
        stories.resolveContentReport(
          first.report.id,
          "dismiss",
          "other-editor",
          "Changed my mind",
        ),
      stories.ModerationConflictError,
    );
    assert.equal((await getReport(first.report.id)).moderator, editor.id);

    // Conflicting decisions cannot both win or leave the article out of sync.
    for (const actions of [
      ["dismiss", "takedown"],
      ["takedown", "takedown"],
    ] as const) {
      const pair = await prepare();
      const raced = await Promise.allSettled(
        actions.map((action, index) =>
          stories.resolveContentReport(
            pair.report.id,
            action,
            `editor-${index}`,
            note,
          ),
        ),
      );
      assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        raced.filter(
          (r) =>
            r.status === "rejected" &&
            r.reason instanceof stories.ModerationConflictError,
        ).length,
        1,
      );
      const resolved = await getReport(pair.report.id),
        article = (await stories.getStoryById(pair.story.id))!;
      assert.equal(
        article.status,
        resolved.status === "actioned" ? "removed" : "published",
      );
      assert.equal(
        article.moderationEvents!.filter((e) => e.action === "removed").length,
        resolved.status === "actioned" ? 1 : 0,
      );
      if (resolved.status === "actioned")
        assert.equal(article.removedBy, resolved.moderator);
    }
    // Two distinct reports racing to remove one story still produce one event.
    const pair = await prepare();
    const secondReport = await stories.reportPublicStory(
      editor.id,
      pair.story.slug!,
      "other",
      "An independent report of the same source attribution concern.",
    );
    const raced = await Promise.allSettled(
      [pair.report, secondReport].map((r) =>
        stories.resolveContentReport(r.id, "takedown", editor.id, note),
      ),
    );
    assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
    assert.deepEqual(
      [await getReport(pair.report.id), await getReport(secondReport.id)]
        .map((r) => r.status)
        .sort(),
      ["actioned", "open"],
    );
    assert.equal(
      (await stories.getStoryById(pair.story.id))!.moderationEvents!.filter(
        (e) => e.action === "removed",
      ).length,
      1,
    );

    const api = await import("../app/api/admin/moderation/route");
    const cookie = async (u: typeof author) =>
      (
        await auth.startSession(u, new Request("https://www.syaahii.in"))
      ).headers
        .get("set-cookie")!
        .split(";")[0];
    const request = (session: string, reportId: string) =>
      new NextRequest("https://www.syaahii.in/api/admin/moderation", {
        method: "POST",
        headers: {
          cookie: session,
          origin: "https://www.syaahii.in",
          "content-type": "application/json",
        },
        body: JSON.stringify({ reportId, action: "takedown", note }),
      });
    const apiPair = await prepare();
    const denied = await api.POST(
      request(await cookie(reader), apiPair.report.id),
    );
    assert.equal(denied.status, 403);
    assert.equal((await getReport(apiPair.report.id)).status, "open");
    const session = await cookie(editor);
    assert.equal(
      (await api.POST(request(session, apiPair.report.id))).status,
      200,
    );
    assert.equal(
      (await api.POST(request(session, apiPair.report.id))).status,
      409,
    );
    assert.equal(
      (await stories.getStoryById(apiPair.story.id))!.status,
      "removed",
    );
    console.log(
      `PASS writer moderation (${replica ? "MongoDB" : "SQLite"}): atomic article/report rollback on database failure, conflicting decision isolation, single takedown event, preserved views, validation, authorization and API 409 on stale decisions.`,
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
