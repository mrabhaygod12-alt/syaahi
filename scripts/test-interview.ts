import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-interview-test-"));
process.env.DATA_BACKEND = "sqlite";
delete process.env.MONGODB_URI;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;

async function main() {
  const auth = await import("../lib/auth/server");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  const interview = await import("../app/api/interview/route");
  const request = (cookie: string, body?: unknown) =>
    new NextRequest("http://localhost:3101/api/interview", {
      method: body ? "POST" : "GET",
      headers: { cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

  const user = await auth.register(
    "Practice user",
    "interview@example.test",
    "long-test-password",
  );
  await markEmailVerified(user.id);
  const cookie = (await auth.startSession(user, request(""))).headers
    .get("set-cookie")!
    .split(";")[0];

  const created = await interview.POST(
    request(cookie, {
      action: "plan",
      track: "Software engineering",
      targetRole: "Frontend developer",
      jobDescription: "Build accessible, resilient web interfaces.",
    }),
  );
  assert.equal(created.status, 200);
  const data = await created.json();
  assert.equal(data.session.questions.length, 5);
  assert.equal(data.session.track, "Software engineering");
  assert.equal(data.session.targetRole, "Frontend developer");
  assert(
    data.session.questions.every(
      (item: { question: string; competency: string; guidance: string }) =>
        item.question && item.competency && item.guidance,
    ),
  );

  const history = await interview.GET(request(cookie));
  assert.equal(history.status, 200);
  const saved = await history.json();
  assert.equal(saved.sessions.length, 1);
  assert.equal(saved.sessions[0].total, 5);
  assert.equal(saved.sessions[0].completed, 0);
  const reopened = await interview.GET(
    new NextRequest(
      `http://localhost:3101/api/interview?session=${data.session.id}`,
      {
        headers: { cookie },
      },
    ),
  );
  assert.equal(reopened.status, 200);
  assert.equal((await reopened.json()).session.id, data.session.id);
  console.log(
    "PASS: authenticated role plan is saved with five safe fallback questions and history.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
