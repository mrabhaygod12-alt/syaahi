import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const origin = "http://localhost:3163";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-notes-reliability-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  BACKEND_URL: "",
  WORKER_MODE: "external",
  NEXT_DIST_DIR: ".next-validation",
  NEXT_PUBLIC_APP_URL: origin,
});

async function main() {
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    jobs = await import("../lib/jobs/store");
  const user = await auth.register(
      "Notes Reliability Student",
      "notes-reliability@example.test",
      "safe-reliability-password",
    ),
    userSession = await auth.startSession(user, new Request(origin)),
    cookie = userSession.headers.get("set-cookie")!.split(";")[0];
  await markEmailVerified(user.id);
  const job = await jobs.createJob(user.id, ["Cell biology"], "concise"),
    lease = (await jobs.claimJob(job.id))!;
  await jobs.commitPage(job.id, lease.token, 0, {
    topic: "Cell biology",
    markdown:
      "# Cell biology\n\nCells store genetic information in DNA. The cell membrane controls what enters and leaves the cell.\n\n## Worked example\nA plant cell uses chloroplasts to capture light energy.",
    provider: "fixture",
    model: "fixture",
  });
  await jobs.finishJob(job.id, lease.token);
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3163"],
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
        if ((await fetch(origin + "/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert(ready, "Local application did not start");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      acceptDownloads: true,
    });
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    await context.addInitScript(() => {
      if (window === window.top) {
        localStorage.setItem("syaahi-privacy-v1", "essential");
        (window as any).__syaahiPrintCalled = false;
        window.print = () => {
          (window as any).__syaahiPrintCalled = true;
        };
      }
    });
    const page = await context.newPage();
    await page.goto(`${origin}/lesson/${job.id}/notes`);
    await page.getByRole("heading", { name: "Cell biology" }).waitFor();
    await page.getByLabel("Notebook view").selectOption("print");
    await page.locator(".print-note iframe").waitFor();

    let exportAttempts = 0;
    await page.route("**/api/export", async (route) => {
      exportAttempts++;
      if (exportAttempts === 1) await route.abort("failed");
      else await route.continue();
    });
    const downloadWait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloadWait;
    assert.equal(download.suggestedFilename(), `syaahi-${job.id}.pdf`);
    assert.equal(
      exportAttempts,
      2,
      "A transient fetch failure is retried once",
    );
    mkdirSync("output/qa", { recursive: true });
    const saved = `output/qa/notes-reliability-${job.id}.pdf`;
    await download.saveAs(saved);
    const bytes = await (await import("node:fs/promises")).readFile(saved);
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    assert(bytes.length > 1000, "The exported PDF contains a rendered page");

    await page.unroute("**/api/export");
    await page
      .getByRole("button", { name: "Print or save handwritten notes as PDF" })
      .click();
    assert.equal(
      await page.evaluate(() => (window as any).__syaahiPrintCalled),
      true,
      "Print/Save PDF fallback opens browser print",
    );

    await page.route("**/api/ask-stream", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      assert.match(body.question, /simpler language/i);
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body:
          'data: {"cites":[{"page":0,"topic":"Cell biology"}]}\n\n' +
          'data: {"t":"Cells store genetic information in DNA. [p. 1]"}\n\n' +
          'data: {"provider":"fixture","model":"fixture"}\n\n' +
          "data: [DONE]\n\n",
      });
    });
    await page.getByRole("button", { name: "Ask AI" }).first().click();
    await page.getByRole("button", { name: "Explain simply" }).click();
    await page
      .getByText("Cells store genetic information in DNA.", { exact: false })
      .waitFor();
    await page.getByRole("button", { name: /p\.1 · Cell biology/ }).waitFor();
    console.log(
      "PASS notes reliability: authenticated PDF download recovers after a transient failed fetch, browser print fallback works, and Ask AI prompt streams a page-cited answer.",
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
