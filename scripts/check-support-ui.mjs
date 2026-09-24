import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3101/signup");
assert(
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .isDisabled(),
);
assert(
  await page.getByRole("button", { name: "Continue with Google" }).isDisabled(),
);
await page.getByLabel("Full name").fill("Support UI QA");
await page
  .getByLabel("Email", { exact: true })
  .fill(`support-ui-${Date.now()}@example.test`);
await page.getByLabel("Password", { exact: true }).fill("long-test-password");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create account", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.goto("http://localhost:3101/support");
await page
  .getByLabel("Subject", { exact: true })
  .fill("Need help with note export");
await page
  .getByLabel("What happened?")
  .fill(
    "I need help understanding how continuation pages work in the PDF export.",
  );
await page.getByRole("button", { name: "Create support ticket" }).click();
await page.getByLabel("Your reply").waitFor();
await page
  .getByLabel("Your reply")
  .fill("The lesson contains three planned sections.");
await page.getByRole("button", { name: "Send reply" }).click();
await page
  .getByText("The lesson contains three planned sections.", { exact: true })
  .waitFor();
await page.getByRole("button", { name: "Mark resolved" }).click();
await page.getByRole("button", { name: "Reopen ticket" }).waitFor();
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await page.screenshot({ path: "output/qa/support-mobile.png", fullPage: true });
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "PASS: mobile consent gate, signup, support ticket creation, reply, resolve and responsive layout.",
);
