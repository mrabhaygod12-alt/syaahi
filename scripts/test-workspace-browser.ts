import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, webkit, devices } from "playwright";
import sharp from "sharp";
async function main() {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-writer-browser-"));
  process.env.DATA_BACKEND = "sqlite";
  process.env.MONGODB_URI = "";
  process.env.APP_ROLE = "all";
  process.env.NEXT_DIST_DIR = ".next-validation";
  process.env.BACKEND_URL = "";
  process.env.WORKER_MODE = "external";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3139";
  const { register, startSession } = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { setWorkspace } = await import("../lib/workspace-preference");
  const user = await register(
    "Browser Writer",
    "browser-writer@example.test",
    "browser-test-password",
  );
  await markEmailVerified(user.id);
  const { enrollWriter } = await import("../lib/writing/profile");
  await enrollWriter(user);
  await setWorkspace(user.id, "writer");
  const response = await startSession(
      user,
      new Request("http://localhost:3139"),
    ),
    [name, value] = response.headers
      .get("set-cookie")!
      .split(";")[0]
      .split("=");
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3139"],
    {
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch("http://localhost:3139/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    const page = await context.newPage();
    await page.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://localhost:3139/signup?workspace=writer&next=%2Fwriter",
    );
    await page.waitForFunction(
      () =>
        (
          document.querySelector(
            'input[name="workspace"][value="writer"]',
          ) as HTMLInputElement
        )?.checked,
    );
    const loginLink = new URL(
      (await page
        .getByRole("link", { name: "Log in", exact: true })
        .last()
        .getAttribute("href"))!,
      "http://localhost:3139",
    );
    assert.equal(loginLink.searchParams.get("workspace"), "writer");
    assert.equal(loginLink.searchParams.get("next"), "/writer");
    await page.goto(
      "http://localhost:3139/signup?workspace=writer&next=%2F%5Cexample.test",
    );
    await page.waitForFunction(
      () =>
        (
          document.querySelector(
            'input[name="workspace"][value="writer"]',
          ) as HTMLInputElement
        )?.checked,
    );
    assert.equal(
      new URL(
        (await page
          .getByRole("link", { name: "Log in", exact: true })
          .last()
          .getAttribute("href"))!,
        "http://localhost:3139",
      ).searchParams.has("next"),
      false,
      "External-style return URLs are not carried between auth pages",
    );
    await page.goto("http://localhost:3139/dashboard");
    await page.waitForURL("**/writer/welcome");
    await page.locator(".writer-welcome").waitFor();
    await page.goto("http://localhost:3139/writer");
    await page
      .getByRole("heading", { name: "For the curious mind." })
      .waitFor();
    assert(
      await page
        .getByRole("heading", {
          name: "For the curious mind.",
        })
        .isVisible(),
    );
    await page.goto("http://localhost:3139/write");
    await page.getByRole("textbox", { name: "Story editor" }).waitFor();
    await page.locator("#story-title").fill("A useful university study guide");
    const editor = page.getByRole("textbox", { name: "Story editor" });
    await editor.fill("How active recall works");
    await page.getByRole("button", { name: "Heading 2", exact: true }).click();
    await editor.press("End");
    await editor.press("Enter");
    await editor.press("Enter");
    await editor.pressSequentially(
      "Read your notes, close the book, and explain the concept in your own words. Check errors against your source and review weak ideas again tomorrow.",
    );
    await page.getByText("Saved to your account.", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Insert", exact: true }).click();
    await page.getByRole("button", { name: "Image", exact: true }).click();
    const image = await sharp({
      create: { width: 600, height: 350, channels: 3, background: "#b4d7c1" },
    })
      .png()
      .toBuffer();
    await page.locator('input[type="file"]').setInputFiles({
      name: "study.png",
      mimeType: "image/png",
      buffer: image,
    });
    await page
      .getByLabel("Describe the image for readers")
      .fill("A green study illustration");
    await page.getByRole("button", { name: "Upload and insert" }).click();
    await page.locator(".writer-content img").waitFor();
    const imageUrl = await page
      .locator(".writer-content img")
      .getAttribute("src");
    assert(imageUrl?.startsWith("/api/writing/images/"));
    assert.equal(
      (await page.request.get(`http://localhost:3139${imageUrl}`)).status(),
      200,
    );
    const anonymous = await browser.newContext();
    try {
      assert.equal(
        (
          await anonymous.request.get(`http://localhost:3139${imageUrl}`)
        ).status(),
        404,
        "Draft images are not exposed to anonymous visitors or crawlers",
      );
    } finally {
      await anonymous.close();
    }
    await page.getByText("Saved to your account.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    assert((await page.locator(".story-prose h2").count()) > 0);
    assert(await page.getByAltText("A green study illustration").isVisible());
    await page.reload();
    await page.getByRole("textbox", { name: "Story editor" }).waitFor();
    await page.locator(".writer-content img").waitFor();
    assert.equal(
      await page.locator("#story-title").inputValue(),
      "A useful university study guide",
    );
    mkdirSync("output/workspace-upgrade", { recursive: true });
    await page.screenshot({
      path: "output/workspace-upgrade/writer-desktop.png",
      fullPage: true,
    });
    await page.goto("http://localhost:3139/pricing");
    await page.waitForURL("**/writer/membership");
    await page.getByRole("heading", { name: "Free", exact: true }).waitFor();
    for (const tier of ["Free", "Starter", "Pro", "Max", "Team"])
      assert(
        await page
          .getByRole("heading", { name: tier, exact: true })
          .isVisible(),
      );
    await page
      .getByRole("link", { name: "Choose Starter", exact: false })
      .click();
    await page.waitForURL("**/writer/subscribe/starter");
    await page.getByRole("button", { name: "Continue to Razorpay" }).waitFor();
    assert(
      await page
        .getByRole("button", { name: "Continue to Razorpay" })
        .isDisabled(),
    );
    // Explicitly sign in to the student space before testing student features.
    const switchResponse = await page.request.post(
      "http://localhost:3139/api/auth",
      {
        headers: { origin: "http://localhost:3139" },
        data: {
          email: user.email,
          password: "browser-test-password",
          mode: "login",
          workspace: "student",
          acceptTerms: true,
          termsVersion: "2026-10-03",
        },
      },
    );
    assert.equal(switchResponse.status(), 200);
    await page.goto("http://localhost:3139/presentations");
    await page
      .getByRole("heading", { name: "Create a presentation", exact: true })
      .waitFor();
    assert(
      await page
        .getByRole("heading", { name: "Create a presentation", exact: true })
        .isVisible(),
    );
    assert.equal(
      await page.locator('input[type="number"]').getAttribute("max"),
      "6",
    );
    assert.equal(
      await page
        .locator('a[href^="/writer"],a[href="/write"],a[href="/writing"]')
        .count(),
      0,
    );
    const writerLogin = await page.request.post(
      "http://localhost:3139/api/auth",
      {
        headers: { origin: "http://localhost:3139" },
        data: {
          email: user.email,
          password: "browser-test-password",
          mode: "login",
          workspace: "writer",
          acceptTerms: true,
          termsVersion: "2026-10-03",
        },
      },
    );
    assert.equal(writerLogin.status(), 200);
    assert.deepEqual(errors, []);
    for (const engine of [chromium, webkit]) {
      const mobileBrowser = await engine.launch();
      const mobile = await mobileBrowser.newContext({
        ...devices["iPhone 13"],
        browserName: undefined,
      } as any);
      await mobile.addCookies([
        { name, value, domain: "localhost", path: "/" },
      ]);
      const p = await mobile.newPage();
      await p.addInitScript(() =>
        localStorage.setItem("syaahi-privacy-v1", "essential"),
      );
      for (const path of [
        "/writer",
        "/write",
        "/pricing",
        "/presentations",
        "/subscribe/starter",
        "/login",
      ]) {
        await p.goto(`http://localhost:3139${path}`);
        await p.waitForTimeout(700);
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(overflow, false, `${engine.name()} overflow ${path}`);
      }
      await p.goto("http://localhost:3139/write");
      await p.screenshot({
        path: `output/workspace-upgrade/writer-${engine.name()}-phone.png`,
        fullPage: true,
      });
      await mobileBrowser.close();
    }
    console.log(
      "PASS: writer role routing, real editor headings/image upload, autosave/reopen/preview, monthly pricing and consent gating, and Chromium/WebKit iPhone 13 overflow checks.",
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
