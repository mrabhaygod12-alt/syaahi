import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const context = await browser.newContext({ permissions: ["microphone"] });
const page = await context.newPage();
let uploads = 0;
await page.route("**/api/transcribe", async (route) => {
  uploads++;
  assert(
    route.request().headers()["content-type"].includes("multipart/form-data"),
  );
  await route.fulfill({
    json: {
      text: "A recorded lecture explains how to preserve evidence and document each transfer.",
    },
  });
});
await page.goto("http://localhost:3101/dashboard");
await page.getByRole("button", { name: "◉ Record", exact: true }).click();
await page.getByRole("button", { name: /■ Stop/ }).waitFor();
await page.waitForTimeout(1100);
await page.getByRole("button", { name: /■ Stop/ }).click();
await page
  .getByText("lecture-recording.webm", { exact: false })
  .first()
  .waitFor();
assert.equal(uploads, 1);
await page.getByRole("button", { name: "◉ Record", exact: true }).click();
await page.getByRole("button", { name: "Cancel", exact: true }).click();
assert.equal(uploads, 1);
await browser.close();
console.log(
  "PASS: browser microphone recording, stop-to-upload and cancel without upload (synthetic microphone; transcription response stubbed).",
);
