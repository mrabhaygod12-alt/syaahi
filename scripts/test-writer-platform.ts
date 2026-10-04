import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import sharp from "sharp";
process.env.APP_ROLE = "all";
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-writer-platform-"));
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3147";
process.env.SUPABASE_ADMIN_SYNC = "false";
async function run(backend: string) {
  const auth = await import("../app/api/auth/route"),
    { register, startSession, accountByEmail } =
      await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { balance } = await import("../lib/credits/store"),
    stories = await import("../app/api/stories/route"),
    student = await import("../app/api/user/profile/route"),
    profile = await import("../app/api/writer/profile/route"),
    library = await import("../app/api/writer/library/route"),
    { writerProfile, writerBySlug } = await import("../lib/writing/profile"),
    { normalizeDocument } = await import("../lib/writing/document"),
    { reviewStory } = await import("../lib/writing/stories"),
    { setGuideReaction } = await import("../lib/writing/engagement");
  const password = "writer-platform-password",
    email = `${backend}@example.test`;
  const user = await register("Student Name", email, password);
  await markEmailVerified(user.id);
  const session = await startSession(
    user,
    new Request("http://localhost:3147"),
  );
  let cookie = session.headers.get("set-cookie")!.split(";")[0];
  let sequence = 0;
  const req = (path: string, method = "GET", body?: unknown, signed = true) =>
    new NextRequest(`http://localhost:3147${path}`, {
      method,
      headers: {
        origin: "http://localhost:3147",
        "content-type": "application/json",
        "x-forwarded-for": `writer-test-${backend}-${sequence++}`,
        ...(signed ? { cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await stories.GET(req("/api/stories"))).status, 403);
  assert.equal(
    (
      await stories.POST(
        req("/api/stories", "POST", {
          title: "Bypass attempt",
          document: { type: "doc" },
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await student.PATCH(
        req("/api/user/profile", "PATCH", { workspace: "writer" }),
      )
    ).status,
    403,
  );
  assert.equal(await writerProfile(user.id), null);
  const consent = { acceptTerms: true, termsVersion: "2026-10-03" };
  const login = await auth.POST(
    req(
      "/api/auth",
      "POST",
      { email, password, mode: "login", workspace: "writer", ...consent },
      false,
    ),
  );
  assert.equal(login.status, 403);
  assert.equal(login.headers.get("set-cookie"), null);
  assert.equal(
    (
      await auth.POST(
        req(
          "/api/auth",
          "POST",
          {
            email,
            password: "wrong-password-42",
            mode: "signup",
            workspace: "writer",
            ...consent,
          },
          false,
        ),
      )
    ).status,
    401,
  );
  assert.equal(await writerProfile(user.id), null);
  const enrolled = await auth.POST(
    req(
      "/api/auth",
      "POST",
      {
        email,
        password,
        name: "Ignored impersonation",
        mode: "signup",
        workspace: "writer",
        ...consent,
      },
      false,
    ),
  );
  assert.equal(enrolled.status, 200);
  const identity = (await enrolled.json()).user;
  assert.equal(identity.id, user.id);
  assert.equal(identity.name, "Student Name");
  assert.equal(await balance(user.id), 19);
  assert.equal((await accountByEmail(email))!.id, user.id);
  cookie = enrolled.headers.get("set-cookie")!.split(";")[0];
  const original = (
    await (await profile.GET(req("/api/writer/profile"))).json()
  ).profile;
  const photo = await sharp({
    create: { width: 25, height: 25, channels: 3, background: "#285647" },
  })
    .png()
    .toBuffer();
  const changed = await profile.PATCH(
    req("/api/writer/profile", "PATCH", {
      name: "Writer Name",
      bio: "A separate writer identity.",
      about: "My experience and writing interests.",
      pronouns: ["they/them"],
      website: "https://example.com",
      avatar: `data:image/png;base64,${photo.toString("base64")}`,
      expectedUpdatedAt: original.updatedAt,
    }),
  );
  assert.equal(changed.status, 200);
  const savedProfile = (await changed.json()).profile;
  assert.equal(savedProfile.name, "Writer Name");
  assert.match(savedProfile.avatar, /^data:image\/webp/);
  assert.equal((await accountByEmail(email))!.name, "Student Name");
  assert.equal((await writerBySlug(original.slug))!.bio, savedProfile.bio);
  assert.equal(
    (
      await profile.PATCH(
        req("/api/writer/profile", "PATCH", {
          bio: "stale",
          expectedUpdatedAt: original.updatedAt,
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await profile.PATCH(
        req("/api/writer/profile", "PATCH", { website: "javascript:alert(1)" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await profile.PATCH(
        req("/api/writer/profile", "PATCH", {
          avatar: "data:image/png;base64,YmFk",
        }),
      )
    ).status,
    400,
  );
  const doc = normalizeDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "justify", indent: 2 },
        content: [
          {
            type: "text",
            text: "A careful guide to learning through consistent active recall and deliberate practice. Check source material, revisit weak areas, and explain ideas in your own words.",
            marks: [
              {
                type: "textStyle",
                attrs: {
                  fontFamily: "Georgia",
                  fontSize: "24px",
                  color: "#285647",
                  lineHeight: "1.5",
                  onerror: "bad",
                },
              },
              { type: "highlight", attrs: { color: "#fff1ad" } },
              { type: "superscript" },
            ],
          },
        ],
      },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                attrs: { colspan: 1, rowspan: 1 },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Safe table" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(doc.content![0].content![0].marks![0].attrs!.onerror, undefined);
  const created = await stories.POST(
    req("/api/stories", "POST", {
      title: "A useful guide",
      summary: "An introduction",
      document: doc,
      tags: ["Learning"],
      action: "save",
    }),
  );
  assert.equal(created.status, 200);
  const story = (await created.json()).story;
  assert.equal(story.authorName, "Writer Name");
  assert.equal(story.creatorSlug, savedProfile.slug);
  assert.deepEqual(story.document, doc);
  const other = await register(
    "Other",
    `${backend}-other@example.test`,
    password,
  );
  await markEmailVerified(other.id);
  const { deleteDraft, saveStory } = await import("../lib/writing/stories");
  await assert.rejects(() => deleteDraft(other.id, story.id));
  await assert.rejects(() =>
    saveStory(other.id, {
      id: story.id,
      title: "Stolen",
      summary: "",
      body: "body",
      tags: [],
      authorName: "Other",
    }),
  );
  const submitted = await stories.POST(
    req("/api/stories", "POST", {
      ...story,
      expectedUpdatedAt: story.updatedAt,
      action: "submit",
    }),
  );
  assert.equal(submitted.status, 200);
  assert.equal(
    (await stories.DELETE(req(`/api/stories?id=${story.id}`, "DELETE"))).status,
    400,
  );
  const published = await reviewStory(story.id, "publish", "Reviewed", user.id);
  const renamed = await profile.PATCH(
    req("/api/writer/profile", "PATCH", {
      name: "Updated Writer Name",
      expectedUpdatedAt: savedProfile.updatedAt,
    }),
  );
  assert.equal(renamed.status, 200);
  const publications = await import("../app/api/publications/route");
  const publicResult = await (
    await publications.GET(
      req(`/api/publications?slug=${published.slug}`, "GET", undefined, false),
    )
  ).json();
  assert.equal(publicResult.stories[0].authorName, "Updated Writer Name");
  assert.equal(publicResult.stories[0].creatorSlug, savedProfile.slug);
  assert.equal(publicResult.stories[0].user, undefined);
  assert.equal(publicResult.stories[0].versions, undefined);
  assert.equal(publicResult.stories[0].reviewNote, undefined);
  const ownStories = await (await stories.GET(req("/api/stories"))).json();
  assert.equal(ownStories.stories[0].authorName, "Updated Writer Name");
  assert.equal((await accountByEmail(email))!.name, "Student Name");
  await setGuideReaction(user.id, published.slug!, "bookmark", true);
  const saved = await (await library.GET(req("/api/writer/library"))).json();
  assert.equal(saved.stories.length, 1);
  assert.equal(saved.stories[0].authorName, "Updated Writer Name");
  assert.equal(saved.stories[0].user, undefined);
  assert.equal(saved.stories[0].versions, undefined);
  await setGuideReaction(user.id, published.slug!, "bookmark", false);
  assert.equal(
    (await (await library.GET(req("/api/writer/library"))).json()).stories
      .length,
    0,
  );
  const before = await writerProfile(user.id);
  const repeated = await auth.POST(
    req(
      "/api/auth",
      "POST",
      { email, password, mode: "signup", workspace: "writer", ...consent },
      false,
    ),
  );
  assert.equal(repeated.status, 200);
  assert.deepEqual(await writerProfile(user.id), before);
  assert.equal(await balance(user.id), 19);
  const unverified = await register(
    "Unverified",
    `${backend}-unverified@example.test`,
    password,
  );
  assert.equal(
    (
      await auth.POST(
        req(
          "/api/auth",
          "POST",
          {
            email: unverified.email,
            password,
            mode: "signup",
            workspace: "writer",
            ...consent,
          },
          false,
        ),
      )
    ).status,
    403,
  );
  assert.equal(await writerProfile(unverified.id), null);
  console.log(
    `PASS ${backend}: explicit authenticated enrollment, shared identity/wallet, independent profile/photo, current public bylines, sanitization, stale writes, ownership, review locking and saved library.`,
  );
}
async function main() {
  await run("sqlite");
  const replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.12" },
  });
  try {
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
    process.env.MONGODB_DATABASE = "writer_platform_test";
    await run("mongo");
  } finally {
    const { client } = await (await import("../lib/storage/mongo")).mongo();
    await client.close();
    await replica.stop();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
