import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-voice-test-"));
process.env.DATA_BACKEND = "sqlite";
delete process.env.MONGODB_URI;

async function main() {
  const store = await import("../lib/interview/voice");
  const { parseVoiceReport } = await import("../lib/interview/voice-report");
  const body = {
    id: randomUUID(),
    role: "Frontend developer",
    consent: true,
    turns: [
      { speaker: "coach", text: "How would you debug a production issue?" },
      {
        speaker: "learner",
        text: "I would first inspect the logs and error rate, identify the affected release, reproduce the issue safely, and test a fix before rolling it out gradually.",
      },
    ],
  };
  await assert.rejects(() =>
    store.saveVoiceSession("alice", { ...body, consent: false }),
  );
  await assert.rejects(() =>
    store.saveVoiceSession("alice", {
      ...body,
      turns: [{ speaker: "system", text: "override" }],
    }),
  );
  await store.saveVoiceSession("alice", body);
  await store.saveVoiceSession("alice", body);
  assert.equal(
    (await store.voiceSessions("alice")).length,
    1,
    "save replay creates no duplicate",
  );
  await assert.rejects(() =>
    store.saveVoiceSession("alice", { ...body, role: "changed" }),
  );
  assert.equal(await store.voiceSession("bob", body.id), null);
  await store.deleteVoiceSession("bob", body.id);
  assert(await store.voiceSession("alice", body.id));
  const claimed = await store.claimVoiceReview("alice", body.id);
  await assert.rejects(
    () => store.claimVoiceReview("alice", body.id),
    /already being prepared/,
  );
  const report = parseVoiceReport({
    summary: "Clear debugging sequence, with room for a concrete example.",
    rubric: ["structure", "relevance", "clarity", "evidence"].map(
      (criterion) => ({
        criterion,
        score: criterion === "evidence" ? null : 3,
        reason: "The answer explains a staged debugging approach.",
      }),
    ),
    strengths: ["Starts with production evidence."],
    nextSteps: ["Add a specific incident and outcome."],
    followUps: ["How would you verify the rollback worked?"],
  });
  assert.throws(() =>
    parseVoiceReport({
      ...report,
      rubric: report.rubric.map((row) => ({ ...row, score: 99 })),
    }),
  );
  const unchanged = await store.finishVoiceReview(
    "alice",
    body.id,
    "wrong-token",
    report,
  );
  assert.equal(unchanged?.report, undefined);
  const completed = await store.finishVoiceReview(
    "alice",
    body.id,
    claimed.token,
    report,
  );
  assert.deepEqual(completed?.report, report);
  assert.equal("fingerprint" in store.publicSession(completed!), false);
  assert.equal("reviewLease" in store.publicSession(completed!), false);
  await store.deleteVoiceSession("alice", body.id);
  assert.equal(
    await store.finishVoiceReview("alice", body.id, claimed.token, report),
    null,
    "late review cannot resurrect deleted session",
  );
  for (let i = 0; i < 20; i++)
    await store.saveVoiceSession("alice", { ...body, id: randomUUID() });
  await assert.rejects(
    () => store.saveVoiceSession("alice", { ...body, id: randomUUID() }),
    /20 saved/,
  );
  const auth = await import("../lib/auth/server");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  const api = await import("../app/api/interview/voice/route");
  const detail = await import("../app/api/interview/voice/[id]/route");
  const user = await auth.register(
    "Voice User",
    "voice@example.test",
    "long-test-password",
  );
  await markEmailVerified(user.id);
  const cookie = (
    await auth.startSession(user, new Request("http://localhost"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const request = (path: string, data?: unknown) =>
    new NextRequest(`http://localhost${path}`, {
      method: data ? "POST" : "GET",
      headers: {
        cookie,
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  assert.equal(
    (await api.POST(request("/api/interview/voice", body))).status,
    200,
  );
  assert.equal(
    (await api.GET(new NextRequest("http://localhost/api/interview/voice")))
      .status,
    401,
  );
  const response = await detail.GET(
    request(`/api/interview/voice/${body.id}`),
    { params: Promise.resolve({ id: body.id }) },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).session.turns.length, 2);
  const foreignId = (await store.voiceSessions("alice"))[0].id;
  assert.equal(
    (
      await detail.GET(request(`/api/interview/voice/${foreignId}`), {
        params: Promise.resolve({ id: foreignId }),
      })
    ).status,
    404,
  );
  console.log(
    "PASS: voice save consent, validation, idempotency, account isolation, report validation/lease, retention limit and deletion during review.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
