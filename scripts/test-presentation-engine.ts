import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-engine-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.WORKER_MODE = "external";
async function main() {
  const {
      ARCHETYPES,
      archetypeExample,
      validateArchetype,
      verifyGrounding,
      validateStoryboard,
      verifyMetricPlan,
    } = await import("../lib/presentations/archetypes"),
    { toDeckSlide, renderBeat } = await import("../lib/presentations/pipeline"),
    { planDeck, ownedDraft, approveDraft } =
      await import("../lib/presentations/drafts"),
    { createDeck, processDeck, ownedDeck, editDeck } =
      await import("../lib/presentations/store"),
    { register } = await import("../lib/auth/server"),
    { balance } = await import("../lib/credits/store"),
    { deckHtml } = await import("../lib/presentations/visual-export"),
    { exportDeck } = await import("../lib/presentations/native-export"),
    { audienceSlide } = await import("../lib/presentations/public-view"),
    {
      publicResearchUrl,
      isPublicAddress,
      robotsAllows,
      extractPublicText,
      publicPage,
    } = await import("../lib/presentations/research");
  const owner = await register(
      "Engine fixture",
      "engine@example.test",
      "safe-fixture-password",
    ),
    other = await register(
      "Foreign fixture",
      "engine-other@example.test",
      "safe-fixture-password",
    );
  const source = {
    id: "text-source",
    name: "Fixture evidence",
    kind: "text" as const,
    text: "Illustrative template data 24% 3× 18. A clear idea deserves a clear presentation. Sample attribution. Illustrative quote.",
  };
  const examples = ARCHETYPES.map((a) => {
    const v = archetypeExample(a);
    if (v.archetype === "metric_trio") {
      v.metrics.forEach((m) => (m.sourceId = source.id));
      v.evidence = [source.id];
    }
    if (v.archetype === "quote_attribution") {
      v.sourceId = source.id;
      v.evidence = [source.id];
    }
    return validateArchetype(v);
  });
  for (const example of examples) verifyGrounding(example, [source]);
  const { slideOutputSchema } = await import("../lib/presentations/schemas"),
    { chatWithFallback } = await import("../lib/ai/router");
  const originalFetch = globalThis.fetch,
    originalKey = process.env.GROQ_API_KEY;
  let sent: any;
  process.env.GROQ_API_KEY = "fixture-provider-key";
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(examples[0]) },
          },
        ],
        model: "fixture",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    await chatWithFallback([{ role: "user", content: "Return fixture JSON" }], {
      json: true,
      schema: slideOutputSchema("hero_headline", examples[0].title, [
        source.id,
      ]),
    });
    assert.equal(sent.response_format.type, "json_schema");
    assert.equal(sent.response_format.json_schema.strict, true);
    assert.equal(
      sent.response_format.json_schema.schema.additionalProperties,
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  }
  const { sourceContext } = await import("../lib/presentations/source-context");
  const longSource = {
    ...source,
    text:
      "General background material. ".repeat(1000) +
      "\nPhotosynthesis captures light energy in chloroplasts. The measured result was 24%.",
  };
  const retrieved = sourceContext(
    [longSource],
    "photosynthesis chloroplasts",
    1800,
  );
  assert(retrieved[0].text.includes("Photosynthesis captures"));
  assert(retrieved[0].text.length <= 1800);
  assert(retrieved[0].truncated);
  assert.throws(
    () =>
      validateArchetype({
        ...examples[0],
        title: "one two three four five six seven eight nine",
      }),
    /title/,
  );
  assert.throws(
    () => validateArchetype({ ...examples[1], x: 0 }),
    /coordinates/,
  );
  const metric = examples[2];
  assert.equal(metric.archetype, "metric_trio");
  if (metric.archetype === "metric_trio")
    assert.throws(
      () =>
        verifyGrounding(
          {
            ...metric,
            metrics: [
              { ...metric.metrics[0], value: "999%" },
              metric.metrics[1],
              metric.metrics[2],
            ],
          },
          [source],
        ),
      /values/,
    );
  assert.throws(
    () => verifyGrounding(examples[5], []),
    /Unknown evidence|Quotes/,
  );
  const story = validateStoryboard(
    {
      thesis: "A focused narrative explains an idea clearly",
      beats: examples.map((s, i) => ({
        title: s.title,
        purpose:
          s.archetype === "metric_trio"
            ? "Compare the supplied 24%, 3× and 18 values"
            : "Explain this idea with concise supported content",
        role:
          i === 0
            ? "hook"
            : i === 1
              ? "context"
              : i === 5
                ? "takeaway"
                : "pillar",
        archetype: s.archetype,
        evidence: s.evidence,
      })),
    },
    6,
  );
  const input = {
    prompt:
      "Explain how clear presentation design helps an audience follow a narrative",
    language: "english",
    template: "studio" as const,
    count: 6,
    sources: [source],
    audience: "Students",
    format: "presenter" as const,
    designEngine: 2 as const,
  };
  const draft = await planDeck(owner.id, input, randomUUID(), async () => ({
    text: JSON.stringify(story),
    provider: "fixture",
  }));
  assert.equal(await ownedDraft(other.id, draft.id), null);
  await assert.rejects(
    () => approveDraft(owner.id, draft.id, 9, draft.outline),
    /changed/,
  );
  const approved = await approveDraft(owner.id, draft.id, 0, draft.outline, {
    storyboard: story,
    template: "ocean",
  });
  assert.equal(approved.template, "ocean");
  const before = await balance(owner.id);
  const unsupported = {
    ...story,
    beats: story.beats.map((b) =>
      b.archetype === "metric_trio"
        ? { ...b, purpose: "Compare hosting providers and health checks" }
        : b,
    ),
  };
  assert.throws(
    () => verifyMetricPlan(unsupported.beats[2], [source]),
    /three distinct/,
  );
  await assert.rejects(
    () =>
      createDeck(owner.id, {
        ...input,
        context: source.text,
        outline: draft.outline,
        storyboard: unsupported,
      }),
    /three distinct/,
  );
  assert.equal(
    await balance(owner.id),
    before,
    "Unsupported metric planning must be rejected before charging",
  );
  const deck = await createDeck(
    owner.id,
    {
      ...input,
      context: source.text,
      outline: draft.outline,
      storyboard: story,
    },
    `deck-${draft.id}`,
  );
  await createDeck(owner.id, { ...input, context: source.text }, deck.id);
  assert.equal(await balance(owner.id), before - 5);
  assert.equal(await ownedDeck(other.id, deck.id), null);
  for (let index = 0; index < 6; index++) {
    let calls = 0;
    await processDeck(deck.id, async () => ({
      text: JSON.stringify(examples[index]),
      provider: `fixture-${++calls}`,
    }));
    assert.equal(
      calls,
      2,
      "Slot filling and editorial condensation are separate model passes",
    );
  }
  const done = (await ownedDeck(owner.id, deck.id))!;
  assert.equal(done.status, "done");
  assert.equal(done.slides.length, 6);
  assert.equal(await balance(owner.id), before - 5);
  const publicSlide = audienceSlide({
    ...done.slides[2],
    notes: "PRIVATE NOTES",
    semantic: { ...done.slides[2].semantic!, notes: "PRIVATE SEMANTIC NOTES" },
  });
  assert(!JSON.stringify(publicSlide).includes("PRIVATE"));
  assert(!JSON.stringify(publicSlide).includes("Supporting excerpt"));
  const { AIUnavailableError } = await import("../lib/ai/router"),
    { mutateRecord } = await import("../lib/workspace-records");
  const cache = await mutateRecord<any>("cache-expiry-fixture", () => ({
    id: "cache-expiry-fixture",
    owner: owner.id,
    kind: "presentation-source",
    updatedAt: new Date().toISOString(),
    source,
  }));
  if (process.argv.includes("--mongo")) {
    const { collection } = await import("../lib/storage/mongo");
    const records = await collection("workspace_records");
    const cached = await records.findOne({ _id: cache.id });
    assert(
      cached?.sourceCacheExpiresAt instanceof Date,
      "Mongo TTL fields must be actual dates",
    );
    const indexes = await records.indexes();
    assert(
      indexes.some(
        (i) => i.key.sourceCacheExpiresAt === 1 && i.expireAfterSeconds === 0,
      ),
    );
  } else {
    const { db } = await import("../lib/db"),
      { ownedSources } = await import("../lib/presentations/drafts");
    db()
      .prepare("UPDATE workspace_records SET updated_at=? WHERE id=?")
      .run(new Date(Date.now() - 172800000).toISOString(), cache.id);
    await ownedSources(owner.id, []);
    assert.equal(
      db().prepare("SELECT id FROM workspace_records WHERE id=?").get(cache.id),
      undefined,
    );
  }
  const quota = await createDeck(owner.id, {
    ...input,
    context: source.text,
    outline: draft.outline,
    storyboard: story,
  });
  const reserved = await balance(owner.id);
  for (let i = 0; i < 5; i++) {
    await processDeck(quota.id, async () => {
      throw new AIUnavailableError(
        "AI providers unavailable. fixture: HTTP 429",
        true,
        30000,
      );
    });
    const current = (await ownedDeck(owner.id, quota.id))!;
    if (i < 4) {
      assert.equal(current.status, "queued");
      assert(current.leaseUntil > Date.now());
      assert.equal(
        await balance(owner.id),
        reserved,
        "A temporary provider delay must not double-charge or refund an active reservation",
      );
      await mutateRecord<typeof current>(quota.id, (old) => ({
        ...old!,
        leaseUntil: 0,
      }));
    } else {
      assert.equal(current.status, "error");
      assert.equal(
        await balance(owner.id),
        reserved + 5,
        "Exhausted retries refund once",
      );
    }
  }
  await processDeck(quota.id, async () => {
    throw new Error("unreachable");
  });
  assert.equal(await balance(owner.id), reserved + 5);
  await assert.rejects(
    () => editDeck(other.id, deck.id, done.slides, done.updatedAt),
    /changed/,
  );
  let calls = 0;
  await renderBeat(
    {
      beat: story.beats[0],
      storyboard: story,
      language: "english",
      sources: [source],
    },
    async () => ({
      text: JSON.stringify(
        ++calls === 2
          ? {
              ...examples[0],
              title: "invalid one two three four five six seven eight nine",
            }
          : examples[0],
      ),
      provider: "repair",
    }),
  );
  assert.equal(
    calls,
    3,
    "A failed editorial validation gets one bounded repair",
  );
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.4.1",
    "192.168.1.1",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])
    assert(!isPublicAddress(address), address);
  assert(isPublicAddress("8.8.8.8"));
  for (const url of [
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com:8443",
    "https://localhost",
    "https://example.com?token=secret",
  ])
    assert.throws(() => publicResearchUrl(url));
  await assert.rejects(() => publicPage("https://127.0.0.1/"), /addresses/);
  assert(!robotsAllows("User-agent: *\nDisallow: /private/", "/private/one"));
  assert(
    robotsAllows("User-agent: *\nDisallow: /\nAllow: /article$", "/article"),
  );
  assert(
    !robotsAllows(
      "User-agent: *\nDisallow: /\nAllow: /article$",
      "/article/more",
    ),
  );
  const extracted = extractPublicText(
    "<html><title>Article</title><body><nav>Navigation</nav><article><h1>Research heading</h1><p>Evidence stays in the source.</p><script>Bad instructions</script></article></body></html>",
    "text/html",
  );
  assert(extracted.text.includes("Evidence"));
  assert(!extracted.text.includes("Navigation"));
  assert(!extracted.text.includes("Bad instructions"));
  const wrapped = extractPublicText(
    "<article><h2>Your next insight<br/>starts with a question.</h2></article>",
    "text/html",
  );
  assert(wrapped.text.replace(/\s+/g, " ").includes("insight starts"));
  const dir = "output/live-audit/archetype-engine";
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    await page.route("**/*", (r) => r.abort());
    for (const template of ["studio", "technical", "editorial"] as const) {
      const fixture = {
        ...done,
        template,
        slides: examples.map((s) => ({
          ...toDeckSlide(s, [source]),
          id: randomUUID(),
        })),
      };
      await page.setContent(await deckHtml(fixture));
      await page.evaluate(() => document.fonts.ready);
      for (let i = 0; i < 6; i++) {
        const canvas = page.locator(".deck-canvas").nth(i);
        const clipped = await canvas.evaluate((el) =>
          Array.from(
            el.querySelectorAll<HTMLElement>(".deck-object,footer span"),
          )
            .filter(
              (e) =>
                e.scrollHeight > e.clientHeight + 2 ||
                e.scrollWidth > e.clientWidth + 2,
            )
            .map((e) => e.textContent),
        );
        assert.deepEqual(clipped, [], `${template}/${ARCHETYPES[i]} must fit`);
        await canvas.screenshot({
          path: `${dir}/${template}-${ARCHETYPES[i]}.png`,
        });
      }
      writeFileSync(`${dir}/${template}.pptx`, await exportDeck(fixture));
    }
    for (const language of ["english", "hindi"]) {
      const title =
        language === "hindi"
          ? "महत्वपूर्ण जानकारी से स्पष्ट निर्णय और बेहतर परिणाम"
          : "Meaningful evidence supports deliberate decisions across complex situations";
      const heading =
        language === "hindi"
          ? "महत्वपूर्ण अनुसंधान और सटीक जानकारी"
          : "Extraordinary interdisciplinary research informs decisions";
      const body =
        language === "hindi"
          ? "विश्वसनीय अनुसंधान और महत्वपूर्ण जानकारी शिक्षार्थियों को बेहतर निर्णय लेने, विषय समझने और विचार विकसित करने में सहायता देते हैं।"
          : "Interdisciplinary researchers evaluate meaningful evidence across challenging circumstances before developing practical recommendations for responsible implementation and collaboration.";
      const stress = examples.map((original) => {
        const s = { ...original, title } as typeof original;
        if (s.archetype === "bento_grid_3")
          s.cards = s.cards.map((c) => ({
            ...c,
            title: heading,
            body,
          })) as typeof s.cards;
        if (s.archetype === "split_comparison") {
          s.left = { ...s.left, title: heading, body };
          s.right = { ...s.right, title: heading, body };
        }
        if (s.archetype === "linear_stepper")
          s.steps = Array.from({ length: 4 }, () => ({
            ...s.steps[0],
            title: heading,
            body,
          }));
        return toDeckSlide(s, [source]);
      });
      await page.setContent(
        await deckHtml({
          ...done,
          language,
          template: "studio",
          slides: stress,
        }),
      );
      await page.evaluate(() => document.fonts.ready);
      for (let i = 0; i < stress.length; i++) {
        const canvas = page.locator(".deck-canvas").nth(i);
        const clipped = await canvas.evaluate((el) =>
          Array.from(el.querySelectorAll<HTMLElement>(".deck-object"))
            .filter(
              (e) =>
                e.scrollHeight > e.clientHeight + 2 ||
                e.scrollWidth > e.clientWidth + 2,
            )
            .map((e) => ({
              text: e.textContent,
              w: e.clientWidth,
              h: e.clientHeight,
              actual: e.scrollHeight,
              font: getComputedStyle(e).fontSize,
              line: getComputedStyle(e).lineHeight,
            })),
        );
        await canvas.screenshot({
          path: `${dir}/${language}-long-${ARCHETYPES[i]}.png`,
        });
        assert.deepEqual(
          clipped,
          [],
          `${language}/${ARCHETYPES[i]} long copy must fit`,
        );
        await canvas.screenshot({
          path: `${dir}/${language}-long-${ARCHETYPES[i]}.png`,
        });
      }
    }
  } finally {
    await browser.close();
  }
  console.log(
    "PASS archetype engine: six typed layouts, two-pass slide editorial pipeline, source grounding, bounded repair, saved storyboard, ownership, single charge, audience privacy, SSRF/robots guards, measured layouts and editable PPTX.",
  );
}
async function run() {
  if (!process.argv.includes("--mongo")) return main();
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
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
