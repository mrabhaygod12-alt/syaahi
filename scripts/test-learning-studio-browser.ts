import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const origin = "http://localhost:3199";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-learning-browser-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  WORKER_MODE: "external",
  NEXT_DIST_DIR: ".next-validation",
  BACKEND_URL: "",
  NEXT_PUBLIC_APP_URL: origin,
});
async function main() {
  const auth = await import("../lib/auth/server"),
    jobs = await import("../lib/jobs/store");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  const { teachingKey, parseTeaching } = await import("../lib/study/teaching");
  const { mutateState } = await import("../lib/study/state");
  const { sectionGoals } = await import("../lib/lesson/sections");
  const user = await auth.register(
    "CS learner",
    "learning-browser@example.test",
    "safe-fixture-password",
  );
  await markEmailVerified(user.id);
  const cookie = (await auth.startSession(user, new Request(origin))).headers
    .get("set-cookie")!
    .split(";")[0];
  const [name, value] = cookie.split("=");
  const pages = [
    {
      topic: "Normalization",
      markdown:
        "## Normalization\nNormalization reduces redundant data. First normal form requires atomic values.",
      provider: "fixture",
      model: "fixture",
    },
    {
      topic: "Transactions",
      markdown:
        "## Transactions\nAtomicity means all operations succeed together or none are committed.",
      provider: "fixture",
      model: "fixture",
    },
  ];
  const job = await jobs.createJob(
    user.id,
    pages.map((p) => p.topic),
    "concise",
    {
      language: "english",
      context: "A private UG/PG computer science lesson.",
      sections: sectionGoals(
        pages.map((p) => p.topic),
        [
          {
            title: "Normalization",
            objective: "Explain why a database avoids redundant data.",
            prerequisite: "Relational tables",
          },
          {
            title: "Transactions",
            objective: "Describe an atomic transaction.",
            prerequisite: "SQL operations",
          },
        ],
      ),
    },
  );
  const lease = (await jobs.claimJob(job.id))!;
  for (let i = 0; i < pages.length; i++)
    await jobs.commitPage(job.id, lease.token, i, pages[i]);
  await jobs.finishJob(job.id, lease.token);
  const version = teachingKey(pages, "Exam preparation", "english");
  for (let i = 0; i < pages.length; i++) {
    const unit = parseTeaching(
      JSON.stringify({
        objective:
          i === 0
            ? "Explain why normalization reduces duplicate facts."
            : "Explain how atomicity protects a transaction.",
        explanation:
          i === 0
            ? "Normalization organizes a database so a fact need not be repeated unnecessarily. Fewer repeated facts reduce redundant data. First normal form requires atomic values in a table."
            : "Atomicity treats a transaction as one unit. Either every operation succeeds or none of them are committed.",
        example:
          "Illustrative example: a university stores each department name once, then uses a key to connect student records to it.",
        question: "What does normalization reduce?",
        options: ["Redundant data", "All data", "Every key", "Atomic values"],
        answer: 0,
        feedback: "Normalization reduces unnecessary repetition of facts.",
      }),
    );
    await mutateState(
      "teaching",
      `learn:${job.id}:${version}:${i}`,
      unit,
      () => unit,
    );
  }
  await jobs.updateJob(job.id, {
    practice: {
      settings: {
        size: 5,
        cardCount: 6,
        format: "mixed",
        difficulty: "standard",
        focus: "",
      },
      quiz: [
        {
          q: "What does normalization reduce?",
          type: "mcq",
          options: ["Redundant data", "All data", "Every key", "Atomic values"],
          answer: "Redundant data",
          hint: "Think of unnecessary repetition.",
          explanation:
            "The normalization notes identify redundant data as the problem.",
          topic: "Normalization",
          sources: [{ page: 0, topic: "Normalization" }],
        },
        {
          q: "Name the property that commits all operations or none.",
          type: "short",
          answer: "Atomicity",
          explanation:
            "The transaction section defines atomicity as all operations succeeding together.",
          topic: "Transactions",
          sources: [{ page: 1, topic: "Transactions" }],
        },
      ],
      flashcards: [
        {
          front: "What does normalization reduce?",
          back: "Redundant data.",
          type: "basic",
          topic: "Normalization",
          sources: [{ page: 0, topic: "Normalization" }],
        },
        {
          front: "{{c1::Atomicity}} commits all operations or none.",
          back: "Atomicity treats a transaction as one indivisible unit.",
          type: "cloze",
          topic: "Transactions",
          sources: [{ page: 1, topic: "Transactions" }],
        },
      ],
    },
  });
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3199"],
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
        if ((await fetch(origin + "/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert(ready, "A production .next-validation build must be available");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addCookies([{ name, value, url: origin }]);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    mkdirSync("output/learning-studio", { recursive: true });
    const checkLayout = async (label: string) => {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
          `${label} overflow at ${width}`,
        );
        await page.screenshot({
          path: `output/learning-studio/${label}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    };
    await page.goto(`${origin}/lesson/${job.id}/learn`);
    await page
      .getByRole("button", { name: "Essential only", exact: true })
      .click();
    await page
      .getByText("Explain why a database avoids redundant data.", {
        exact: true,
      })
      .waitFor();
    await page
      .getByText("Builds on: Relational tables", { exact: true })
      .waitFor();
    await checkLayout("lesson-outline");
    await page.getByRole("button", { name: /Start lesson/ }).click();
    await page
      .getByRole("heading", {
        name: "Explain why normalization reduces duplicate facts.",
      })
      .waitFor();
    await page
      .getByRole("button", { name: "2 · Worked example", exact: true })
      .click();
    await page
      .locator('.lesson-phase-nav button[aria-current="step"]')
      .filter({ hasText: "Worked example" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "Read original notes", exact: true })
        .getAttribute("href"),
      `/lesson/${job.id}/notes#page-1`,
    );
    await page.reload();
    await page.getByRole("button", { name: /Start lesson/ }).click();
    await page
      .locator('.lesson-phase-nav button[aria-current="step"]')
      .filter({ hasText: "Worked example" })
      .waitFor();
    await checkLayout("lesson-step");
    await page
      .getByRole("button", { name: "3 · Checkpoint", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Redundant data", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Section complete", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Back to contents", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Learn something new", exact: true })
      .click();
    await page.getByText("0 checkpoints passed", { exact: true }).waitFor();
    await page.goto(`${origin}/lesson/${job.id}/quiz`);
    await page
      .getByRole("button", { name: "Start saved attempt", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Show a hint", exact: true })
      .click();
    await page
      .getByText("Think of unnecessary repetition.", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: /All data/ }).click();
    await page
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    await page.getByText("Review this concept", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "Section 1 · Normalization", exact: true })
        .getAttribute("href"),
      `/lesson/${job.id}/notes#page-1`,
    );
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Name the property that commits all operations or none.",
        exact: true,
      })
      .waitFor();
    await page.reload();
    await page
      .getByRole("heading", {
        name: "Name the property that commits all operations or none.",
        exact: true,
      })
      .waitFor();
    await page.getByLabel("Your answer", { exact: true }).fill("Atomicity");
    await page
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Submit and review", exact: true })
      .click();
    await page
      .getByText("1/2 · saved practice result", { exact: false })
      .waitFor();
    await checkLayout("quiz-result");
    await page
      .getByRole("button", { name: "Retry missed questions", exact: false })
      .click();
    await page.getByText("QUESTION 1 OF 1", { exact: true }).waitFor();
    await page.getByRole("button", { name: /Redundant data/ }).click();
    await page
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Submit and review", exact: true })
      .click();
    await page
      .getByText("1/1 · saved practice result", { exact: false })
      .waitFor();
    await page.goto(`${origin}/lesson/${job.id}/flashcards`);
    await page
      .getByRole("button", { name: "Show answer", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Section 1 · Normalization", exact: true })
      .waitFor();
    await checkLayout("flashcard-answer");
    await page.getByRole("button", { name: /good \(3\)/i }).click();
    await page
      .getByText("_____ commits all operations or none.", { exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByText("_____ commits all operations or none.", { exact: true })
      .waitFor();
    const review = await page.request.get(`${origin}/api/study`);
    const saved = await review.json();
    assert.equal(Object.keys(saved.reviews[job.id]).length, 1);
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "dark"),
    );
    const cardColors = await page.locator(".flip-card").evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      text: getComputedStyle(el).color,
    }));
    assert.equal(cardColors.background, "rgb(32, 44, 37)");
    assert.equal(cardColors.text, "rgb(237, 242, 231)");
    await checkLayout("flashcard-dark");
    assert.deepEqual(errors, []);
    console.log(
      "PASS learning studio browser: objectives/prerequisites, phase resume, source links, hint/feedback, persisted quiz position, missed-only retry, saved flashcard schedule, and 320/390/768/1440px layouts without page errors.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
