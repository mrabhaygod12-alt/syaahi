import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { fixtureSource, fixtureGenerate } from "./hybrid-fixture";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-hybrid-ui-"));
Object.assign(process.env, {
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  WORKER_MODE: "external",
  NEXT_DIST_DIR: ".next-validation",
  BACKEND_URL: "",
  NEXT_PUBLIC_APP_URL: "http://localhost:3154",
  GROQ_API_KEY: "fixture-key-never-external",
  GROQ_BASE_URL: "http://127.0.0.1:3155/v1",
  PRESENTATION_VIDEO_ENABLED: "false",
  PRESENTATION_VISION_QA: "false",
  PRESENTATION_NARRATION_ENABLED: "false",
});
async function main() {
  const { register, startSession } = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { runPendingPlan } = await import("../lib/presentations/hybrid/tasks"),
    { ownedDeck, processDeck } = await import("../lib/presentations/store"),
    { records, mutateRecord } = await import("../lib/workspace-records");
  const user = await register(
    "Studio Student",
    "hybrid-ui@example.test",
    "safe-browser-password",
  );
  await markEmailVerified(user.id);
  const cookie = (
    await startSession(user, new Request("http://localhost:3154"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const [name, value] = cookie.split("=");
  const ai = createServer(async (req, res) => {
    let text = "";
    for await (const part of req) text += part;
    const body = JSON.parse(text),
      input = JSON.parse(body.messages.at(-1).content);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({ factIds: [input.facts[0].id] }),
            },
          },
        ],
        model: "fixture",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  });
  await new Promise<void>((r) => ai.listen(3155, "127.0.0.1", r));
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3154"],
    {
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  let browser;
  try {
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch("http://localhost:3154/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch({
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    await context.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    mkdirSync("output/live-audit/hybrid-ui", { recursive: true });
    await page.goto("http://localhost:3154/presentations");
    await page
      .getByLabel("What should your audience understand?")
      .fill(
        "Explain database reliability to postgraduate computer science students",
      );
    await page.getByRole("button", { name: "Paste", exact: true }).click();
    await page
      .getByLabel("Reference text", { exact: true })
      .fill(fixtureSource.text);
    await page.getByRole("button", { name: "Add text", exact: true }).click();
    await page.getByRole("checkbox", { name: "Live research" }).uncheck();
    await page.screenshot({
      path: "output/live-audit/hybrid-ui/creation-1440.png",
    });
    const queued = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/presentations") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Research & plan" }).click();
    const queuedResponse = await queued;
    assert.equal(queuedResponse.status(), 202);
    const planTask = (await queuedResponse.json()).task;
    assert.equal(
      (
        await fetch(
          `http://localhost:3154/api/presentations/tasks/${planTask.id}`,
          {
            method: "POST",
            headers: { Cookie: cookie, Origin: "https://foreign.example" },
          },
        )
      ).status,
      403,
      "Cross-site retry must stay blocked",
    );
    assert.equal(
      (
        await fetch(
          `http://localhost:3154/api/presentations/tasks/${planTask.id}`,
          {
            method: "POST",
            headers: { Origin: "http://localhost:3154" },
          },
        )
      ).status,
      401,
      "Retry requires an authenticated account",
    );
    await mutateRecord<any>(planTask.id, (old) => ({
      ...old,
      status: "error",
      stage: "Research needs attention",
      error: "Provider capacity fixture. No credits were charged.",
      lease: null,
      leaseUntil: 0,
    }));
    await page.reload();
    await page.getByRole("button", { name: "Retry saved brief" }).waitFor();
    const retryResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/tasks/${planTask.id}`) &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Retry saved brief" }).click();
    assert.equal((await retryResponse).status(), 202);
    await runPendingPlan(fixtureGenerate);
    await page.waitForURL(/\/presentations\/plan\//, { timeout: 20000 });
    await page
      .getByLabel("Scene 2 heading", { exact: true })
      .fill("Make database updates atomic");
    await page.getByRole("button", { name: "Save plan", exact: true }).click();
    await page.getByText("Storyboard saved to your account.").waitFor();
    const inspect = page
      .locator(".cv-plan-preview .cv-slide-facts button")
      .first();
    await inspect.click();
    await page
      .getByRole("dialog", { name: "Inspect source evidence" })
      .waitFor();
    assert((await page.locator("dialog mark").innerText()).length > 24);
    await page
      .getByRole("button", { name: "Close Inspect source evidence" })
      .click();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        `Plan overflow at ${width}`,
      );
      await page.screenshot({
        path: `output/live-audit/hybrid-ui/plan-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("checkbox", { name: /I approve this reservation/ })
      .check();
    await page.getByRole("button", { name: "Build the visual deck" }).click();
    await page.waitForURL(/\/presentations\/deck-/);
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    await processDeck(id);
    await page
      .locator(".cv-stage-center .cv-slide")
      .waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Open Design panel" }).click();
    await page
      .getByLabel("Scene heading", { exact: true })
      .fill("Protect every database transaction");
    for (let i = 0; i < 80; i++) {
      const d = await ownedDeck(user.id, id);
      if (d?.status === "queued") {
        await processDeck(id);
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    await page.waitForFunction(
      () =>
        document
          .querySelector(".cv-save-state")
          ?.textContent?.includes("Saved"),
      null,
      { timeout: 15000 },
    );
    await page.reload();
    await page.getByLabel("Scene heading", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Scene heading", { exact: true }).inputValue(),
      "Protect every database transaction",
    );
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        `Editor overflow at ${width}`,
      );
      if (width < 700) {
        for (const panel of ["Scenes", "Director", "Stage"]) {
          await page.getByRole("button", { name: panel, exact: true }).click();
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 2,
            ),
            `${panel} overflow at ${width}`,
          );
        }
      }
      await page.screenshot({
        path: `output/live-audit/hybrid-ui/editor-${width}.png`,
      });
      assert.deepEqual(
        await page
          .locator(".cv-stage-center .cv-slide [data-fit]")
          .evaluateAll((nodes) =>
            nodes
              .filter(
                (n) =>
                  n.scrollHeight > n.clientHeight + 1 ||
                  n.scrollWidth > n.clientWidth + 1,
              )
              .map((n) => n.textContent),
          ),
        [],
        `Slide text clipping at ${width}`,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page
        .locator(".cv-stage-center .cv-slide")
        .getAttribute("aria-label"),
      "Slide 2: Make database updates atomic",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open Ask panel" }).click();
    await page
      .getByLabel("Question", { exact: true })
      .fill("What is atomicity in a database?");
    await page.getByRole("button", { name: "Find supported passages" }).click();
    await page.locator(".cv-answer .cv-source-citation").first().waitFor();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("button", { name: /Create .*link/ }).click();
    const share = await page
      .locator(".cv-modal-body a[href*='/presentations/shared/']")
      .getAttribute("href");
    assert(share);
    await page
      .getByRole("button", { name: "Close Share a read-only deck" })
      .click();
    const publicPage = await context.newPage();
    await publicPage.goto(
      share.startsWith("http") ? share : "http://localhost:3154" + share,
    );
    await publicPage.locator(".cv-shared-stage .cv-slide").waitFor();
    await publicPage
      .getByRole("button", { name: "Next slide", exact: true })
      .click();
    assert(
      (
        await publicPage.locator(".cv-slide").getAttribute("aria-label")
      )?.startsWith("Slide 2"),
    );
    assert(!(await publicPage.locator("body").innerText()).includes("PRIVATE"));
    await publicPage.close();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: /Editable PowerPoint/ }).click();
    assert((await download).suggestedFilename().endsWith(".pptx"));
    await page.getByRole("button", { name: /Close One story/ }).click();
    // Check a real GPU renderer under production CSP; other engines may legitimately fall back.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await page
      .locator(".cv-stage-center .cv-slide[data-engine=three]")
      .waitFor({ timeout: 30000 });
    await page.screenshot({
      path: "output/live-audit/hybrid-ui/editor-webgl.png",
    });
    // Presentation mode retains one world canvas when the active scene changes.
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await page
      .locator(".cv-stage-center .cv-slide[data-engine=three-world] canvas")
      .waitFor();
    const retained = await page
      .locator(".cv-stage-center canvas")
      .evaluate((node) => {
        (node as any).__retained = true;
        return true;
      });
    assert(retained);
    await page.keyboard.press("ArrowRight");
    assert(
      await page
        .locator(".cv-stage-center canvas")
        .evaluate((node) => (node as any).__retained),
    );
    await page.keyboard.press("Escape");
    let renderer = "three";
    await page.route(`**/api/presentations/${id}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch(),
        data = await response.json();
      data.deck.slides[0].manifest.visualEngine = renderer;
      await route.fulfill({ response, json: data });
    });
    for (const engine of [
      "babylon",
      "ogl",
      "pixi",
      "two",
      "shader",
      "curtains",
      "p5",
    ]) {
      renderer = engine;
      await page.reload();
      await page
        .locator(`.cv-stage-center .cv-slide[data-engine=${engine}]`)
        .waitFor({ timeout: 30000 });
      await page.screenshot({
        path: `output/live-audit/hybrid-ui/renderer-${engine}.png`,
      });
    }
    renderer = "spline";
    await page.reload();
    await page
      .locator(".cv-stage-center .cv-renderer-note")
      .filter({ hasText: /Spline scene/ })
      .waitFor();
    const stored = (await records<any>("presentation-plan-task", user.id))[0];
    assert.equal(stored.status, "done");
    assert.deepEqual(errors, []);
    console.log(
      "PASS browser: source intake → queued planning → editable cited storyboard → credit approval → GPU stage; autosave/reload, inspector, Q&A, keyboard presenter, private sharing, PPTX download and no overflow at 320/390/768/1440px.",
    );
  } finally {
    await browser?.close();
    server.kill();
    await new Promise<void>((r) => ai.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
