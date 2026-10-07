import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { load } from "cheerio";
async function main() {
  const base = "http://localhost:3157";
  Object.assign(process.env, {
    APP_ROLE: "all",
    BACKEND_URL: "",
    MONGODB_URI: "",
    DATA_BACKEND: "sqlite",
    DATA_DIR: mkdtempSync(join(tmpdir(), "writer-discovery-ui-")),
    WORKER_MODE: "external",
    NEXT_DIST_DIR: ".next-validation",
    NEXT_PUBLIC_APP_URL: base,
  });
  const { register, startSession } = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { enrollWriter } = await import("../lib/writing/profile"),
    { saveStory, ownedStory, reviewStory, listStories } =
      await import("../lib/writing/stories"),
    { analyzeDiscovery } = await import("../lib/writing/discovery"),
    { textDocument } = await import("../lib/writing/document");
  const writer = await register(
    "University Writer",
    "discovery-ui@example.test",
    "fixture-password-safe",
  );
  await markEmailVerified(writer.id);
  await enrollWriter(writer);
  await (
    await import("../lib/workspace-preference")
  ).setWorkspace(writer.id, "writer");
  const body =
    "Normalization organizes relational data around functional dependencies. A lossless decomposition preserves the ability to reconstruct the original relation. Verify examples with your course textbook before applying a schema change.";
  const draft = await saveStory(writer.id, {
    title: "Understanding database normalization",
    summary:
      "A concise university guide to database normalization and lossless decomposition.",
    body,
    document: textDocument(body),
    tags: ["databases"],
    authorName: writer.name,
  });
  await analyzeDiscovery(writer.id, draft.id, draft.updatedAt, async () => ({
    provider: "synthetic fixture",
    model: "no external AI used",
    text: JSON.stringify({
      title: "Normalization and lossless database design",
      description:
        "Understand relational database normalization, functional dependencies and lossless decomposition in a concise university guide.",
      topics: ["databases"],
      questions: [
        {
          question: "What does lossless decomposition preserve?",
          evidence:
            "A lossless decomposition preserves the ability to reconstruct the original relation.",
        },
      ],
      improvements: ["Add a worked example and a reliable textbook reference."],
    }),
  }));
  for (let i = 0; i < 51; i++)
    await saveStory(writer.id, {
      title: `Other saved draft ${i}`,
      summary: "",
      body: "",
      tags: [],
      authorName: writer.name,
    });
  assert(
    !(await listStories(writer.id)).some((s) => s.id === draft.id),
    "Fixture must be older than the recent list limit",
  );
  const cookie = (await startSession(writer, new Request(base))).headers
    .get("set-cookie")!
    .split(";")[0];
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3157"],
    {
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(ready);
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const split = cookie.indexOf("=");
    await context.addCookies([
      {
        name: cookie.slice(0, split),
        value: cookie.slice(split + 1),
        domain: "localhost",
        path: "/",
      },
    ]);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    mkdirSync("output/writer-discovery", { recursive: true });
    await page.goto(base + "/write?draft=" + draft.id);
    await page.locator("#story-title").filter({ visible: true }).waitFor();
    await page.getByRole("button", { name: "Discovery", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Story discovery" });
    const apply = modal.getByRole("button", {
      name: "Apply approved search metadata",
      exact: true,
    });
    await apply.waitFor();
    assert(await apply.isDisabled());
    await modal
      .getByLabel(/^Search title/)
      .fill("Database normalization: a university guide");
    await modal.getByRole("checkbox").check();
    assert(await apply.isEnabled());
    await modal.evaluate((e) => {
      e.scrollTop = 0;
    });
    await page.screenshot({ path: "output/writer-discovery/desktop.png" });
    await apply.click();
    await modal
      .getByRole("status")
      .filter({ hasText: "Approved search metadata saved" })
      .waitFor();
    await modal.getByLabel("Saved search metadata").waitFor();
    let saved = (await ownedStory(writer.id, draft.id))!;
    assert.equal(
      saved.searchMetadata!.title,
      "Database normalization: a university guide",
    );
    assert.equal(saved.body, body);
    assert.equal(saved.status, "draft");
    await modal.getByRole("button", { name: "Close dialog" }).click();
    await page.reload();
    await page.getByRole("button", { name: "Discovery", exact: true }).click();
    await modal
      .getByText("This report belongs to an earlier saved version.", {
        exact: false,
      })
      .waitFor();
    assert(await apply.isDisabled());
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      assert.equal(
        await modal.evaluate((e) => e.scrollWidth > e.clientWidth + 1),
        false,
        `Modal overflow at ${width}`,
      );
      await modal.evaluate((e) => {
        e.scrollTop = 0;
      });
      await page.screenshot({
        path: `output/writer-discovery/mobile-${width}.png`,
      });
    }
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    saved = await saveStory(writer.id, {
      id: saved.id,
      title: saved.title,
      summary: saved.summary,
      body: saved.body,
      document: saved.document,
      tags: saved.tags,
      authorName: writer.name,
      expectedUpdatedAt: saved.updatedAt,
      submit: true,
    });
    const published = await reviewStory(
      saved.id,
      "publish",
      "Browser fixture review",
      writer.id,
    );
    const html = await (await fetch(base + "/guides/" + published.slug)).text(),
      $ = load(html);
    assert(
      $("title").text().includes("Database normalization: a university guide"),
    );
    assert.equal(
      $("meta[name=description]").attr("content"),
      saved.searchMetadata!.description,
    );
    assert.equal(
      $("h1").text(),
      draft.title,
      "Search metadata must not rewrite the visible article",
    );
    const data = await (
      await fetch(base + "/api/publications?slug=" + published.slug)
    ).json();
    assert(!("user" in data.stories[0]));
    assert(!("versions" in data.stories[0]));
    assert(!("fingerprint" in data.stories[0]));
    assert.deepEqual(errors, []);
    console.log(
      "PASS writer discovery browser: old draft direct link, explicit approval, reload/stale report, 390/768/1440 layout, public SSR metadata and private-field redaction. AI output is a synthetic fixture.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
