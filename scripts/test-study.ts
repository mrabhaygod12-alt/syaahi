import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-study-test-"));
delete process.env.MONGODB_URI;
process.env.DATA_BACKEND = "sqlite";
async function main() {
  const auth = await import("../lib/auth/server");
  const jobs = await import("../lib/jobs/store");
  const study = await import("../app/api/study/route");
  const collaboration = await import("../app/api/collaboration/route");
  const shares = await import("../app/api/share/route");
  const lesson = await import("../app/api/jobs/[id]/route");
  const req = (cookie: string, body?: unknown, path = "/api/study") =>
    new NextRequest("http://localhost:3101" + path, {
      method: body ? "POST" : "GET",
      headers: { cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const owner = await auth.register(
    "Owner",
    "owner@example.test",
    "long-test-password",
  );
  const member = await auth.register(
    "Member",
    "member@example.test",
    "long-test-password",
  );
  const ownerCookie = (await auth.startSession(owner, req(""))).headers
    .get("set-cookie")!
    .split(";")[0];
  const memberCookie = (await auth.startSession(member, req(""))).headers
    .get("set-cookie")!
    .split(";")[0];
  const job = await jobs.createJob(owner.id, ["Evidence handling"], "concise", {
    context: "PRIVATE SOURCE TEXT",
  });
  const lease = (await jobs.claimJob(job.id))!;
  await jobs.commitPage(job.id, lease.token, 0, {
    topic: "Evidence handling",
    markdown: "## Evidence\nPreserve the original and document each transfer.",
    provider: "test",
    model: "fixture",
  });
  await jobs.finishJob(job.id, lease.token);
  await jobs.updateJob(job.id, {
    practice: {
      quiz: [
        {
          q: "What is preserved?",
          type: "mcq",
          options: ["Original", "Nothing", "A label", "A guess"],
          answer: "Original",
        },
      ],
      flashcards: [{ front: "What is preserved?", back: "The original." }],
    },
  });
  const params = { params: Promise.resolve({ id: job.id }) };
  assert.equal((await lesson.GET(req(memberCookie), params)).status, 404);
  const created = await collaboration.POST(
    req(ownerCookie, { action: "create", lesson: job.id, role: "viewer" }),
  );
  assert.equal(created.status, 200);
  const invite = await created.json();
  const token = invite.url.split("/").pop();
  const publicResponse = await shares.POST(req("", { token }));
  assert.equal(publicResponse.status, 200);
  assert(
    !JSON.stringify(await publicResponse.json()).includes("PRIVATE SOURCE"),
  );
  assert.equal(
    (await collaboration.POST(req(memberCookie, { action: "join", token })))
      .status,
    200,
  );
  const shared = await lesson.GET(req(memberCookie), params);
  assert.equal(shared.status, 200);
  assert.equal((await shared.json()).context, null);
  assert.equal(
    (
      await lesson.POST(
        req(memberCookie, {
          action: "edit-page",
          index: 0,
          revision: 1,
          markdown: "This edit must not be accepted from a viewer.",
        }),
        params,
      )
    ).status,
    403,
  );
  const editorInvite = await (
    await collaboration.POST(
      req(ownerCookie, { action: "create", lesson: job.id, role: "editor" }),
    )
  ).json();
  await collaboration.POST(
    req(memberCookie, {
      action: "join",
      token: editorInvite.url.split("/").pop(),
    }),
  );
  const original = (await jobs.getJob(job.id))!;
  const edit = {
    action: "edit-page",
    index: 0,
    revision: original.revision || 0,
    markdown: "## Evidence\nPreserve originals and maintain a transfer record.",
  };
  assert.equal(
    (await lesson.POST(req(memberCookie, edit), params)).status,
    200,
  );
  assert.equal((await lesson.POST(req(ownerCookie, edit), params)).status, 409);
  assert.equal(
    (
      await lesson.POST(
        req(memberCookie, { action: "progress", completed: [0] }),
        params,
      )
    ).status,
    200,
  );
  assert.deepEqual((await jobs.getJob(job.id))!.progress?.completed, []);
  await jobs.updateJob(job.id, { practice: original.practice });
  const folder = await (
    await study.POST(req(ownerCookie, { action: "folder", name: "Forensics" }))
  ).json();
  const folderId = folder.folders[0].id;
  assert.equal(
    (
      await study.POST(
        req(ownerCookie, {
          action: "assign",
          folder: folderId,
          lesson: job.id,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await study.POST(
        req(memberCookie, {
          action: "quiz-attempt",
          lesson: job.id,
          answers: ["Original"],
        }),
      )
    ).status,
    200,
  );
  const event = {
    action: "review",
    lesson: job.id,
    index: 0,
    rating: "good",
    event: "review-event-unique-123",
  };
  assert.equal((await study.POST(req(memberCookie, event))).status, 200);
  await study.POST(req(memberCookie, event));
  const state = await (await study.GET(req(memberCookie))).json();
  assert.equal(state.attempts[0].correct, 1);
  assert.equal(Object.values<any>(state.reviews[job.id])[0].repetitions, 1);
  assert(Object.values<any>(state.reviews[job.id])[0].due > Date.now());
  assert.equal(
    (
      await collaboration.POST(
        req(memberCookie, {
          action: "comment",
          lesson: job.id,
          section: 0,
          text: "Can we add a transfer example?",
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await collaboration.POST(
        req(ownerCookie, {
          action: "revoke",
          lesson: job.id,
          link: editorInvite.id,
        }),
      )
    ).status,
    200,
  );
  assert.equal((await lesson.GET(req(memberCookie), params)).status, 404);
  assert.equal(
    (await shares.POST(req("", { token: editorInvite.url.split("/").pop() })))
      .status,
    404,
  );
  const ownerState = await (await study.GET(req(ownerCookie))).json();
  assert.deepEqual(ownerState.folders[0].lessons, [job.id]);
  assert.equal(ownerState.attempts.length, 0);
  console.log(
    "PASS: private access, public source redaction, viewer/editor permissions, stale edit conflict, independent progress, folders, quiz scoring, review replay and due dates, comments, invitation revocation.",
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
