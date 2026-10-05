import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import sharp from "sharp";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-studio-test-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.WORKER_MODE = "external";
process.env.APP_ROLE = "all";
async function main() {
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { balance } = await import("../lib/credits/store");
  const owner = await auth.register(
      "Studio owner",
      "studio-owner@example.test",
      "safe-test-password",
    ),
    other = await auth.register(
      "Other",
      "studio-other@example.test",
      "safe-test-password",
    );
  await markEmailVerified(owner.id);
  await markEmailVerified(other.id);
  const cookie = async (u: any) =>
    (await auth.startSession(u, new Request("http://localhost:3150"))).headers
      .get("set-cookie")!
      .split(";")[0];
  const own = await cookie(owner),
    foreign = await cookie(other);
  const req = (c: string, b?: unknown, path = "/api/student/quiz") =>
    new NextRequest("http://localhost:3150" + path, {
      method: b ? "POST" : "GET",
      headers: { cookie: c, "Content-Type": "application/json" },
      body: b ? JSON.stringify(b) : undefined,
    });
  const jobs = await import("../lib/jobs/store"),
    quiz = await import("../app/api/student/quiz/route"),
    hub = await import("../app/api/student/hub/route"),
    study = await import("../app/api/study/route"),
    { questionId, answerCorrect } = await import("../lib/study/quiz"),
    { streakFor, dayAt, scheduleExam, stableCardId } =
      await import("../lib/study/hub");
  const { timestampedVtt } = await import("../lib/youtube/transcript");
  assert.equal(
    timestampedVtt(
      "WEBVTT\n\n00:01:02.500 --> 00:01:05.000\nFirst principle\n\n",
    ),
    "[T:62.500] First principle",
  );
  assert.equal(timestampedVtt("No timed captions"), "");
  const job = await jobs.createJob(owner.id, ["Cells"], "concise", {
    context: "PRIVATE CELL SOURCE",
  });
  const lease = (await jobs.claimJob(job.id))!;
  await jobs.commitPage(job.id, lease.token, 0, {
    topic: "Cells",
    markdown: "## Cells\nPrivate cytoplasm evidence",
    provider: "fixture",
    model: "fixture",
  });
  await jobs.finishJob(job.id, lease.token);
  const questions = [
    {
      q: "Select the preserved object",
      type: "mcq" as const,
      options: ["Original", "Copy"],
      answer: "Original",
    },
    { q: "Name the cell type", type: "short" as const, answer: "Eukaryote" },
  ];
  await jobs.updateJob(job.id, {
    practice: {
      quiz: questions,
      flashcards: [{ front: "Cell?", back: "Basic unit" }],
    },
  });
  assert(answerCorrect(questions[1], " eukaryote. "));
  assert(!answerCorrect(questions[1], "Prokaryote"));
  assert.equal(
    (
      await quiz.POST(
        req(foreign, { action: "start", lesson: job.id, mode: "practice" }),
      )
    ).status,
    404,
  );
  const act = async (b: any) => {
    const r = await quiz.POST(req(own, { lesson: job.id, ...b }));
    assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
    return r.json();
  };
  let a = await act({ action: "start", mode: "practice" });
  const first = a.attempt.id;
  a = await act({
    action: "answer",
    attempt: first,
    question: questionId(questions[0], 0),
    answer: "Copy",
  });
  assert.equal(a.feedback[0].correct, false);
  a = await act({
    action: "answer",
    attempt: first,
    question: questionId(questions[0], 0),
    answer: "Original",
  });
  assert.equal(
    a.attempt.answers[questionId(questions[0], 0)],
    "Copy",
    "First practice answer cannot be replaced",
  );
  await act({
    action: "answer",
    attempt: first,
    question: questionId(questions[1], 1),
    answer: "eukaryote.",
  });
  a = await act({ action: "submit", attempt: first });
  assert.equal(a.attempt.correct, 1);
  await act({ action: "submit", attempt: first });
  const state = await import("../lib/study/state");
  assert.equal(
    (await state.readState<any>(owner.id, "learning", {})).attempts.length,
    1,
  );
  a = await act({ action: "start", mode: "exam" });
  const exam = a.attempt.id;
  for (let i = 0; i < 2; i++) {
    a = await act({
      action: "answer",
      attempt: exam,
      question: questionId(questions[i], i),
      answer: questions[i].answer,
    });
    assert.deepEqual(a.feedback, []);
  }
  a = await act({ action: "submit", attempt: exam });
  assert.equal(a.attempt.correct, 2);
  assert.equal(
    (
      await hub.POST(
        req(
          own,
          { action: "draft", revision: 0, draft: { text: "cell lesson" } },
          "/api/student/hub",
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await hub.POST(
        req(
          own,
          { action: "draft", revision: 0, draft: { text: "stale" } },
          "/api/student/hub",
        ),
      )
    ).status,
    409,
  );
  const ownHub = await (
      await hub.GET(req(own, undefined, "/api/student/hub?q=cytoplasm"))
    ).json(),
    otherHub = await (
      await hub.GET(req(foreign, undefined, "/api/student/hub?q=cytoplasm"))
    ).json();
  assert.equal(ownHub.results.length, 1);
  assert.equal(otherHub.results.length, 0);
  const now = Date.UTC(2026, 9, 5, 22);
  assert.equal(dayAt(now, "Asia/Kolkata"), "2026-10-06");
  assert.equal(streakFor(["2026-10-05", "2026-10-06"], "Asia/Kolkata", now), 2);
  assert.throws(() =>
    scheduleExam({
      name: "bad",
      date: "2027-02-30",
      minutes: 30,
      topics: "Cells",
    }),
  );
  const card = stableCardId({ front: "Cell?", back: "Basic unit" }),
    review = {
      action: "review",
      lesson: job.id,
      index: 0,
      event: randomUUID(),
      rating: "good",
    };
  await study.POST(req(own, review, "/api/study"));
  await study.POST(req(own, { ...review, event: randomUUID() }, "/api/study"));
  await study.POST(req(own, review, "/api/study"));
  assert.equal(
    (await state.readState<any>(owner.id, "learning", {})).reviews[job.id][card]
      .repetitions,
    2,
  );
  const drafts = await import("../lib/presentations/drafts"),
    store = await import("../lib/presentations/store"),
    ops = await import("../lib/presentations/operations"),
    { validateSlide, validateObject } =
      await import("../lib/presentations/model");
  await assert.rejects(() =>
    drafts.ownedSources(other.id, [{ kind: "lesson", id: job.id }]),
  );
  const sources = await drafts.ownedSources(owner.id, [
    { kind: "lesson", id: job.id },
  ]);
  const before = await balance(owner.id);
  const draft = await drafts.planDeck(
    owner.id,
    {
      prompt: "Explain cells for biology students",
      language: "english",
      template: "editorial",
      count: 4,
      sources,
      audience: "Students",
      format: "detailed",
    },
    randomUUID(),
    async () => ({
      text: JSON.stringify({
        outline: ["Cells", "Structure", "Compare", "Summary"],
      }),
      provider: "fixture",
    }),
  );
  assert.equal(await balance(owner.id), before, "Planning must not charge");
  const approved = await drafts.approveDraft(
    owner.id,
    draft.id,
    0,
    draft.outline,
  );
  assert.equal(approved.revision, 1);
  assert.equal(
    (await drafts.approveDraft(owner.id, draft.id, 0, draft.outline)).revision,
    1,
  );
  await assert.rejects(() =>
    drafts.approveDraft(other.id, draft.id, 1, draft.outline),
  );
  const id = "deck-" + draft.id,
    input = {
      prompt: draft.prompt,
      context: "PRIVATE SOURCE",
      language: "english",
      template: "editorial" as const,
      count: 4,
      outline: draft.outline,
      sources,
    };
  await Promise.all([
    store.createDeck(owner.id, input, id),
    store.createDeck(owner.id, input, id),
  ]);
  assert.equal(await balance(owner.id), before - 5);
  await assert.rejects(() => ops.createDeckShare(owner.id, id));
  const fixture = (title: string) => ({
    title,
    layout: "points",
    subtitle: "",
    bullets: ["A concise explanation."],
    columns: [],
    steps: [],
    table: [],
    chart: null,
    notes: "PRIVATE SPEAKER NOTES",
    citations: [],
    evidence: [sources[0].id],
  });
  for (let i = 0; i < 4; i++)
    await store.processDeck(id, async () => ({
      text: JSON.stringify(fixture("Cells " + i)),
      provider: "fixture",
    }));
  let deck = (await store.ownedDeck(owner.id, id))!;
  assert.equal(deck.status, "done");
  assert.equal(new Set(deck.slides.map((s) => s.id)).size, 4);
  assert.throws(() =>
    validateObject({
      id: "object-1234",
      type: "text",
      text: "outside",
      x: 90,
      y: 2,
      w: 30,
      h: 20,
      fontSize: 20,
      color: "#000000",
      align: "left",
    }),
  );
  const { uploadWritingImage } = await import("../lib/writing/images"),
    bytes = await sharp({
      create: { width: 100, height: 70, channels: 3, background: "#214d41" },
    })
      .png()
      .toBuffer();
  const foreignImage = await uploadWritingImage(
    other.id,
    bytes,
    "Other private image",
  );
  const object = {
    id: "object-1234",
    type: "image",
    text: "",
    x: 10,
    y: 20,
    w: 40,
    h: 50,
    fontSize: 20,
    color: "#000000",
    align: "left",
    imageId: foreignImage.id,
    imageAlt: "Private image",
  };
  await assert.rejects(() =>
    store.editDeck(
      owner.id,
      id,
      [{ ...deck.slides[0], objects: [object] }],
      deck.updatedAt,
    ),
  );
  await assert.rejects(() =>
    store.editDeck(
      owner.id,
      id,
      [{ ...deck.slides[0], evidence: ["fabricated"] }],
      deck.updatedAt,
    ),
  );
  deck = await store.editDeck(
    owner.id,
    id,
    [{ ...deck.slides[0], title: "Changed" }, ...deck.slides.slice(1)],
    deck.updatedAt,
  );
  assert.equal(deck.history!.length, 1);
  await assert.rejects(() =>
    store.editDeck(owner.id, id, deck.slides, "stale"),
  );
  deck = await ops.restoreDeck(
    owner.id,
    id,
    deck.history![0].id,
    deck.updatedAt,
    6,
  );
  assert.equal(deck.slides[0].title, "Cells 0");
  const wallet = await balance(owner.id),
    event = randomUUID();
  const regen = await ops.queueSlide(
    owner.id,
    id,
    deck.slides[0].id!,
    "Make the heading concise",
    event,
  );
  assert.equal(
    (
      await ops.queueSlide(
        owner.id,
        id,
        deck.slides[0].id!,
        "Make the heading concise",
        event,
      )
    ).id,
    regen.id,
  );
  assert.equal(await balance(owner.id), wallet - 1);
  await ops.runSlide(regen.id, async () => {
    throw new Error("fixture failure");
  });
  assert.equal(await balance(owner.id), wallet);
  await ops.runSlide(regen.id, async () => {
    throw new Error("should not run");
  });
  assert.equal(await balance(owner.id), wallet);
  const successful = await ops.queueSlide(
    owner.id,
    id,
    deck.slides[0].id!,
    "Improve this slide heading",
    randomUUID(),
  );
  await ops.runSlide(successful.id, async () => ({
    text: JSON.stringify(fixture("Improved")),
    provider: "fixture",
  }));
  assert.equal(
    (await store.ownedDeck(owner.id, id))!.slides[0].title,
    "Improved",
  );
  assert.equal(await balance(owner.id), wallet - 1);
  const share = await ops.createDeckShare(owner.id, id),
    shareRoute = await import("../app/api/presentations/share/[token]/route");
  const commentBody = {
    slide: deck.slides[0].id,
    text: "Review the heading",
    event: randomUUID(),
  };
  assert.equal(
    (
      await shareRoute.POST(
        req(foreign, commentBody, "/api/presentations/share/" + share.token),
        { params: Promise.resolve({ token: share.token }) },
      )
    ).status,
    200,
  );
  await shareRoute.POST(
    req(foreign, commentBody, "/api/presentations/share/" + share.token),
    { params: Promise.resolve({ token: share.token }) },
  );
  assert.equal((await ops.deckShares(id)).comments.length, 1);
  const shared = await shareRoute.GET(
    req("", undefined, "/api/presentations/share/" + share.token),
    { params: Promise.resolve({ token: share.token }) },
  );
  assert.equal(shared.status, 200);
  const publicText = JSON.stringify(await shared.json());
  assert(!publicText.includes("PRIVATE"));
  assert(!publicText.includes(owner.id));
  await ops.revokeDeckShare(owner.id, id, share.id);
  assert.equal(await ops.sharedDeck(share.token), null);
  assert.equal(
    (
      await shareRoute.POST(
        req(foreign, commentBody, "/api/presentations/share/" + share.token),
        { params: Promise.resolve({ token: share.token }) },
      )
    ).status,
    404,
  );
  const { deckHtml, visualExport } =
      await import("../lib/presentations/visual-export"),
    { exportDeck } = await import("../lib/presentations/export");
  deck = (await store.ownedDeck(owner.id, id))!;
  deck.slides[1] = validateSlide({
    ...fixture("Signed data"),
    layout: "chart",
    chart: {
      labels: ["Loss", "Gain"],
      values: [-5, 10],
      label: "Change (units)",
    },
  });
  deck.slides[2] = validateSlide({
    ...fixture("Table"),
    layout: "table",
    table: [
      ["Name", "Value"],
      ["Cell", ""],
    ],
  });
  assert((await deckHtml(deck)).includes("deck-zero"));
  const dir = join(process.cwd(), "output/live-audit/studio");
  mkdirSync(dir, { recursive: true });
  const png = await visualExport(deck, "png", 1),
    pdf = await visualExport(deck, "pdf"),
    notes = await visualExport(deck, "notes"),
    pptx = await exportDeck(deck);
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.equal(pptx.subarray(0, 2).toString(), "PK");
  writeFileSync(join(dir, "signed-chart.png"), png);
  writeFileSync(join(dir, "preview.pdf"), pdf);
  writeFileSync(join(dir, "notes.pdf"), notes);
  writeFileSync(join(dir, "editable.pptx"), pptx);
  const abuse = await import("../lib/security/abuse");
  process.env.SECURITY_HASH_SALT = "fixture-private-salt";
  process.env.TRUST_PROXY_HEADERS = "true";
  process.env.BACKEND_PROXY_SECRET = "fixture-proxy";
  const probe = new Request("http://localhost:3150/api/credits", {
    headers: {
      "x-backend-proxy-secret": "fixture-proxy",
      "x-forwarded-for": "203.0.113.8",
    },
  });
  for (let i = 0; i < 12; i++) await abuse.recordTrap(probe, "path-probe");
  assert.equal((await abuse.abuseGuard(probe))?.status, 429);
  assert.equal(
    await abuse.abuseGuard(new Request("http://localhost:3150/api/credits")),
    null,
  );
  assert(
    !JSON.stringify(await abuse.recentIncidents()).includes("203.0.113.8"),
  );
  const recovery = await import("../lib/auth/recovery"),
    credential = await auth.accountByEmail(owner.email),
    resetToken = await recovery.issueReset({
      id: owner.id,
      password: String(credential!.password),
    });
  const previousToken = await recovery.issueReset({
    id: owner.id,
    password: String(credential!.password),
  });
  await assert.rejects(() =>
    recovery.resetPassword(resetToken, "new-safe-password"),
  );
  const results = await Promise.allSettled([
    recovery.resetPassword(previousToken, "new-safe-password"),
    recovery.resetPassword(previousToken, "other-safe-password"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await auth.currentUser(req(own)),
    null,
    "Reset revokes the old session",
  );
  await assert.rejects(() =>
    recovery.resetPassword(previousToken, "replay-safe-password"),
  );
  const updated = await auth.accountByEmail(owner.email);
  assert(
    auth.passwordMatches(
      results[0].status === "fulfilled"
        ? "new-safe-password"
        : "other-safe-password",
      String(updated!.password),
    ),
  );
  console.log(
    "PASS student/studio: authoritative quiz, private hub, draft conflicts, timezone streak, replay-safe review, owned sources/assets, single-charge generation, revisions, regeneration refunds, private revocable shares, PNG/PDF/PPTX output, and sanitized honeypot.",
  );
}
async function run() {
  let replica: import("mongodb-memory-server").MongoMemoryReplSet | undefined;
  try {
    if (process.argv.includes("--mongo")) {
      replica = await (
        await import("mongodb-memory-server")
      ).MongoMemoryReplSet.create({
        replSet: { count: 1 },
        binary: { version: "8.0.12" },
      });
      process.env.MONGODB_URI = replica.getUri();
      process.env.DATA_BACKEND = "mongo";
      process.env.MONGODB_DATABASE = "student_studio_test";
    }
    await main();
  } finally {
    if (replica) {
      await (
        await (await import("../lib/storage/mongo")).mongo()
      ).client.close();
      await replica.stop();
    }
  }
}
run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
