import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { PinAction } from "../lib/writing/pins";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "writer-pins-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  BACKEND_URL: "",
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
      stories = await import("../lib/writing/stories"),
      pins = await import("../lib/writing/pins"),
      { publicGuides } = await import("../lib/writing/public"),
      { markEmailVerified } = await import("../lib/billing/rewards");
    const author = await auth.register(
        "University Writer",
        "pins-author@example.test",
        "fixture-password-safe",
      ),
      other = await auth.register(
        "Another Writer",
        "pins-other@example.test",
        "fixture-password-safe",
      ),
      student = await auth.register(
        "Student",
        "pins-student@example.test",
        "fixture-password-safe",
      );
    for (const u of [author, other, student]) await markEmailVerified(u.id);
    const profile = await profiles.enrollWriter(author);
    await profiles.enrollWriter(other);
    const create = async (user = author, submit = true) => {
      const s = await stories.saveStory(user.id, {
        title: `Database reasoning guide ${randomUUID().slice(0, 6)}`,
        summary: "A practical reference for university students.",
        body: "Use functional dependencies to understand normalization. Compare a worked example with its source and explain why the decomposition is lossless before applying it to another database design.",
        tags: ["databases"],
        authorName: user.name,
        submit,
      });
      return submit
        ? stories.reviewStory(
            s.id,
            "publish",
            "Synthetic reviewed story",
            author.id,
          )
        : s;
    };
    const published = await Promise.all(
      Array.from({ length: 4 }, () => create()),
    );
    const foreign = await create(other),
      draft = await create(author, false);
    const act = async (storyId: string, action: PinAction = "pin") =>
      pins.changePin(author.id, {
        storyId,
        action,
        expectedUpdatedAt: (await pins.readPins(author.id)).updatedAt,
      });
    await assert.rejects(
      () => act(foreign.id),
      (e: unknown) => e instanceof pins.WriterPinError && e.status === 404,
    );
    await assert.rejects(() => act(draft.id), /Only approved/);
    await assert.rejects(
      () =>
        pins.changePin(student.id, {
          storyId: published[0].id,
          action: "pin",
          expectedUpdatedAt: "",
        }),
      /enrollment/,
    );
    await assert.rejects(
      () =>
        pins.changePin(author.id, {
          storyId: published[0].id,
          action: ["pin"],
          expectedUpdatedAt: "",
        }),
      /Choose a story action/,
    );
    const first = await act(published[0].id);
    assert.deepEqual((await pins.readPins(author.id)).storyIds, [
      published[0].id,
    ]);
    assert.equal((await act(published[0].id)).updatedAt, first.updatedAt);
    await act(published[1].id);
    await act(published[2].id);
    await assert.rejects(() => act(published[3].id), /up to three/);
    await act(published[2].id, "move_up");
    assert.deepEqual((await pins.readPins(author.id)).storyIds, [
      published[0].id,
      published[2].id,
      published[1].id,
    ]);
    await act(published[2].id, "move_up");
    await act(published[2].id, "move_down");
    // An older pin is loaded directly even when it has fallen outside the public pool.
    const now = Date.now() + 10000;
    await stories.commitStoryChanges(
      Array.from({ length: 110 }, (_, i) => {
        const id = randomUUID(),
          at = new Date(now + i).toISOString();
        return {
          before: null,
          after: {
            ...published[3],
            id,
            slug: `newer-fixture-${id}`,
            title: `Newer public ${i}`,
            updatedAt: at,
            publishedAt: at,
          },
        };
      }),
    );
    await stories.commitStoryChanges(
      Array.from({ length: 55 }, (_, i) => ({
        before: null,
        after: {
          ...draft,
          id: randomUUID(),
          title: `Private pending ${i}`,
          updatedAt: new Date(now + 200 + i).toISOString(),
        },
      })),
    );
    assert(
      !(await stories.listPublicStoriesByCreator(profile.slug)).some(
        (s) => s.id === published[0].id,
      ),
    );
    let publicList = await publicGuides("creator", profile.slug);
    assert.equal(publicList.length, 100);
    assert.equal(publicList[0].slug, published[0].slug);
    assert(publicList.slice(0, 3).every((s) => s.pinned));
    for (const s of publicList)
      for (const field of [
        "id",
        "user",
        "reviewNote",
        "versions",
        "moderationEvents",
        "storyIds",
      ])
        assert(!Object.hasOwn(s, field));
    const privateList = await pins.pinWorkspace(author.id);
    assert.equal(privateList.choices.length, 50);
    assert(privateList.choices.every((s) => s.published));
    assert(!JSON.stringify(privateList).includes("Private pending"));
    // Withdrawal/takedown takes precedence over a saved pin; private revision titles never leak.
    const before = (await stories.getStoryById(published[0].id))!;
    await stories.commitStoryChanges([
      {
        before,
        after: {
          ...before,
          status: "unpublished",
          title: "PRIVATE WITHDRAWN TITLE",
          updatedAt: new Date(now + 1000).toISOString(),
        },
      },
    ]);
    const removed = (await stories.getStoryById(published[1].id))!;
    await stories.removeStory(
      removed.id,
      author.id,
      "Synthetic source attribution concern.",
    );
    publicList = await publicGuides("creator", profile.slug);
    assert(!JSON.stringify(publicList).includes("PRIVATE WITHDRAWN TITLE"));
    assert(
      !publicList.some(
        (s) => s.slug === published[0].slug || s.slug === published[1].slug,
      ),
    );
    assert.equal(
      (await pins.pinWorkspace(author.id)).pinned.filter((s) => !s.published)
        .length,
      2,
    );
    await act(published[0].id, "unpin");
    await act(published[1].id, "unpin");
    await act(published[2].id, "unpin");
    const fresh = (await pins.readPins(author.id)).updatedAt;
    const candidates = (await pins.pinWorkspace(author.id)).choices.slice(0, 2);
    const additions = await Promise.allSettled(
      candidates.map((s) =>
        pins.changePin(author.id, {
          storyId: s.id,
          action: "pin",
          expectedUpdatedAt: fresh,
        }),
      ),
    );
    assert.equal(additions.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      additions.filter(
        (r) => r.status === "rejected" && r.reason.status === 409,
      ).length,
      1,
    );
    assert.equal((await pins.readPins(other.id)).storyIds.length, 0);
    const api = await import("../app/api/writer/pins/route"),
      publicApi = await import("../app/api/publications/route");
    const cookie = async (u: typeof author) =>
      (
        await auth.startSession(u, new Request("https://www.syaahii.in"))
      ).headers
        .get("set-cookie")!
        .split(";")[0];
    assert.equal(
      (await api.GET(new NextRequest("https://www.syaahii.in/api/writer/pins")))
        .status,
      401,
    );
    assert.equal(
      (
        await api.GET(
          new NextRequest("https://www.syaahii.in/api/writer/pins", {
            headers: { cookie: await cookie(student) },
          }),
        )
      ).status,
      403,
    );
    const session = await cookie(author),
      state = await pins.readPins(author.id);
    const request = (
      origin = "https://www.syaahii.in",
      expectedUpdatedAt = state.updatedAt,
    ) =>
      new NextRequest("https://www.syaahii.in/api/writer/pins", {
        method: "PATCH",
        headers: {
          cookie: session,
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          storyId: foreign.id,
          action: "pin",
          expectedUpdatedAt,
          owner: other.id,
        }),
      });
    assert.equal((await api.PATCH(request())).status, 404);
    assert.equal(
      (await api.PATCH(request("https://attacker.example"))).status,
      403,
    );
    const response = await publicApi.GET(
      new NextRequest(
        `https://www.syaahii.in/api/publications?creator=${profile.slug}`,
      ),
    );
    const dto = await response.json();
    assert(!JSON.stringify(dto).includes(author.email));
    assert(!JSON.stringify(dto).includes("PRIVATE WITHDRAWN TITLE"));
    assert.equal(response.headers.get("cache-control"), "no-store");
    console.log(
      `PASS writer pins (${replica ? "MongoDB" : "SQLite"}): ownership/approval gates, three-pin limit, stable ordering, older published retrieval, private-field redaction, withdrawal/takedown filtering, pre-limit visibility filtering, CAS races and API authorization/CSRF.`,
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
