import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  evidenceLines,
  fixtureSource,
  fixtureGenerate,
  fixtureDraft,
} from "./hybrid-fixture";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-hybrid-test-"));
Object.assign(process.env, {
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  WORKER_MODE: "external",
  APP_ROLE: "all",
  PRESENTATION_VIDEO_ENABLED: "false",
});
async function main() {
  const { register } = await import("../lib/auth/server"),
    { balance, grant } = await import("../lib/credits/store"),
    { record, mutateRecord } = await import("../lib/workspace-records");
  const user = await register(
      "Hybrid fixture",
      "hybrid@example.test",
      "safe-fixture-password",
    ),
    other = await register(
      "Other",
      "hybrid-other@example.test",
      "safe-fixture-password",
    );
  await grant(user.id, 50);
  const { createDeck, processDeck, ownedDeck, editDeck, retryDeck } =
      await import("../lib/presentations/store"),
    { approveDraft, ownedDraft, planDeck } =
      await import("../lib/presentations/drafts"),
    { planHybrid, manifestForBeat, manifestSlide, validateHybridPlan } =
      await import("../lib/presentations/hybrid/pipeline"),
    { verifyFacts, factFromQuote, allocateBudget } =
      await import("../lib/presentations/hybrid/grounding"),
    { validateManifest, DEFAULT_GENOME } =
      await import("../lib/presentations/hybrid/model"),
    { inspectManifestSlides } =
      await import("../lib/presentations/hybrid/quality"),
    ops = await import("../lib/presentations/operations");
  const before = await balance(user.id),
    draft = await fixtureDraft(user.id);
  assert.equal(await balance(user.id), before);
  assert.equal(await ownedDraft(other.id, draft.id), null);
  assert.equal(
    draft.hybridPlan!.context.characters,
    draft.sources[0].text.length,
  );
  assert.equal(draft.hybridPlan!.facts[4].pageNumber, 2);
  assert.equal(
    factFromQuote(
      { ...fixtureSource, text: "[page 999]\n" + evidenceLines[0] },
      evidenceLines[0],
    ).pageNumber,
    undefined,
    "Plain source text cannot forge document page metadata",
  );
  const changed = {
    ...draft.hybridPlan!,
    beats: draft.hybridPlan!.beats.map((b, i) => ({
      ...b,
      title: i === 1 ? "Protect atomic work" : b.title,
    })),
  };
  const approved = await approveDraft(
    user.id,
    draft.id,
    0,
    changed.beats.map((b) => b.title),
    { hybridPlan: changed },
  );
  assert.equal(approved.revision, 1);
  assert.equal(
    (
      await approveDraft(user.id, draft.id, 0, approved.outline, {
        hybridPlan: approved.hybridPlan,
      })
    ).revision,
    1,
  );
  await assert.rejects(
    () =>
      approveDraft(user.id, draft.id, 0, approved.outline, {
        hybridPlan: {
          ...approved.hybridPlan!,
          genome: { ...DEFAULT_GENOME, name: "Changed" },
        },
      }),
    /changed/,
  );
  const input = {
      prompt: approved.prompt,
      context: "PRIVATE_CONTEXT",
      language: approved.language,
      template: approved.template,
      count: approved.count,
      outline: approved.outline,
      sources: approved.sources,
      designEngine: 3 as const,
      hybridPlan: approved.hybridPlan,
    },
    id = randomUUID();
  await Promise.all([
    createDeck(user.id, input, id),
    createDeck(user.id, input, id),
  ]);
  assert.equal(await balance(user.id), before - 5);
  await processDeck(id);
  let deck = (await ownedDeck(user.id, id))!;
  assert.equal(deck.status, "done", deck.error || JSON.stringify(deck.quality));
  assert.equal(deck.quality?.status, "passed");
  assert.equal(await ownedDeck(other.id, id), null);
  assert.equal(deck.slides.length, 6);
  const { studioLibrary } = await import("../lib/presentations/hybrid/library");
  const metadata = JSON.stringify(await studioLibrary(user.id));
  assert(!metadata.includes("PRIVATE_CONTEXT"));
  assert(!metadata.includes('"sources"'));
  assert(!metadata.includes('"hybridPlan"'));
  assert.equal((await studioLibrary(other.id)).decks.length, 0);
  const manifests = deck.slides.map((s) => s.manifest!);
  verifyFacts(manifests, deck.sources!);
  assert.throws(() =>
    verifyFacts(
      [
        {
          ...manifests[0],
          facts: [{ ...manifests[0].facts[0], statement: "Invented result" }],
        },
      ],
      deck.sources!,
    ),
  );
  assert.throws(() =>
    verifyFacts(
      [
        {
          ...manifests[0],
          facts: [{ ...manifests[0].facts[0], pageNumber: 99 }],
        },
      ],
      deck.sources!,
    ),
  );
  assert.throws(() =>
    validateManifest({
      ...manifests[0],
      visual: { ...manifests[0].visual, seed: Infinity },
    }),
  );
  assert.throws(() =>
    validateManifest({
      ...manifests[0],
      headline: "One two three four five six seven eight nine",
    }),
  );
  assert.throws(() =>
    factFromQuote(fixtureSource, "This claim is not in this source material."),
  );
  assert.throws(() =>
    validateHybridPlan(
      {
        ...draft.hybridPlan,
        facts: [
          {
            ...draft.hybridPlan!.facts[0],
            start: draft.hybridPlan!.facts[0].start + 1,
          },
          ...draft.hybridPlan!.facts.slice(1),
        ],
      },
      draft.sources,
      6,
    ),
  );
  assert.equal(
    allocateBudget(
      30,
      Array.from({ length: 30 }, (_, i) => ({
        ...draft.hybridPlan!.facts[0],
        id: String(i),
      })),
      30,
      9,
    ).allocated,
    20,
  );
  let repairs = 0;
  await assert.rejects(() =>
    planHybrid(
      {
        prompt: input.prompt,
        audience: "Students",
        language: "english",
        count: 6,
        sources: draft.sources,
        planCap: 30,
        balance: 50,
      },
      async () => {
        repairs++;
        return {
          text: JSON.stringify({
            facts: [
              {
                sourceId: fixtureSource.id,
                exactQuote:
                  "Fabricated evidence does not belong to the source.",
              },
            ],
          }),
          provider: "fixture",
        };
      },
    ),
  );
  assert.equal(repairs, 2, "Extraction repair is bounded");
  const changedSlides = deck.slides.map((s, i) =>
    i
      ? s
      : manifestSlide(
          {
            ...s.manifest!,
            headline: "Keep database changes safe",
            notes: "PRIVATE_SPEAKER_NOTES",
          },
          deck.sources!,
        ),
  );
  deck = await editDeck(user.id, id, changedSlides, deck.updatedAt);
  assert.equal(deck.status, "queued");
  assert.equal(deck.creditsReserved, 0);
  await processDeck(id);
  deck = (await ownedDeck(user.id, id))!;
  assert.equal(deck.status, "done");
  assert.equal(await balance(user.id), before - 5);
  await assert.rejects(() =>
    editDeck(other.id, id, deck.slides, deck.updatedAt),
  );
  await assert.rejects(() => editDeck(user.id, id, deck.slides, "stale"));
  await assert.rejects(() =>
    editDeck(user.id, id, [...deck.slides, deck.slides[0]], deck.updatedAt),
  );
  const wallet = await balance(user.id),
    event = randomUUID(),
    task = await ops.queueSlide(
      user.id,
      id,
      deck.slides[0].id!,
      "Make the heading more specific",
      event,
    );
  assert.equal(
    (
      await ops.queueSlide(
        user.id,
        id,
        deck.slides[0].id!,
        "Make the heading more specific",
        event,
      )
    ).id,
    task.id,
  );
  await ops.runSlide(task.id, async () => ({
    text: JSON.stringify({
      headline: "Invent something",
      factIds: ["fake"],
      visualEngine: "three",
      metaphor: "network",
    }),
    provider: "fixture",
  }));
  assert.equal(await balance(user.id), wallet);
  await ops.runSlide(task.id);
  assert.equal(await balance(user.id), wallet);
  const success = await ops.queueSlide(
    user.id,
    id,
    deck.slides[0].id!,
    "Keep the heading focused",
    randomUUID(),
  );
  await ops.runSlide(success.id, async () => ({
    text: JSON.stringify({
      headline: "Protect database reliability",
      factIds: [manifests[0].facts[0].id],
      visualEngine: "three",
      metaphor: "architecture",
    }),
    provider: "fixture",
  }));
  deck = (await ownedDeck(user.id, id))!;
  assert.equal(deck.slides[0].title, "Protect database reliability");
  assert.equal(await balance(user.id), wallet - 1);
  const share = await ops.createDeckShare(user.id, id),
    { audienceSlide } = await import("../lib/presentations/public-view");
  const visible = JSON.stringify(deck.slides.map(audienceSlide));
  assert(!visible.includes("PRIVATE_SPEAKER_NOTES"));
  assert(!visible.includes(fixtureSource.id));
  assert(
    !JSON.stringify(
      audienceSlide({
        ...deck.slides[0],
        citations: [
          "Lecture — https://example.test/paper?token=PRIVATE_URL_SECRET",
        ],
      }),
    ).includes("PRIVATE_URL_SECRET"),
  );
  await ops.revokeDeckShare(user.id, id, share.id);
  assert.equal(await ops.sharedDeck(share.token), null);
  const { portableWebDeck, hybridPptx, hybridVisualExport } =
    await import("../lib/presentations/hybrid/export");
  const html = portableWebDeck(deck);
  assert(!html.includes("PRIVATE_SPEAKER_NOTES"));
  assert(!html.includes("PRIVATE_CONTEXT"));
  assert(!html.includes("https://cdn"));
  const dir = "output/live-audit/hybrid";
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "deck.html"), html);
  const pdf = await hybridVisualExport(deck, "pdf"),
    pptx = await hybridPptx(deck),
    png = await hybridVisualExport(deck, "png");
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.equal(pptx.subarray(0, 2).toString(), "PK");
  writeFileSync(join(dir, "deck.pdf"), pdf);
  writeFileSync(join(dir, "deck.pptx"), pptx);
  writeFileSync(join(dir, "slide.png"), png);
  const { rendererLease, RendererBusy } =
    await import("../lib/presentations/hybrid/resources");
  const release = await rendererLease();
  await assert.rejects(
    () => inspectManifestSlides(manifests, draft.sources),
    RendererBusy,
  );
  await release();
  const { queueMedia, mediaDownload } =
    await import("../lib/presentations/hybrid/media");
  await assert.rejects(
    () => queueMedia(user.id, id, "mp4", randomUUID()),
    /enabled/,
  );
  assert.equal(await mediaDownload(other.id, id, "missing"), null);
  const badId = randomUUID();
  await createDeck(user.id, input, badId);
  await mutateRecord<any>(badId, (old) => ({
    ...old,
    slides: [
      manifestSlide(manifestForBeat(approved.hybridPlan!, 0), draft.sources),
    ].map((s) => ({
      ...s,
      manifest: {
        ...s.manifest!,
        facts: [
          { ...s.manifest!.facts[0], exactQuote: "Unsupported source passage" },
        ],
      },
    })),
  }));
  await processDeck(badId);
  assert.equal((await ownedDeck(user.id, badId))!.status, "error");
  const refunded = await balance(user.id);
  await processDeck(badId);
  assert.equal(await balance(user.id), refunded);
  let rejected = (await ownedDeck(user.id, badId))!;
  const repaired = rejected.slides.map((s, i) =>
    i
      ? s
      : manifestSlide(manifestForBeat(approved.hybridPlan!, 0), draft.sources),
  );
  await assert.rejects(
    () => editDeck(user.id, badId, repaired, rejected.updatedAt),
    /Approve/,
  );
  rejected = await editDeck(
    user.id,
    badId,
    repaired,
    rejected.updatedAt,
    30,
    true,
  );
  assert.equal(await balance(user.id), refunded - 5);
  await processDeck(badId);
  assert.equal((await ownedDeck(user.id, badId))!.status, "done");
  const paid = (await ownedDeck(user.id, badId))!,
    clipping = paid.slides.map((s, i) =>
      i
        ? s
        : manifestSlide(
            { ...s.manifest!, headline: "W".repeat(90) },
            draft.sources,
          ),
    );
  await editDeck(user.id, badId, clipping, paid.updatedAt);
  await processDeck(badId);
  const failedEdit = (await ownedDeck(user.id, badId))!;
  assert.equal(failedEdit.status, "error");
  assert.equal(failedEdit.creditsReserved, 0);
  assert.equal(
    await balance(user.id),
    refunded - 5,
    "Failed rechecks do not create refund credits",
  );
  await editDeck(user.id, badId, repaired, failedEdit.updatedAt);
  await processDeck(badId);
  assert.equal((await ownedDeck(user.id, badId))!.status, "done");
  assert.equal(
    await balance(user.id),
    refunded - 5,
    "An already-paid deck can repair its layout without another charge",
  );
  await assert.rejects(
    () => createDeck(user.id, { ...input, designEngine: 2 }),
    /retired/,
  );
  await assert.rejects(
    () =>
      planDeck(user.id, {
        ...input,
        audience: "Students",
        format: "presenter",
      }),
    /retired/,
  );
  await assert.rejects(() => retryDeck(other.id, id));
  const { queuePlan, runPendingPlan, retryPlan, publicPlanTask } =
      await import("../lib/presentations/hybrid/tasks"),
    { AIUnavailableError } = await import("../lib/ai/router");
  const queued = await queuePlan(user.id, randomUUID(), {
    prompt: input.prompt,
    count: 6,
    language: "english",
    sources: [fixtureSource],
    liveResearch: false,
  });
  const retryWallet = await balance(user.id);
  for (let attempt = 0; attempt < 3; attempt++) {
    await runPendingPlan(async () => {
      throw new AIUnavailableError("Provider busy fixture", true, 10000);
    });
    const current = await record<any>(queued.id);
    assert.equal(current.status, attempt < 2 ? "queued" : "error");
    assert.equal(await balance(user.id), retryWallet);
    if (attempt < 2)
      await mutateRecord<any>(queued.id, (old) => ({ ...old, leaseUntil: 0 }));
  }
  const failedPlan = await record<any>(queued.id);
  assert.equal(publicPlanTask(failedPlan).canRetry, true);
  assert(
    !("input" in publicPlanTask(failedPlan)),
    "Recovery must not expose private sources",
  );
  await assert.rejects(() => retryPlan(other.id, queued.id));
  await assert.rejects(() => retryPlan(user.id, queued.id), /wait one minute/);
  await mutateRecord<any>(queued.id, (old) => ({ ...old, leaseUntil: 0 }));
  const recovered = await retryPlan(user.id, queued.id);
  assert.deepEqual(
    recovered.input,
    failedPlan.input,
    "Retry retains all saved source/settings",
  );
  assert.equal(recovered.status, "queued");
  assert.equal(recovered.manualRetries, 1);
  assert.equal(
    (await retryPlan(user.id, queued.id)).manualRetries,
    1,
    "Repeated retry is idempotent",
  );
  await runPendingPlan(fixtureGenerate);
  assert.equal((await record<any>(queued.id)).status, "done");
  assert.equal(
    await balance(user.id),
    retryWallet,
    "Planning retry never charges credits",
  );
  await assert.rejects(() => retryPlan(user.id, queued.id), /Only a failed/);
  await mutateRecord<any>(queued.id, (old) => ({
    ...old,
    status: "error",
    manualRetries: 2,
    leaseUntil: 0,
  }));
  assert.equal(publicPlanTask((await record<any>(queued.id))!).canRetry, false);
  await assert.rejects(() => retryPlan(user.id, queued.id), /retry limit/);
  const { uploadScene, ownedScene } =
    await import("../lib/presentations/hybrid/scene-assets");
  await assert.rejects(
    () =>
      uploadScene(
        user.id,
        "bad.splinecode",
        Buffer.from("<script>".repeat(12)),
      ),
    /binary/,
  );
  const scene = await uploadScene(
    user.id,
    "transport-fixture.splinecode",
    Buffer.alloc(70, 128),
  );
  assert((await ownedScene(user.id, scene.id))?.owner === user.id);
  assert.equal(await ownedScene(other.id, scene.id), null);
  assert.equal((await record<any>(task.id))!.status, "error");
  assert(evidenceLines.length === 8 && fixtureGenerate);
  console.log(
    "PASS hybrid: complete-source extraction, bounded repair, exact quote/page provenance, dynamic budgets, idempotent credits, ownership/CAS, fail-closed quality gate, regeneration refunds, audience privacy, native exports, shared renderer lease and disabled video guard.",
  );
}
async function run() {
  if (!process.argv.includes("--mongo")) return main();
  const { MongoMemoryReplSet } = await import("mongodb-memory-server"),
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.DATA_BACKEND = "mongo";
  process.env.MONGODB_URI = repl.getUri();
  try {
    await main();
  } finally {
    const state = globalThis as any;
    if (state.mongoClient) await (await state.mongoClient).close();
    await repl.stop();
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
