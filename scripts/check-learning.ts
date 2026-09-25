import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { parseTeaching, teachingKey } from "../lib/study/teaching";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-learn-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";
const base = "http://localhost:3116";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3116"],
  { env: process.env, stdio: "ignore", windowsHide: true },
);
async function main() {
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    const signup = async (email: string) => {
      const r = await fetch(base + "/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          name: "Learning QA",
          email,
          password: "test-password-12345",
          acceptTerms: true,
          termsVersion: "2026-09-24",
        }),
      });
      assert.equal(r.status, 200);
      return {
        user: (await r.json()).user,
        cookie: r.headers.get("set-cookie")!.split(";")[0],
      };
    };
    const owner = await signup("learn@example.test"),
      other = await signup("other@example.test");
    const { createJob, claimJob, commitPage, finishJob } =
      await import("../lib/jobs/store");
    const { mutateState } = await import("../lib/study/state");
    const job = await createJob(
      owner.user.id,
      ["Evidence handling"],
      "concise",
    );
    const lease = (await claimJob(job.id))!;
    const pages = [
      {
        topic: "Evidence handling",
        markdown:
          "## Evidence handling\nPreserve the original and document each transfer to maintain a chain of custody.",
        provider: "fixture",
        model: "fixture",
      },
    ];
    await commitPage(job.id, lease.token, 0, pages[0]);
    await finishJob(job.id, lease.token);
    const unit = parseTeaching(
      JSON.stringify({
        objective: "Explain why evidence transfers need records.",
        explanation:
          "A transfer record makes the movement of evidence traceable. Preserving the original protects its integrity.",
        example:
          "Illustrative example: an investigator records who hands an original device to an analyst, and when.",
        question: "What makes evidence transfers traceable?",
        options: [
          "Recording each transfer",
          "Skipping records",
          "Deleting originals",
          "Only making summaries",
        ],
        answer: 0,
        feedback: "Recording each transfer preserves the chain of custody.",
      }),
    );
    assert.throws(() => parseTeaching('{"answer":9}'));
    const version = teachingKey(pages, "Exam preparation", "english");
    assert.notEqual(
      version,
      teachingKey([{ markdown: "changed" }], "Exam preparation", "english"),
    );
    await mutateState(
      "teaching",
      `learn:${job.id}:${version}:0`,
      unit,
      () => unit,
    );
    const post = (cookie: string, body: object) =>
      fetch(base + "/api/learn", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson: job.id,
          goal: "Exam preparation",
          version,
          index: 0,
          ...body,
        }),
      });
    assert.equal((await post(other.cookie, { action: "unit" })).status, 404);
    assert.equal(
      (await post(owner.cookie, { action: "unit", version: "stale" })).status,
      409,
    );
    const opened = await (await post(owner.cookie, { action: "unit" })).json();
    assert(!("answer" in opened.unit));
    assert(!("feedback" in opened.unit));
    let answer = await (
      await post(owner.cookie, { action: "answer", answer: 1 })
    ).json();
    assert.equal(answer.correct, false);
    assert.deepEqual(answer.progress.completed, []);
    assert.equal(answer.progress.attempts[0], 1);
    assert.equal(
      (await post(other.cookie, { action: "tutor", question: "Explain" }))
        .status,
      404,
    );
    assert.equal(
      (await post(owner.cookie, { action: "tutor", question: "" })).status,
      400,
    );
    if (process.env.LIVE_TUTOR === "1") {
      const live = await post(owner.cookie, {
        action: "tutor",
        question: "Why should I preserve the original?",
        phase: 0,
      });
      const response = await live.json();
      assert.equal(live.status, 200, response.error || "Live tutor failed");
      assert.equal(typeof response.answer, "string");
      assert(response.answer.length > 20);
      assert(!response.model && !response.provider);
      console.log(
        "PASS: live lesson tutor returned a grounded answer without model metadata.",
      );
    }
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const split = owner.cookie.indexOf("=");
    await page.context().addCookies([
      {
        name: owner.cookie.slice(0, split),
        value: owner.cookie.slice(split + 1),
        url: base,
      },
    ]);
    await page.goto(`${base}/lesson/${job.id}/learn`);
    await page.getByRole("button", { name: "Start lesson" }).click();
    await page.getByText(unit.explanation, { exact: true }).waitFor();
    await page.getByRole("button", { name: "Ask Syaahi", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByText("Lesson tutor", { exact: true })
      .waitFor();
    await page.screenshot({ path: "output/qa/lesson-tutor.png" });
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);

    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page.getByText(unit.example, { exact: true }).waitFor();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page
      .getByRole("button", { name: "Recording each transfer", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Section complete", exact: true })
      .waitFor();
    await page
      .getByText("Checkpoint passed · 2 attempts", { exact: true })
      .waitFor();
    mkdirSync("output/qa", { recursive: true });
    await page.screenshot({
      path: "output/qa/learning-desktop.png",
      fullPage: true,
    });
    await page.reload();
    await page.getByText("1 / 1 complete", { exact: false }).waitFor();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        `/lesson/${job.id}/learn`,
        `/lesson/${job.id}/notes`,
        "/",
      ]) {
        await page.goto(base + path);
        await page.waitForTimeout(500);
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          )
        )
          console.log(
            await page.evaluate(() =>
              Array.from(document.querySelectorAll("body *"))
                .filter((e) => e.getBoundingClientRect().right > innerWidth + 2)
                .slice(0, 15)
                .map((e) => ({
                  tag: e.tagName,
                  cls: e.className,
                  width: e.getBoundingClientRect().width,
                })),
            ),
          );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `overflow ${width} ${path}`,
        );
        if (path.endsWith("notes")) {
          assert.equal(await page.locator(".ws-top-tabs").count(), 0);
          const logo = await page.locator(".ws-brand svg").boundingBox();
          assert(logo && logo.width >= 28);
        }
        await page.screenshot({
          path: `output/qa/learning-${width}-${path === "/" ? "home" : path.split("/").pop()}.png`,
          fullPage: true,
        });
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: validated teaching JSON, access isolation, stale versions, hidden answers, wrong-answer safety, browser teaching/checkpoint/resume, logo/navigation and responsive layouts at 390/768/1440px. AI content is a deterministic fixture.",
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
