import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import sharp from "sharp";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-studio-browser-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";
process.env.WORKER_MODE = "external";
process.env.NEXT_DIST_DIR = ".next-validation";
process.env.BACKEND_URL = "";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3151";
async function main() {
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    jobs = await import("../lib/jobs/store"),
    store = await import("../lib/presentations/store"),
    drafts = await import("../lib/presentations/drafts");
  const user = await auth.register(
    "Browser Student",
    "studio-browser@example.test",
    "safe-browser-password",
  );
  await markEmailVerified(user.id);
  const state = await import("../lib/study/state"),
    { freshHub } = await import("../lib/study/hub"),
    { composerDraft } = await import("../lib/study/drafts");
  await state.mutateState(user.id, "hub", freshHub(), (old) => ({
    ...old,
    revision: 1,
    draft: composerDraft({
      text: "Cells",
      outline: "Cells\nDNA",
      stage: 2,
      sections: [],
      plan: {
        topics: ["Cells", "DNA"],
        context: "Fixture private source",
        sources: [],
        readingLinks: [],
        reason: "Fixture saved outline",
        note: "",
        evidence: "supplied",
      },
    }),
  }));
  const [name, value] = (
    await auth.startSession(user, new Request("http://localhost:3151"))
  ).headers
    .get("set-cookie")!
    .split(";")[0]
    .split("=");
  const job = await jobs.createJob(user.id, ["Cell biology"], "concise", {
      context: "A private lesson about cell biology",
    }),
    lease = (await jobs.claimJob(job.id))!;
  await jobs.commitPage(job.id, lease.token, 0, {
    topic: "Cells",
    markdown: "## Cells\nCells contain genetic information.\n$E=mc^2$",
    provider: "fixture",
    model: "fixture",
  });
  await jobs.finishJob(job.id, lease.token);
  await jobs.updateJob(job.id, {
    practice: {
      quiz: [
        {
          q: "What do cells contain?",
          type: "mcq",
          options: ["Genetic information", "Nothing"],
          answer: "Genetic information",
        },
      ],
      flashcards: [{ front: "Cell?", back: "Basic unit of life" }],
    },
  });
  const sources = await drafts.ownedSources(user.id, [
      { kind: "lesson", id: job.id },
    ]),
    draft = await drafts.planDeck(
      user.id,
      {
        prompt: "Explain cells to a biology class",
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
          outline: ["Cells", "Structure", "Compare", "Recap"],
        }),
        provider: "fixture",
      }),
    );
  const deck = await store.createDeck(user.id, {
    prompt: draft.prompt,
    context: "",
    language: "english",
    template: "editorial",
    count: 4,
    outline: draft.outline,
    sources,
  });
  for (let i = 0; i < 4; i++)
    await store.processDeck(deck.id, async () => ({
      text: JSON.stringify({
        title: draft.outline[i],
        layout: i === 0 ? "cover" : "points",
        subtitle: i === 0 ? "A clear biology lesson" : "",
        bullets:
          i === 0
            ? []
            : [
                "Cells contain genetic information",
                "Check your course sources",
              ],
        notes: "Only the presenter should see this note",
        evidence: [sources[0].id],
      }),
      provider: "fixture",
    }));
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3151"],
    {
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch("http://localhost:3151/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(ready, "Local server did not become ready");
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    await context.addInitScript(() => {
      if (window === window.top)
        localStorage.setItem("syaahi-privacy-v1", "essential");
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    mkdirSync("output/live-audit/studio", { recursive: true });
    await page.goto("http://localhost:3151/dashboard");
    await page
      .getByRole("heading", { name: "Your next step, Browser." })
      .waitFor();
    await page
      .getByRole("button", { name: "Review", exact: false })
      .first()
      .click();
    await page.getByRole("heading", { name: "Cell?" }).waitFor();
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await page.getByRole("button", { name: "good", exact: true }).click();
    await page
      .getByRole("button", { name: "Exam planner", exact: true })
      .click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `output/live-audit/studio/dashboard-${width}.png`,
        fullPage: true,
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 2,
        ),
        `Dashboard overflow at ${width}: ${JSON.stringify(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("body *"))
              .filter(
                (e) => e.getBoundingClientRect().right > window.innerWidth + 2,
              )
              .map((e) => ({
                tag: e.tagName,
                cls: e.className,
                right: e.getBoundingClientRect().right,
              }))
              .slice(0, 12),
          ),
        )}`,
      );
      await page.screenshot({
        path: `output/live-audit/studio/dashboard-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const { balance } = await import("../lib/credits/store"),
      beforePlanning = await balance(user.id);
    await page.getByRole("button", { name: /New lesson/ }).click();
    await page
      .getByRole("heading", { name: "Shape your study outline" })
      .waitFor();
    await page
      .getByText("Learning outcomes & prerequisites", { exact: true })
      .click();
    await page
      .getByLabel("After this section I can…")
      .first()
      .fill("Describe a cell");
    await page
      .getByLabel("Edit your note pages, one per line")
      .fill("DNA\nCells");
    assert.equal(
      await page.getByLabel("After this section I can…").nth(1).inputValue(),
      "Describe a cell",
    );
    await page.getByRole("button", { name: "Review credits →" }).click();
    await page
      .getByRole("heading", { name: "Review before generation" })
      .waitFor();
    assert(
      !(await page
        .getByRole("button", { name: /Create my study workspace/ })
        .isEnabled()),
    );
    await page.getByText("Saved to your account", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: /New lesson/ }).click();
    await page
      .getByRole("heading", { name: "Review before generation" })
      .waitFor();
    await page.getByRole("button", { name: "← Edit outline" }).click();
    await page.getByRole("button", { name: "← Back to input" }).click();
    assert.equal(
      await page.getByLabel("What would you like to understand?").inputValue(),
      "Cells",
    );
    const scanImage = await sharp({
      create: { width: 80, height: 40, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const { prepareScan } = await import("../lib/intake/image"),
      preparedScan = await prepareScan(scanImage, {
        rotation: 90,
        crop: { x: 0, y: 0, width: 100, height: 50 },
      });
    await page.route("**/api/image", async (route) => {
      assert(
        route.request().postDataBuffer()?.toString().includes('"rotation":90'),
      );
      await route.fulfill({
        json: {
          text: "Cells contain genetic information. [unclear] कोशिका",
          preparation: preparedScan.provenance,
          unclearCount: 1,
          warning: "Fixture transcription; not a provider test",
        },
      });
    });
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "scan-fixture.png",
      mimeType: "image/png",
      buffer: scanImage,
    });
    await page.getByRole("heading", { name: "Prepare this scan" }).waitFor();
    await page.getByLabel("Rotation").selectOption("90");
    await page.getByLabel("Crop height (%)").fill("50");
    await page.screenshot({
      path: "output/live-audit/studio/scan-preparation.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Read prepared scan" }).click();
    await page
      .getByRole("button", { name: "Review my outline →", exact: true })
      .click();
    await page
      .getByText(
        "Review the extracted scan text and confirm its unreadable areas before planning.",
        { exact: true },
      )
      .waitFor();
    await page
      .getByText("Review extracted text before generation", { exact: true })
      .click();
    await page
      .getByLabel("Extracted source text")
      .fill("Cells contain genetic information. कोशिका");
    await page
      .getByRole("checkbox", { name: /I checked this extraction/ })
      .check();
    await page.getByLabel("Target pages").selectOption("1");
    await page.getByRole("checkbox", { name: "Find sources" }).uncheck();
    await page
      .getByRole("button", { name: "Review my outline →", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Shape your study outline" })
      .waitFor();
    assert.equal(
      await balance(user.id),
      beforePlanning,
      "Planning and scan review do not reserve generation credits",
    );
    await page.screenshot({
      path: "output/live-audit/studio/lesson-outline.png",
      fullPage: true,
    });
    await page.goto(`http://localhost:3151/lesson/${job.id}/quiz`);
    await page.getByRole("button", { name: "Start saved attempt" }).click();
    await page.getByText("Rebuild practice questions", { exact: true }).click();
    assert(
      !(await page
        .getByRole("button", { name: "Rebuild quiz and flashcards" })
        .isEnabled()),
    );
    await page.getByRole("button", { name: /Genetic information/ }).click();
    await page
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    await page.getByRole("button", { name: "Submit and review" }).click();
    await page.reload();
    await page
      .getByText("1/1 · saved practice result", { exact: false })
      .waitFor();
    await page.getByText("Rebuild practice questions", { exact: true }).click();
    assert(
      await page
        .getByRole("button", { name: "Rebuild quiz and flashcards" })
        .isEnabled(),
    );
    await page.goto(`http://localhost:3151/lesson/${job.id}/notes#page-1`);
    await page.getByText("Reading & accessibility", { exact: true }).click();
    await page.getByLabel("View", { exact: true }).selectOption("reading");
    await page.getByLabel("Text size", { exact: true }).selectOption("28");
    await page.getByLabel("Line width", { exact: true }).selectOption("56");
    await page.getByLabel("Hide secondary tools", { exact: true }).check();
    await page
      .getByRole("button", { name: "Save reading preferences", exact: true })
      .click();
    await page.getByText(/Preferences saved to your account/).waitFor();
    await page.reload();
    await page.locator(".reading-page").waitFor();
    assert.equal(await page.locator(".reading-page math").count(), 1);
    assert.equal(await page.locator("#page-1").count(), 1);
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        `Reader overflow at ${width}`,
      );
      await page.screenshot({
        path: `output/live-audit/studio/reader-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 768, height: 1000 });
    await page.evaluate(() => {
      document.body.style.zoom = "2";
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      "Reader overflow at 200% zoom",
    );
    await page.screenshot({
      path: "output/live-audit/studio/reader-zoom.png",
      fullPage: true,
    });
    await page.evaluate(() => {
      document.body.style.zoom = "1";
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`http://localhost:3151/presentations?draft=${draft.id}`);
    await page.getByLabel("Slide 2 outline").fill("Cell structure");
    await page
      .getByRole("button", { name: "Save outline", exact: true })
      .click();
    await page.getByText("Outline saved to your account.").waitFor();
    await page.reload();
    await page.getByLabel("Slide 2 outline").waitFor();
    assert.equal(
      await page.getByLabel("Slide 2 outline").inputValue(),
      "Cell structure",
    );
    await page.goto(`http://localhost:3151/presentations/${deck.id}`);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .waitFor();
    await page
      .getByLabel("Title", { exact: true })
      .fill("Updated biology deck");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.getByText("Saved to your account.", { exact: true }).waitFor();
    await page.reload();
    assert.equal(
      await page.getByLabel("Title", { exact: true }).inputValue(),
      "Updated biology deck",
    );
    await page.getByRole("button", { name: "Present", exact: true }).click();
    const audienceReady = context.waitForEvent("page");
    await page
      .getByRole("button", { name: "Open audience window", exact: true })
      .click();
    const audiencePage = await audienceReady;
    await audiencePage.locator(".deck-canvas").waitFor();
    assert(
      !(await audiencePage.locator("body").innerText()).includes(
        "Only the presenter",
      ),
    );
    await audiencePage.screenshot({
      path: "output/live-audit/studio/audience.png",
    });
    await page
      .getByRole("button", { name: "Save rehearsal timing", exact: true })
      .click();
    await page
      .getByText("Rehearsal timing saved. No audio was recorded.", {
        exact: true,
      })
      .last()
      .waitFor();
    await page.getByRole("button", { name: "Exit · Esc", exact: true }).click();
    await audiencePage.close();
    await page.getByRole("button", { name: "objects", exact: true }).click();
    await page
      .getByRole("button", { name: "＋ Text box", exact: true })
      .click();
    await page
      .getByLabel("Object text", { exact: true })
      .fill("लंबा पाठ और English text ".repeat(25));
    await page.getByLabel("Width %", { exact: true }).fill("10");
    await page.getByLabel("Height %", { exact: true }).fill("5");
    await page.getByLabel("Font pt", { exact: true }).fill("72");
    await page
      .getByRole("status", { name: "Preview clipping warnings" })
      .waitFor();
    await page.screenshot({
      path: "output/live-audit/studio/measured-clipping.png",
      fullPage: true,
    });
    await page
      .getByLabel("Object text", { exact: true })
      .fill("Review this short statement.");
    await page.getByLabel("Width %", { exact: true }).fill("70");
    await page.getByLabel("Height %", { exact: true }).fill("20");
    await page.getByLabel("Font pt", { exact: true }).fill("18");
    await page
      .getByRole("status", { name: "Preview clipping warnings" })
      .waitFor({ state: "detached" });
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.getByText("Saved to your account.", { exact: true }).waitFor();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 2,
        ),
        `Studio overflow at ${width}`,
      );
      await page.screenshot({
        path: `output/live-audit/studio/studio-${width}.png`,
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS browser: authenticated dashboard/review, saved quiz refresh, durable outline edits, saved deck changes, no page errors or overflow at 320/390/768/1440px.",
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
