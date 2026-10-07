import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { NextRequest } from "next/server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-growth-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.WORKER_MODE = "external";
process.env.APP_ROLE = "all";
async function main() {
  let mongo: any;
  if (process.argv.includes("--mongo")) {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.DATA_BACKEND = "mongo";
    process.env.MONGODB_URI = mongo.getUri();
  }
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards");
  const user = await auth.register(
      "University tester",
      "growth@example.test",
      "safe-growth-password",
    ),
    other = await auth.register(
      "Other tester",
      "growth-other@example.test",
      "safe-growth-password",
    );
  await markEmailVerified(user.id);
  await markEmailVerified(other.id);
  const cookie = async (u: any) =>
      (
        await auth.startSession(u, new Request("https://www.syaahii.in"))
      ).headers
        .get("set-cookie")!
        .split(";")[0],
    own = await cookie(user),
    foreign = await cookie(other);
  const req = (path: string, b?: unknown, c = own) =>
    new NextRequest("https://www.syaahii.in" + path, {
      method: b === undefined ? "GET" : "POST",
      headers: {
        cookie: c,
        origin: "https://www.syaahii.in",
        "content-type": "application/json",
      },
      ...(b === undefined ? {} : { body: JSON.stringify(b) }),
    });
  const { DEFAULT_LEARNING, learningPreferences } =
      await import("../lib/growth/preferences"),
    hub = await import("../app/api/student/hub/route"),
    { hubView } = await import("../lib/study/hub");
  const preferences = {
    ...DEFAULT_LEARNING,
    level: "pg",
    department: "Data science / AI & ML",
    language: "hindi",
  };
  assert.equal(learningPreferences(preferences).level, "pg");
  assert.throws(() => learningPreferences({ ...preferences, dailyGoal: 1000 }));
  assert.equal(
    (
      await hub.POST(
        req("/api/student/hub", { action: "preferences", preferences }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await hubView(user.id)).state.preferences?.department,
    preferences.department,
  );
  assert.equal((await hubView(other.id)).state.preferences, undefined);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await hub.POST(
          req("/api/student/hub", { action: "daily-minutes", minutes: 17 }),
        )
      ).status,
      200,
    );
  assert.equal((await hubView(user.id)).retention.minutes, 17);
  assert.equal(
    (
      await hub.POST(
        req("/api/student/hub", {
          action: "preferences",
          preferences: { ...preferences, language: "invalid" },
        }),
      )
    ).status,
    409,
  );
  const previews = await import("../lib/growth/preview"),
    { UNIVERSITY_SAMPLES } = await import("../lib/growth/samples");
  for (const s of UNIVERSITY_SAMPLES)
    for (const l of ["english", "hindi"] as const) {
      const r = await previews.guestPreview(s.topic, l);
      assert.equal(r.kind, "sample");
      assert.equal(r.preview.title, s[l].title);
      assert.equal(r.preview.points.length, 3);
    }
  assert.throws(() =>
    previews.validatePreview({
      ...UNIVERSITY_SAMPLES[0].english,
      title: "<script>bad</script>",
    }),
  );
  assert.throws(() =>
    previews.validatePreview({ ...UNIVERSITY_SAMPLES[0].english, points: [] }),
  );
  const network = globalThis.fetch;
  const priorKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "fixture-key";
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert(body.max_tokens <= 1000);
    return Response.json({
      id: "fixture-completion",
      model: "fixture",
      choices: [
        {
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify(UNIVERSITY_SAMPLES[0].english),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    });
  };
  try {
    const output = await Promise.all([
      previews.guestPreview("Quicksort partitions and invariants", "english"),
      previews.guestPreview("Quicksort partitions and invariants", "english"),
    ]);
    assert.equal(output[0].kind, "ai");
    assert.equal(calls, 1, "Repeated guest requests share one provider call");
    await previews.guestPreview(
      "Quicksort partitions and invariants",
      "english",
    );
    assert.equal(calls, 1, "Cached previews avoid another provider charge");
  } finally {
    globalThis.fetch = network;
    if (priorKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = priorKey;
  }
  const { POST: preview } = await import("../app/api/preview/route");
  assert.equal(
    (
      await preview(
        req(
          "/api/preview",
          { topic: "DBMS normalization", language: "english" },
          "",
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await preview(
        req("/api/preview", { topic: "a", language: "english" }, ""),
      )
    ).status,
    400,
  );
  const m = await import("../lib/growth/metrics"),
    visitor = randomUUID();
  await m.ownerMetric(user.id, "paid", "fixture-invoice");
  assert.equal((await m.metricsReport()).visitors, 0);
  await m.recordMetric(visitor, "visit", randomUUID());
  await m.setMeasurementConsent(user.id, true);
  await m.recordMetric(visitor, "signup_created", user.id, user.id);
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      m.recordMetric(visitor, "quiz_used", "attempt-" + i, user.id),
    ),
  );
  assert.equal((await m.metricsReport()).visitors, 1);
  const key = createHash("sha256")
    .update("account:" + user.id)
    .digest("hex");
  let row: any;
  if (mongo)
    row = (await (
      await (await import("../lib/storage/mongo")).collection("growth_metrics")
    ).findOne({ _id: key }))!.payload;
  else
    row = JSON.parse(
      String(
        (await import("../lib/db"))
          .db()
          .prepare("SELECT payload FROM growth_metrics WHERE id=?")
          .get(key)!.payload,
      ),
    );
  assert.equal(
    row.events.filter((e: any) => e.name === "quiz_used").length,
    20,
    "Concurrent events must survive",
  );
  await m.recordMetric(visitor, "quiz_used", "attempt-0", user.id);
  assert.equal((await m.metricsReport()).quiz, 1);
  await m.setMeasurementConsent(user.id, false);
  assert.equal((await m.metricsReport()).visitors, 0);
  const { GET: admin } = await import("../app/api/admin/growth/route");
  assert.equal((await admin(req("/api/admin/growth"))).status, 403);
  const { STUDENT_MONTHLY_TIERS, purchasableMonthlyTier } =
      await import("../lib/billing/subscription-plans"),
    { purchasablePack } = await import("../lib/billing/packs");
  assert.deepEqual(STUDENT_MONTHLY_TIERS, ["max"]);
  assert.equal(purchasableMonthlyTier("popular"), null);
  for (const id of ["try", "starter", "popular"])
    assert.equal(purchasablePack(id), true);
  assert.equal(purchasablePack("pro"), false);
  const jobs = await import("../lib/jobs/store"),
    job = await jobs.createJob(user.id, ["DBMS"], "concise", {
      context: "Original private source",
    });
  const { POST: report } = await import("../app/api/student/report/route");
  assert.equal(
    (
      await report(
        req(
          "/api/student/report",
          {
            lesson: job.id,
            detail: "Please check this explanation of dependencies.",
          },
          foreign,
        ),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await report(
        req("/api/student/report", {
          lesson: job.id,
          detail: "Please check this explanation of dependencies.",
        }),
      )
    ).status,
    201,
  );
  assert.equal(
    (await (await import("../lib/support")).listTickets(user.id)).length,
    1,
  );
  console.log(
    "PASS growth: UG/PG preferences, language, replay-safe goals, six original previews, validation, concurrent consent metrics, admin isolation, current checkout policy, owner-scoped error reports (" +
      (mongo ? "Mongo" : "SQLite") +
      ")",
  );
  if (mongo) {
    const { client } = await (await import("../lib/storage/mongo")).mongo();
    await client.close();
    await mongo.stop();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
