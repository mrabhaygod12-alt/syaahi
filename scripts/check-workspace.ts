import { chromium } from "playwright";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import {
  createJob,
  claimJob,
  commitPage,
  finishJob,
  updateJob,
} from "../lib/jobs/store";
async function main() {
  const base = "http://localhost:3101";
  const result = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "signup", acceptTerms:true,termsVersion:"2026-09-24",
      name: "Workspace QA",
      email: `qa-ui-${Date.now()}@example.test`,
      password: randomBytes(18).toString("hex"),
    }),
  });
  assert.equal(result.status, 200);
  const { user } = await result.json();
  const cookie = result.headers.get("set-cookie")!.split(";")[0];
  const job = await createJob(user.id, ["Evidence handling"], "concise");
  const lease = (await claimJob(job.id))!;
  const markdown =
    "## Evidence handling\n\n**Definition:** A documented process preserves the identity and integrity of evidence.\n\n### Key ideas\n- Record the **source** and time.\n- Preserve the **original** safely.\n- Document each transfer.\n\nDiagram: flow | Identify evidence | Record and label | Preserve original | Document transfer\n\nDiagram: decision | Is the transfer documented? | Yes: verify details | No: resolve the gap\n\n**Summary:** Clear records make each handling step traceable.";
  await commitPage(job.id, lease.token, 0, {
    topic: "Evidence handling",
    markdown,
    provider: "QA fixture",
    model: "hand-authored",
  });
  await finishJob(job.id, lease.token);
  await updateJob(job.id, {
    practice: {
      quiz: [
        {
          q: "What should be preserved?",
          type: "mcq",
          options: ["Original", "Only a summary", "Nothing", "Only a label"],
          answer: "Original",
        },
      ],
      flashcards: [
        { front: "What should each transfer have?", back: "A clear record." },
      ],
    },
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const [name, value] = cookie.split("=");
  await context.addCookies([
    { name, value, url: base, httpOnly: true, sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/lesson/${job.id}/notes`);
  await page.getByRole("button", { name: "Edit notes", exact: true }).waitFor();
  await page.frameLocator("iframe").locator("html[data-ready=true]").waitFor();
  await page.screenshot({
    path: "output/qa/lesson-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Edit section Markdown" })
    .fill(markdown + "\n\nEdited in the browser.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Edit notes", exact: true }).waitFor();
  await page
    .getByText("Notes saved. Generate new practice after editing.")
    .waitFor();
  await updateJob(job.id, {
    practice: {
      quiz: [
        {
          q: "What should be preserved?",
          type: "mcq",
          options: ["Original", "Only a summary", "Nothing", "Only a label"],
          answer: "Original",
        },
      ],
      flashcards: [
        { front: "What should each transfer have?", back: "A clear record." },
      ],
    },
  });
  await page.goto(`${base}/lesson/${job.id}/quiz`);
  await page.getByRole("button", { name: "A Original", exact: true }).click();
  assert(await page.getByText("Answered 1 of 1").isVisible());
  await page.goto(`${base}/lesson/${job.id}/flashcards`);
  await page
    .getByRole("button", { name: /What should each transfer have/ })
    .click();
  await page.getByRole("button", { name: "good", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/lesson/${job.id}/notes`);
  await page.getByRole("button", { name: "Edit notes", exact: true }).waitFor();
  await page.screenshot({
    path: "output/qa/lesson-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: authenticated note preview, browser edit, quiz feedback, flashcard self-rating, and mobile layout.",
  );
  await browser.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
