import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "writer-recommendations-")),
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
      { markEmailVerified } = await import("../lib/billing/rewards"),
      profiles = await import("../lib/writing/profile"),
      stories = await import("../lib/writing/stories"),
      r = await import("../lib/writing/recommendations"),
      { followWriter } = await import("../lib/writing/social");
    const reader = await auth.register(
        "Reader",
        "recommend-reader@example.test",
        "fixture-safe-password",
      ),
      author = await auth.register(
        "Author",
        "recommend-author@example.test",
        "fixture-safe-password",
      ),
      other = await auth.register(
        "Other",
        "recommend-other@example.test",
        "fixture-safe-password",
      );
    for (const u of [reader, author, other]) {
      await markEmailVerified(u.id);
      await profiles.enrollWriter(u);
    }
    let prefs = await r.readingPreferences(reader.id);
    assert.equal(prefs.useReadingHistory, false);
    prefs = await r.updateReadingPreferences(reader.id, {
      topics: ["Databases"],
      mutedTopics: ["politics"],
      mutedCreators: [],
      useReadingHistory: false,
      expectedUpdatedAt: prefs.updatedAt,
      owner: other.id,
    });
    assert.equal(prefs.owner, reader.id);
    assert.deepEqual(prefs.topics, ["databases"]);
    assert.deepEqual((await r.readingPreferences(other.id)).topics, []);
    await assert.rejects(
      () =>
        r.updateReadingPreferences(reader.id, {
          ...prefs,
          expectedUpdatedAt: "",
        }),
      /changed in another/,
    );
    await assert.rejects(
      () =>
        r.updateReadingPreferences(reader.id, {
          ...prefs,
          topics: ["<script>"],
          expectedUpdatedAt: prefs.updatedAt,
        }),
      /without markup/,
    );
    await assert.rejects(
      () =>
        r.updateReadingPreferences(reader.id, {
          ...prefs,
          topics: ["politics"],
          expectedUpdatedAt: prefs.updatedAt,
        }),
      /both preferred and muted/,
    );
    const published: any[] = [];
    for (let i = 0; i < 8; i++) {
      const u = i < 5 ? author : other,
        p = (await profiles.writerProfile(u.id))!;
      const d = await stories.saveStory(u.id, {
        title: `University research article ${i}`,
        summary: "University source-aware reading.",
        body: "This university article explains a specific course topic through a concise source-aware example. Readers should verify claims against the original course reference.",
        tags: [i === 7 ? "politics" : i % 2 ? "research" : "databases"],
        authorName: u.name,
        creatorSlug: p.slug,
        submit: true,
      });
      published.push(
        await stories.reviewStory(
          d.id,
          "publish",
          "Reviewed fixture",
          reader.id,
        ),
      );
    }
    const ap = (await profiles.writerProfile(author.id))!;
    await followWriter(reader.id, ap.slug, true);
    const feed = await r.recommendedStories(reader.id);
    assert(feed.stories.length > 0);
    assert(feed.stories.every((s) => !s.tags.includes("politics")));
    assert(feed.stories.some((s) => feed.reasons[s.slug!].includes("topic")));
    assert(
      feed.stories.every(
        (s) =>
          !Object.keys(s).some((k) =>
            ["user", "versions", "reviewNote", "moderationEvents"].includes(k),
          ),
      ),
    );
    const following = await r.recommendedStories(reader.id, "following");
    assert(following.stories.every((s) => s.creatorSlug === ap.slug));
    await assert.rejects(
      () =>
        r.updateReadingPreferences(reader.id, {
          ...prefs,
          mutedCreators: ["missing-public-writer"],
          expectedUpdatedAt: prefs.updatedAt,
        }),
      /available public Syaahi writer/,
    );
    const unverified = await auth.register(
      "Unverified",
      "recommend-unverified@example.test",
      "fixture-safe-password",
    );
    const privateProfile = await profiles.enrollWriter(unverified);
    await assert.rejects(
      () =>
        r.updateReadingPreferences(reader.id, {
          ...prefs,
          mutedCreators: [privateProfile.slug],
          expectedUpdatedAt: prefs.updatedAt,
        }),
      /available public Syaahi writer/,
    );
    prefs = await r.updateReadingPreferences(reader.id, {
      ...prefs,
      mutedCreators: [ap.slug],
      expectedUpdatedAt: prefs.updatedAt,
    });
    for (const mode of ["for_you", "latest", "following"] as const)
      assert(
        (await r.recommendedStories(reader.id, mode)).stories.every(
          (s) => s.creatorSlug !== ap.slug,
        ),
      );
    assert.deepEqual((await r.readingPreferences(other.id)).mutedCreators, []);
    assert(
      (
        await (
          await import("../lib/writing/social")
        ).followStatus(ap.slug, reader.id)
      ).following,
    );
    prefs = await r.updateReadingPreferences(reader.id, {
      ...prefs,
      mutedCreators: [],
      expectedUpdatedAt: prefs.updatedAt,
    });
    assert(
      (await r.recommendedStories(reader.id)).stories.some(
        (s) => s.creatorSlug === ap.slug,
      ),
    );
    const candidates = Array.from({ length: 40 }, (_, i) => ({
      ...published[0],
      id: "ranking-" + i,
      slug: "ranking-" + i,
      creatorSlug: i < 20 ? "prolific" : "new-author-" + i,
      tags: i < 20 ? ["databases"] : ["research"],
      analytics: { views: i < 20 ? 1000000 : 0 },
      publishedAt: new Date(Date.now() - i * 1000).toISOString(),
    }));
    const ranked = r.rankStories(candidates, prefs, new Set());
    assert(ranked.length >= 20 && ranked.length <= 24);
    assert(ranked.some((s) => s.story.creatorSlug !== "prolific"));
    assert(
      ranked.filter((s) => s.story.creatorSlug === "prolific").length <= 3,
      "Popularity must not crowd out other writers",
    );
    assert(ranked[3].reason.includes("different perspective"));
    const hidden = { ...prefs, mutedCreators: ["prolific"] };
    assert(
      r
        .rankStories(candidates, hidden, new Set())
        .every((s) => s.story.creatorSlug !== "prolific"),
    );
    const history: any[] = [{ storyId: candidates[0].id, qualified: true }];
    const sameInstant = Date.now();
    assert.deepEqual(
      r.rankStories(
        candidates,
        prefs,
        new Set(),
        history,
        "for_you",
        sameInstant,
      ),
      r.rankStories(candidates, prefs, new Set(), [], "for_you", sameInstant),
      "Opted-out history must have no ranking effect",
    );
    assert.notEqual(
      r.rankStories(
        candidates,
        { ...prefs, useReadingHistory: true },
        new Set(),
        history,
      )[0].story.id,
      candidates[0].id,
    );
    const cookie = (
        await auth.startSession(reader, new Request("https://www.syaahii.in"))
      ).headers
        .get("set-cookie")!
        .split(";")[0],
      api = await import("../app/api/writer/preferences/route"),
      feedApi = await import("../app/api/writer/feed/route");
    const request = new NextRequest(
      "https://www.syaahii.in/api/writer/preferences?owner=" + other.id,
      { headers: { cookie } },
    );
    const own = await (await api.GET(request)).json();
    assert.equal(own.preferences.owner, reader.id);
    assert.equal(
      (
        await feedApi.GET(
          new NextRequest("https://www.syaahii.in/api/writer/feed"),
        )
      ).status,
      401,
    );
    console.log(
      `PASS writer recommendations (${replica ? "MongoDB" : "SQLite"}): private CAS preferences, exact topic/author filters, follow feed, diversity, capped popularity, history opt-in and public-only result fields.`,
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
