import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-discovery-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";
async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  try {
    const auth = await import("../lib/auth/server"),
      { markEmailVerified } = await import("../lib/billing/rewards"),
      { enrollWriter } = await import("../lib/writing/profile"),
      stories = await import("../lib/writing/stories"),
      discovery = await import("../lib/writing/discovery"),
      { textDocument } = await import("../lib/writing/document");
    const writer = await auth.register(
        "Discovery Writer",
        "discovery@example.test",
        "discovery-safe-password",
      ),
      other = await auth.register(
        "Other Writer",
        "discovery-other@example.test",
        "discovery-safe-password",
      );
    for (const u of [writer, other]) {
      await markEmailVerified(u.id);
      await enrollWriter(u);
    }
    const body =
      "Normalization organizes relational data around functional dependencies. A lossless decomposition preserves the ability to reconstruct the original relation. Verify examples with your course textbook before applying a schema change.";
    let story = await stories.saveStory(writer.id, {
      title: "Understanding database normalization",
      summary:
        "A short guide to functional dependencies and lossless decomposition for university computer science students.",
      body,
      document: textDocument(body),
      tags: ["databases"],
      authorName: writer.name,
    });
    let calls = 0;
    const proposals = {
      title: "Database normalization and lossless decomposition",
      description:
        "Understand functional dependencies and lossless decomposition through a concise university database design guide.",
      topics: ["databases", "computer science"],
      questions: [
        {
          question: "What does a lossless decomposition preserve?",
          evidence:
            "A lossless decomposition preserves the ability to reconstruct the original relation.",
        },
      ],
      improvements: [
        "Add a worked schema example and link the original textbook source.",
      ],
    };
    const advisor = async () => {
      calls++;
      return {
        text: JSON.stringify(proposals),
        provider: "synthetic",
        model: "local-test-fixture",
      };
    };
    assert.throws(
      () =>
        discovery.validateSuggestions(
          {
            ...proposals,
            questions: [
              {
                question: "What is the result?",
                evidence: "A fabricated supporting claim appears here.",
              },
            ],
          },
          body,
        ),
      /evidence/,
    );
    assert.throws(() =>
      discovery.validateSuggestions(
        { ...proposals, title: "<script>bad</script>" },
        body,
      ),
    );
    await assert.rejects(
      () =>
        discovery.analyzeDiscovery(
          other.id,
          story.id,
          story.updatedAt,
          advisor,
        ),
      /not found/,
    );
    assert.equal(calls, 0);
    const report = await discovery.analyzeDiscovery(
      writer.id,
      story.id,
      story.updatedAt,
      advisor,
    );
    assert.equal(calls, 1);
    assert.equal(
      (await stories.ownedStory(writer.id, story.id))!.searchMetadata,
      undefined,
      "Analysis alone cannot change public metadata",
    );
    assert.equal(
      (
        await discovery.analyzeDiscovery(
          writer.id,
          story.id,
          story.updatedAt,
          advisor,
        )
      ).id,
      report.id,
    );
    assert.equal(calls, 1, "Unchanged draft reuses its saved report");
    await assert.rejects(
      () =>
        discovery.applyDiscovery(writer.id, story.id, story.updatedAt, {
          ...proposals,
          reportId: report.id,
          approve: false,
        }),
      /approve/,
    );
    story = await discovery.applyDiscovery(
      writer.id,
      story.id,
      story.updatedAt,
      { ...proposals, reportId: report.id, approve: true },
    );
    assert.equal(story.body, body);
    assert.equal(story.status, "draft");
    assert.equal(story.title, "Understanding database normalization");
    assert.equal(story.searchMetadata!.title, proposals.title);
    assert.equal(
      (await stories.ownedStory(writer.id, story.id))!.searchMetadata!
        .description,
      proposals.description,
    );
    await assert.rejects(
      () =>
        discovery.applyDiscovery(writer.id, story.id, story.updatedAt, {
          ...proposals,
          reportId: report.id,
          approve: true,
        }),
      /older draft/,
    );
    const api = await import("../app/api/writer/discovery/route"),
      getStories = await import("../app/api/stories/route");
    const cookie = async (u: any) =>
      (
        await auth.startSession(u, new Request("https://www.syaahii.in"))
      ).headers
        .get("set-cookie")!
        .split(";")[0];
    const ownCookie = await cookie(writer),
      foreign = await cookie(other);
    const req = (path: string, c = ownCookie, b?: unknown) =>
      new NextRequest("https://www.syaahii.in" + path, {
        method: b === undefined ? "GET" : "POST",
        headers: {
          cookie: c,
          origin: "https://www.syaahii.in",
          "content-type": "application/json",
        },
        ...(b === undefined ? {} : { body: JSON.stringify(b) }),
      });
    assert.equal(
      (await api.GET(req("/api/writer/discovery?storyId=" + story.id, foreign)))
        .status,
      404,
    );
    assert.equal(
      (await getStories.GET(req("/api/stories?id=" + story.id))).status,
      200,
    );
    assert.equal(
      (await getStories.GET(req("/api/stories?id=" + story.id, foreign)))
        .status,
      404,
    );
    story = await stories.saveStory(writer.id, {
      ...story,
      expectedUpdatedAt: story.updatedAt,
      title: "Updated database design explanation",
      body: body + " Another note.",
      document: textDocument(body + " Another note."),
      searchMetadata: undefined,
    });
    assert.equal(
      story.searchMetadata,
      undefined,
      "Changed article content clears previously approved metadata for review",
    );
    assert.equal(
      (await discovery.savedDiscovery(writer.id, story.id)).stale,
      true,
    );
    await assert.rejects(
      () =>
        discovery.applyDiscovery(writer.id, story.id, story.updatedAt, {
          ...proposals,
          reportId: report.id,
          approve: true,
        }),
      /older draft/,
    );
    let during = story;
    await assert.rejects(
      () =>
        discovery.analyzeDiscovery(
          writer.id,
          story.id,
          story.updatedAt,
          async () => {
            during = await stories.saveStory(writer.id, {
              ...story,
              expectedUpdatedAt: story.updatedAt,
              title: "Concurrent database article edit",
            });
            return advisor();
          },
        ),
      /changed while/,
    );
    assert.equal(
      (await stories.ownedStory(writer.id, story.id))!.title,
      during.title,
    );
    story = await stories.saveStory(writer.id, {
      ...during,
      expectedUpdatedAt: during.updatedAt,
      submit: true,
    });
    await assert.rejects(
      () =>
        discovery.analyzeDiscovery(
          writer.id,
          story.id,
          story.updatedAt,
          advisor,
        ),
      /editable draft/,
    );
    console.log(
      `Writer discovery checks passed (${replica ? "MongoDB" : "SQLite"}): owner-only reports, exact evidence, cache, approval, unchanged body, stale revision and review locking.`,
    );
  } finally {
    if (replica) {
      const { mongo } = await import("../lib/storage/mongo");
      await (await mongo()).client.close();
      await replica.stop();
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
