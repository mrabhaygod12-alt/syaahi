import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { fixturePdf } from "./fixtures/pdf";
const origin = "http://localhost:3193";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-csp-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  WORKER_MODE: "external",
  BACKEND_URL: "",
  NEXT_DIST_DIR: ".next-validation",
  NEXT_PUBLIC_APP_URL: origin,
});
async function main() {
  const auth = await import("../lib/auth/server");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  const user = await auth.register(
    "PDF learner",
    "pdf-browser@example.test",
    "fixture-password-safe",
  );
  await markEmailVerified(user.id);
  const cookie = (await auth.startSession(user, new Request(origin))).headers
    .get("set-cookie")!
    .split(";")[0];
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3193"],
    { env: process.env, windowsHide: true, stdio: "ignore" },
  );
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const uploaded = await page.request.post(origin + "/api/syllabus", {
      headers: { origin, cookie },
      multipart: {
        file: {
          name: "lecture.pdf",
          mimeType: "application/pdf",
          buffer: fixturePdf(),
        },
      },
    });
    assert.equal(uploaded.status(), 200, await uploaded.text());
    assert.match(
      (await uploaded.json()).text,
      /normalization/,
      "Built API runs the isolated PDF child process",
    );
    await page.addInitScript(() => {
      (window as any).__violations = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        (window as any).__violations.push(e.effectiveDirective);
      });
    });
    const response = await page.goto(origin + "/login");
    const policy = response!.headers()["content-security-policy"];
    assert(policy.includes("'nonce-"));
    await page
      .getByRole("button", { name: "Essential only", exact: true })
      .click();
    await page
      .getByRole("radio", { name: "Write & publish", exact: true })
      .check();
    await page.getByText("YOUR WRITING SPACE", { exact: true }).waitFor();
    assert.deepEqual(
      await page.evaluate(() => (window as any).__violations),
      [],
      "Ordinary hydration has no CSP violations",
    );
    const firstNonce = await page
      .locator('meta[name="csp-nonce"]')
      .getAttribute("content");
    const injectedPage = await browser.newPage();
    await injectedPage.addInitScript(() => {
      (window as any).__violations = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        (window as any).__violations.push(e.effectiveDirective);
      });
    });
    await injectedPage.route(origin + "/login", async (route) => {
      const upstream = await route.fetch();
      const html = (await upstream.text()).replace(
        /<body([^>]*)>/,
        '<body$1><script>window.__untrustedExecuted=true</script><img style="display:none" src="/missing-csp-fixture.png" onerror="window.__eventExecuted=true">',
      );
      await route.fulfill({ response: upstream, body: html });
    });
    await injectedPage.goto(origin + "/login");
    await injectedPage.waitForTimeout(150);
    assert.equal(
      await injectedPage.evaluate(() => (window as any).__untrustedExecuted),
      undefined,
    );
    assert.equal(
      await injectedPage.evaluate(() => (window as any).__eventExecuted),
      undefined,
    );
    const injectedBlocked = await injectedPage.evaluate(
      () => (window as any).__violations as string[],
    );
    assert(injectedBlocked.includes("script-src-elem"));
    assert(injectedBlocked.includes("script-src-attr"));
    await injectedPage.close();
    await page.evaluate(async () => {
      try {
        await fetch("https://example.invalid/blocked-egress");
      } catch {}
    });
    await page.waitForTimeout(100);
    const blocked = await page.evaluate(
      () => (window as any).__violations as string[],
    );
    assert(blocked.includes("connect-src"));
    await page.goto(origin + "/examples?sample=dbms");
    assert.notEqual(
      await page.locator('meta[name="csp-nonce"]').getAttribute("content"),
      firstNonce,
      "Navigation receives a fresh nonce",
    );
    await page
      .getByRole("button", { name: "Open handwritten print preview" })
      .click();
    const frame = page.frameLocator(".print-note iframe");
    await frame.locator('html[data-ready="true"]').waitFor();
    assert(
      await frame
        .getByText("Start with dependencies", { exact: false })
        .first()
        .isVisible(),
    );
    assert.deepEqual(
      await page.evaluate(() => (window as any).__violations),
      [],
      "Sandboxed pagination runs under the parent nonce policy",
    );
    console.log(
      "PASS browser CSP: fresh nonces, working auth hydration, blocked inline scripts/event handlers/unknown egress and working sandboxed print pagination.",
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
