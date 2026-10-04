import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { MongoMemoryReplSet } from "mongodb-memory-server";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-workspace-upgrade-"));
process.env.DATA_BACKEND = "sqlite";
delete process.env.MONGODB_URI;
delete process.env.APP_ROLE;
process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
process.env.RAZORPAY_KEY_SECRET = "unit-test-not-a-real-key";
process.env.RAZORPAY_WEBHOOK_SECRET = "unit-test-webhook";
for (const tier of ["STARTER", "PRO", "MAX"])
  process.env[`RAZORPAY_PLAN_${tier}_INR`] = `plan_${tier}`;
async function main() {
  const { register, accountByEmail } = await import("../lib/auth/server"),
    { balance } = await import("../lib/credits/store"),
    { setWorkspace } = await import("../lib/workspace-preference");
  const user = await register(
      "Test Writer",
      "writer-upgrade@example.test",
      "a-safe-test-password",
    ),
    other = await register(
      "Other",
      "other-upgrade@example.test",
      "a-safe-test-password",
    );
  const { enrollWriter } = await import("../lib/writing/profile");
  await enrollWriter(user);
  await setWorkspace(user.id, "writer");
  assert.equal((await accountByEmail(user.email))?.workspace, "writer");
  assert.equal(await balance(user.id), 19);
  const {
      uploadWritingImage,
      assertOwnedImages,
      imageIsPublished,
      writingImage,
    } = await import("../lib/writing/images"),
    { normalizeDocument } = await import("../lib/writing/document"),
    { saveStory, reviewStory, removeStory } =
      await import("../lib/writing/stories");
  const bytes = await sharp({
    create: { width: 100, height: 70, channels: 3, background: "#214d41" },
  })
    .png()
    .toBuffer();
  const image = await uploadWritingImage(user.id, bytes, "Learning diagram");
  assert.equal(
    (await sharp((await writingImage(image.id))!.bytes).metadata()).format,
    "webp",
  );
  const document = normalizeDocument({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2, onerror: "alert(1)" },
        content: [{ type: "text", text: "Useful learning guide" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Review what you learn with practice questions and spaced recall. Check explanations against your course material before preparing for an exam.",
          },
        ],
      },
      { type: "image", attrs: { src: image.url, alt: "Learning diagram" } },
    ],
  });
  assert.equal(document.content![0].attrs!.onerror, undefined);
  await assert.rejects(() => assertOwnedImages(other.id, document));
  assert.throws(() =>
    normalizeDocument({
      type: "doc",
      content: [
        {
          type: "text",
          text: "bad",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    }),
  );
  assert.throws(() =>
    normalizeDocument({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://tracker.invalid/img", alt: "bad" },
        },
      ],
    }),
  );
  assert.equal(await imageIsPublished(image.id, user.id), false);
  const draft = await saveStory(user.id, {
    title: "Learning guide",
    summary: "Review",
    body: "",
    document,
    tags: ["review"],
    authorName: user.name,
    submit: false,
  });
  const input = {
    id: draft.id,
    expectedUpdatedAt: draft.updatedAt,
    title: "Updated guide",
    summary: "Review",
    body: "",
    document,
    tags: ["review"],
    authorName: user.name,
    submit: false,
  };
  const concurrent = await Promise.allSettled([
    saveStory(user.id, input),
    saveStory(user.id, input),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  const submitted = await saveStory(user.id, {
    ...input,
    expectedUpdatedAt: (
      concurrent.find(
        (r) => r.status === "fulfilled",
      ) as PromiseFulfilledResult<any>
    ).value.updatedAt,
    submit: true,
  });
  await reviewStory(submitted.id, "publish", "Reviewed", user.id);
  assert.equal(await imageIsPublished(image.id, user.id), true);
  await removeStory(submitted.id, user.id, "Removed after a privacy review.");
  assert.equal(await imageIsPublished(image.id, user.id), false);
  const billing = await import("../lib/billing/subscriptions"),
    { record } = await import("../lib/workspace-records");
  let posts = 0;
  const provider = async (path: string, body?: any): Promise<any> => {
    if (path === "plans/plan_STARTER")
      return {
        id: "plan_STARTER",
        period: "monthly",
        interval: 1,
        item: { currency: "INR", amount: 3900 },
      };
    if (path === "subscriptions") {
      posts++;
      return { id: "sub_UnitMonthly" };
    }
    if (path === "subscriptions/sub_UnitMonthly/cancel") {
      assert.equal(body.cancel_at_cycle_end, 1);
      return { id: "sub_UnitMonthly", status: "active" };
    }
    if (path === "subscriptions/sub_UnitMonthly")
      return {
        id: "sub_UnitMonthly",
        plan_id: "plan_STARTER",
        status: "active",
        current_end: 9999999999,
      };
    if (path === "payments/pay_AuthOnly")
      return { id: "pay_AuthOnly", status: "captured", amount: 100 };
    if (path === "payments/pay_CycleOne")
      return {
        id: "pay_CycleOne",
        invoice_id: "inv_CycleOne",
        status: "captured",
        amount: 3900,
        currency: "INR",
      };
    if (path === "invoices/inv_CycleOne")
      return {
        id: "inv_CycleOne",
        subscription_id: "sub_UnitMonthly",
        payment_id: "pay_CycleOne",
        status: "paid",
        amount_paid: 3900,
        currency: "INR",
        billing_end: Math.floor(Date.now() / 1000) + 2592000,
      };
    throw new Error(`Unexpected mocked operation ${path}`);
  };
  const creates = await Promise.allSettled([
    billing.createSubscription(user.id, "starter", provider),
    billing.createSubscription(user.id, "starter", provider),
  ]);
  assert.equal(creates.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(posts, 1);
  assert.equal(
    (
      await billing.settleSubscription(
        "sub_UnitMonthly",
        "pay_AuthOnly",
        provider,
      )
    ).credited,
    false,
  );
  assert.equal(await balance(user.id), 19);
  await Promise.all([
    billing.settleSubscription("sub_UnitMonthly", "pay_CycleOne", provider),
    billing.settleSubscription("sub_UnitMonthly", "pay_CycleOne", provider),
  ]);
  assert.equal(await balance(user.id), 34);
  assert.equal(await billing.presentationLimit(user.id), 8);
  await assert.rejects(() =>
    billing.settleSubscription(
      "sub_UnitMonthly",
      "pay_CycleOne",
      async (path, body) =>
        path.startsWith("invoices/")
          ? { ...(await provider(path, body)), subscription_id: "sub_Other" }
          : provider(path, body),
    ),
  );
  await assert.rejects(() =>
    billing.settleSubscription(
      "sub_UnitMonthly",
      "pay_CycleOne",
      async (path, body) =>
        path.startsWith("payments/")
          ? { ...(await provider(path, body)), amount: 1 }
          : provider(path, body),
    ),
  );
  await billing.cancelSubscription(user.id, provider);
  assert.equal(
    (await billing.currentSubscription(user.id))?.cancelScheduled,
    true,
  );
  assert.equal(await balance(user.id), 34);
  const {
      createDeck,
      ownedDeck,
      processDeck,
      retryDeck,
      editDeck,
      pendingDeck,
    } = await import("../lib/presentations/store"),
    { validateSlide } = await import("../lib/presentations/model"),
    { exportDeck } = await import("../lib/presentations/export");
  const base = (title: string, layout = "points") => ({
    title,
    layout,
    subtitle: "Study one concept at a time",
    bullets: ["Describe the problem", "Check evidence", "Test understanding"],
    notes: "A teaching example; check against your original sources.",
    citations: [],
    columns: [
      { title: "Before", points: ["Unstructured study"] },
      { title: "After", points: ["A focused plan"] },
    ],
    steps: ["Read", "Recall", "Review"],
    table: [
      ["Step", "Purpose"],
      ["Review", "Recall"],
    ],
    chart: {
      labels: ["A", "B"],
      values: [2, 4],
      label: "Supplied example data",
    },
  });
  const deck = await createDeck(user.id, {
    prompt: "Explain study skills to university students.",
    context: "Example data: A 2 and B 4",
    language: "english",
    template: "classroom",
    count: 6,
  });
  assert.equal(await balance(user.id), 29);
  assert.equal(await ownedDeck(other.id, deck.id), null);
  let calls = 0;
  const generated = async () => {
    calls++;
    const current = (await ownedDeck(user.id, deck.id))!;
    return {
      provider: "mock",
      text: JSON.stringify(
        current.outline.length
          ? base(
              `Slide ${current.slides.length + 1}`,
              ["cover", "points", "comparison", "process", "table", "chart"][
                current.slides.length
              ],
            )
          : {
              title: "Study skills",
              outline: [
                "Introduction",
                "Why recall",
                "Before and after",
                "Process",
                "Schedule",
                "Results",
              ],
            },
      ),
    };
  };
  for (let i = 0; i < 6; i++) await processDeck(deck.id, generated);
  const complete = (await ownedDeck(user.id, deck.id))!;
  assert.equal(complete.status, "done");
  assert.equal(complete.slides.length, 6);
  assert.equal(calls, 7);
  assert.equal(await balance(user.id), 29);
  const ppt = await exportDeck(complete);
  assert.equal(ppt.subarray(0, 2).toString(), "PK");
  mkdirSync("output/workspace-upgrade", { recursive: true });
  writeFileSync("output/workspace-upgrade/sample-classroom.pptx", ppt);
  for (const template of ["technical", "editorial"] as const)
    writeFileSync(
      `output/workspace-upgrade/sample-${template}.pptx`,
      await exportDeck({ ...complete, template }),
    );
  await assert.rejects(() =>
    editDeck(other.id, deck.id, complete.slides, complete.updatedAt),
  );
  await assert.rejects(() =>
    editDeck(user.id, deck.id, complete.slides, "stale"),
  );
  const failed = await createDeck(user.id, {
    prompt: "Explain a complex learning topic to students",
    context: "",
    language: "english",
    template: "technical",
    count: 4,
  });
  await processDeck(failed.id, async () => {
    throw new Error("Provider outage");
  });
  assert.equal((await ownedDeck(user.id, failed.id))?.status, "error");
  assert.equal(await balance(user.id), 29);
  const retries = await Promise.allSettled([
    retryDeck(user.id, failed.id),
    retryDeck(user.id, failed.id),
  ]);
  assert.equal(retries.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await balance(user.id), 24);
  assert.equal((await record<any>(failed.id))!.attempt, 2);
  const { mutateRecord } = await import("../lib/workspace-records");
  for (let i = 0; i < 85; i++) {
    const id = `completed-history-${i}`;
    await mutateRecord(id, () => ({
      ...complete,
      id,
      updatedAt: "2099-01-01T00:00:00.000Z",
    }));
  }
  assert.equal(
    (await pendingDeck())?.id,
    failed.id,
    "Completed history must not hide an older unfinished presentation",
  );
  assert.throws(() =>
    validateSlide({
      title: "Invalid chart",
      layout: "chart",
      chart: { labels: ["A", "B"], values: [Infinity, 4] },
    }),
  );
  console.log(
    "PASS: workspace preference, rich draft conflict control, private images/takedown, mandate credits, replay protection, cancellation, deck ownership, durable generation/refunds and editable PPTX export.",
  );
}
async function run() {
  let replica: MongoMemoryReplSet | undefined;
  try {
    if (process.argv.includes("--mongo")) {
      replica = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
        binary: { version: "8.0.12" },
      });
      process.env.MONGODB_URI = replica.getUri();
      process.env.DATA_BACKEND = "mongo";
      process.env.MONGODB_DATABASE = "workspace_upgrade_test";
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
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
