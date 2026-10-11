import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";

const origin = "https://www.syaahii.in";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "writer-service-errors-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  APP_ORIGIN: origin,
  NEXT_PUBLIC_APP_URL: origin,
  ADMIN_EMAILS: "service-editor@example.test",
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
      imageStore = await import("../lib/writing/images"),
      { textDocument } = await import("../lib/writing/document"),
      api = await import("../app/api/stories/route"),
      publishing = await import("../app/api/writer/publishing/route"),
      publicationStore = await import("../lib/writing/publishing"),
      review = await import("../app/api/admin/stories/route"),
      upload = await import("../app/api/writing/images/route"),
      reports = await import("../app/api/reports/route"),
      { db } = await import("../lib/db"),
      { mongo } = await import("../lib/storage/mongo");
    const author = await auth.register(
        "Writer",
        "service-writer@example.test",
        "fixture-password-safe",
      ),
      editor = await auth.register(
        "Editor",
        "service-editor@example.test",
        "fixture-password-safe",
      );
    for (const user of [author, editor]) {
      await markEmailVerified(user.id);
      await enrollWriter(user);
    }
    const cookieFor = async (user: typeof author) =>
      (await auth.startSession(user, new Request(origin))).headers
        .get("set-cookie")!
        .split(";")[0];
    const authorCookie = await cookieFor(author),
      editorCookie = await cookieFor(editor);
    const request = (
      path: string,
      data?: unknown,
      cookie = authorCookie,
      method = "POST",
    ) =>
      new NextRequest(origin + path, {
        method,
        headers: {
          cookie,
          origin,
          ...(data instanceof FormData
            ? {}
            : { "content-type": "application/json" }),
        },
        ...(data === undefined
          ? {}
          : { body: data instanceof FormData ? data : JSON.stringify(data) }),
      });
    const body =
      "A practical guide to university research explains the evidence, compares the methods and identifies what students should verify before using the conclusion.";
    const content = {
      title: "A practical university research guide",
      summary: "Read the evidence first.",
      body,
      document: textDocument(body),
      tags: ["research"],
      authorName: author.name,
    };
    const draft = await stories.saveStory(author.id, content),
      submission = await stories.saveStory(author.id, {
        ...content,
        submit: true,
      }),
      published = await stories.reviewStory(
        (await stories.saveStory(author.id, { ...content, submit: true })).id,
        "publish",
        "Reviewed fixture",
        editor.id,
      );
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#285647" },
    })
      .png()
      .toBuffer();
    await imageStore.uploadWritingImage(
      author.id,
      png,
      "A synthetic reference diagram",
    );
    await stories.reportPublicStory(
      editor.id,
      published.slug!,
      "other",
      "A fixture report to initialize the report collection.",
    );
    const revisionParent = await stories.reviewStory(
      (await stories.saveStory(author.id, { ...content, submit: true })).id,
      "publish",
      "Reviewed revision fixture",
      editor.id,
    );
    const revision = await publicationStore.beginRevision(
      author.id,
      revisionParent.id,
      revisionParent.updatedAt,
    );
    const imageForm = (bytes: Uint8Array = png) => {
      const form = new FormData();
      form.set(
        "image",
        new File([new Uint8Array(bytes)], "example.png", { type: "image/png" }),
      );
      form.set("alt", "A synthetic university research diagram");
      return form;
    };
    for (const invalid of [null, [], "invalid"]) {
      assert.equal(
        (await api.POST(request("/api/stories", invalid))).status,
        400,
      );
      assert.equal(
        (await publishing.POST(request("/api/writer/publishing", invalid)))
          .status,
        400,
      );
      assert.equal(
        (
          await review.POST(
            request("/api/admin/stories", invalid, editorCookie),
          )
        ).status,
        400,
      );
    }
    for (const document of [
      { type: "doc", attrs: [] },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Example", marks: {} }],
          },
        ],
      },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Example", marks: [null] }],
          },
        ],
      },
    ])
      assert.equal(
        (
          await api.POST(
            request("/api/stories", { ...content, document, action: "save" }),
          )
        ).status,
        400,
      );
    assert.equal(
      (
        await api.POST(
          request("/api/stories", {
            ...content,
            canonicalUrl: "https://[invalid",
            action: "save",
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await upload.POST(
          request(
            "/api/writing/images",
            imageForm(new TextEncoder().encode("not an image")),
          ),
        )
      ).status,
      400,
    );

    const beforeStories = await stories.listStories(author.id),
      beforeReports = await stories.listContentReports();
    const cleanups: (() => Promise<void>)[] = [];
    const rejectWrites = async (
      table: "stories" | "writing_images" | "content_reports",
    ) => {
      if (replica) {
        const database = (await mongo()).database;
        await database.command({
          collMod: table,
          validator: { _id: { $exists: false } },
          validationLevel: "strict",
        });
        cleanups.push(async () => {
          await database.command({ collMod: table, validator: {} });
        });
      } else {
        for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
          const name = `reject_${table}_${operation.toLowerCase()}`;
          db().exec(
            `CREATE TRIGGER ${name} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'PRIVATE_DATABASE_FAILURE'); END`,
          );
          cleanups.push(async () => {
            db().exec(`DROP TRIGGER ${name}`);
          });
        }
      }
    };
    try {
      for (const table of [
        "stories",
        "writing_images",
        "content_reports",
      ] as const)
        await rejectWrites(table);
      const failures = [
        await api.POST(request("/api/stories", { ...content, action: "save" })),
        await api.POST(
          request("/api/stories", {
            ...content,
            id: draft.id,
            expectedUpdatedAt: draft.updatedAt,
            title: "This edit must fail safely",
            action: "save",
          }),
        ),
        await api.DELETE(
          request(
            `/api/stories?id=${revision.id}`,
            undefined,
            authorCookie,
            "DELETE",
          ),
        ),
        await publishing.POST(
          request("/api/writer/publishing", {
            id: published.id,
            action: "unpublish",
            expectedUpdatedAt: published.updatedAt,
          }),
        ),
        await publishing.POST(
          request("/api/writer/publishing", {
            id: published.id,
            action: "revise",
            expectedUpdatedAt: published.updatedAt,
          }),
        ),
        await review.POST(
          request(
            "/api/admin/stories",
            {
              id: submission.id,
              action: "publish",
              expectedUpdatedAt: submission.updatedAt,
            },
            editorCookie,
          ),
        ),
        await upload.POST(request("/api/writing/images", imageForm())),
        await reports.POST(
          request("/api/reports", {
            slug: published.slug,
            reason: "misleading",
            details:
              "This synthetic report must fail safely and retain its public article.",
          }),
        ),
      ];
      for (const response of failures) {
        assert.equal(response.status, 503);
        const safe = await response.json();
        assert.match(safe.requestId, /^[a-f0-9-]{36}$/);
        assert.equal(response.headers.get("x-request-id"), safe.requestId);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.doesNotMatch(
          JSON.stringify(safe),
          /PRIVATE_DATABASE_FAILURE|stories|writing_images|content_reports|validator|WriteError|MongoServerError|SqliteError/i,
        );
      }
      assert.deepEqual(await stories.listStories(author.id), beforeStories);
      assert.deepEqual(await stories.listContentReports(), beforeReports);
      assert.equal(
        (await stories.getPublicStory(published.slug!))!.status,
        "published",
      );
    } finally {
      for (const reset of cleanups.reverse()) await reset();
    }
    const recovered = await api.POST(
      request("/api/stories", {
        ...content,
        id: draft.id,
        expectedUpdatedAt: draft.updatedAt,
        title: "A recovered profile-independent draft",
        action: "save",
      }),
    );
    assert.equal(recovered.status, 200);
    const fresh = (await recovered.json()).story;
    assert.equal(
      (
        await api.POST(
          request("/api/stories", {
            ...content,
            id: fresh.id,
            expectedUpdatedAt: "",
            action: "save",
          }),
        )
      ).status,
      409,
      "An empty revision cannot bypass conflict checks",
    );
    assert.deepEqual(await stories.ownedStory(author.id, fresh.id), fresh);
    assert.equal(
      (
        await api.POST(
          request("/api/stories", {
            ...content,
            id: fresh.id,
            expectedUpdatedAt: draft.updatedAt,
            action: "save",
          }),
        )
      ).status,
      409,
    );
    assert.equal(
      (await upload.POST(request("/api/writing/images", imageForm()))).status,
      200,
    );
    console.log(
      `PASS writer service errors (${replica ? "MongoDB" : "SQLite"}): invalid documents/URLs/images return 400; draft creation/save/delete, withdrawal/revision, review, image and report outages return redacted 503 references; rollback retains public content and explicit recovery works.`,
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
