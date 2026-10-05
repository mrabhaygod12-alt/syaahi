import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
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
    markdown: "## Cells\nCells contain genetic information.",
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
    await context.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
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
    await page.goto(`http://localhost:3151/lesson/${job.id}/quiz`);
    await page.getByRole("button", { name: "Start saved attempt" }).click();
    await page.getByRole("button", { name: /Genetic information/ }).click();
    await page
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    await page.getByRole("button", { name: "Submit and review" }).click();
    await page.reload();
    await page
      .getByText("1/1 · saved practice result", { exact: false })
      .waitFor();
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
