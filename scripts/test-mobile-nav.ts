import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, webkit, devices } from "playwright";

async function main() {
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3138"],
    {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        APP_ROLE: "all",
        NEXT_DIST_DIR: ".next-validation",
        DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-nav-")),
        DATA_BACKEND: "sqlite",
        MONGODB_URI: "",
        BACKEND_URL: "",
        NEXT_PUBLIC_APP_URL: "http://localhost:3138",
      },
    },
  );
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch("http://localhost:3138/login")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    for (const engine of [chromium, webkit]) {
      const browser = await engine.launch();
      try {
        for (const size of [
          { width: 390, height: 844 },
          { width: 844, height: 390 },
          { width: 320, height: 568 },
        ]) {
          const context = await browser.newContext({
            ...devices["iPhone 13"],
            viewport: size,
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("requestfailed", (request) => {
            if (request.url().startsWith("http://localhost:3138/"))
              console.error(
                "Local asset failed:",
                request.url(),
                request.failure()?.errorText,
              );
          });
          await page.addInitScript(() =>
            localStorage.setItem("syaahi-privacy-v1", "essential"),
          );
          await page.route("**/api/**", (r) =>
            r.fulfill({ json: { user: null } }),
          );
          await page.goto("http://localhost:3138/login");
          await page.waitForLoadState("networkidle");
          const nav = page.locator("#site-navigation");
          await page.getByRole("button", { name: "Open navigation" }).click();
          assert.equal(await nav.getByRole("link").count(), 3);
          for (const label of ["Workspace", "Subjects", "Plans"])
            assert(
              await nav
                .getByRole("link", { name: label, exact: true })
                .isVisible(),
            );
          assert.equal(
            await nav.locator('a[href^="/writer"],a[href="/writing"]').count(),
            0,
          );
          const box = await nav
            .getByRole("link", { name: "Plans", exact: true })
            .boundingBox();
          assert(
            box && box.y + box.height <= size.height + 1,
            "Last navigation link stays reachable",
          );
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            "No horizontal overflow",
          );
          await page.keyboard.press("Escape");
          assert.equal(await nav.isVisible(), false);
          await page.getByRole("button", { name: "Open navigation" }).click();
          if (size.height > 600) await page.mouse.click(5, size.height - 5);
          else
            await page
              .getByRole("button", { name: "Close navigation" })
              .click();
          assert.equal(await nav.isVisible(), false);
          for (const path of [
            "/",
            "/about",
            "/privacy",
            "/delivery",
            "/pricing",
            "/writing",
            "/features",
            "/blog",
          ]) {
            const response = await page.goto(`http://localhost:3138${path}`);
            assert.equal(response?.status(), 200, `Page ${path} must load`);
            await page.locator("main h1").waitFor();
            await page.waitForLoadState("networkidle");
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `No overflow on ${path} at ${size.width}px`,
            );
            assert.equal(
              await page.locator("main h1").count(),
              1,
              `One primary heading on ${path}`,
            );
          }
          assert.deepEqual(
            errors,
            [],
            `${engine.name()} ${size.width}px page errors`,
          );
          await context.close();
        }
      } finally {
        await browser.close();
      }
    }
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      await page.route("**/api/**", (r) => r.fulfill({ json: { user: null } }));
      await page.goto("http://localhost:3138/");
      for (const label of [
        "For learners",
        "For writers",
        "Read stories",
        "Plans",
      ])
        assert(
          await page
            .locator("#site-navigation")
            .getByRole("link", { name: label, exact: true })
            .isVisible(),
        );
      assert.equal(
        await page.getByRole("button", { name: "Open navigation" }).isVisible(),
        false,
      );
      assert.equal(
        await page.locator('script[src*="insights"]').count(),
        0,
        "Optional analytics absent before consent",
      );
      await page.getByRole("button", { name: "Essential only" }).click();
      assert.equal(
        await page.locator(".nav-popover").count(),
        0,
        "Header uses a compact set of direct links",
      );
      const schemas = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      const application = schemas
        .map((text) => JSON.parse(text))
        .find((schema) => schema["@type"] === "WebApplication");
      assert.deepEqual(
        application.audience.map(
          (audience: { audienceType: string }) => audience.audienceType,
        ),
        ["Students", "Teachers", "Professionals", "Writers"],
      );
      const faq = schemas
        .map((text) => JSON.parse(text))
        .find((schema) => schema["@type"] === "FAQPage");
      for (const question of faq.mainEntity) {
        assert(
          (await page.getByText(question.name, { exact: true }).count()) > 0,
          "Schema question is visible in the page",
        );
        assert(
          (await page
            .getByText(question.acceptedAnswer.text, { exact: true })
            .count()) > 0,
          "Schema answer matches displayed copy",
        );
      }
      await page.locator("main h1").waitFor();
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo(0, 0);
      });
      assert.equal(
        await page
          .locator(".skip-link")
          .evaluate((e) => getComputedStyle(e).position),
        "fixed",
      );
      await page
        .getByRole("button", { name: "Privacy preferences", exact: true })
        .click();
      assert(
        await page.getByRole("button", { name: "Essential only" }).isVisible(),
      );
      await page.getByRole("button", { name: "Essential only" }).click();
      mkdirSync("output/qa", { recursive: true });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "output/qa/home-desktop-top.png" });
      for (const section of await page
        .locator(".landing-page [data-reveal]")
        .all()) {
        await section.scrollIntoViewIfNeeded();
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(800);
      assert.equal(
        await page
          .locator(".landing-page [data-reveal]:not(.is-visible)")
          .count(),
        0,
        "Every animated section is revealed by scrolling",
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: "output/qa/home-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("main h1").waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: "output/qa/home-mobile.png",
        fullPage: true,
      });
      await page.screenshot({ path: "output/qa/home-mobile-top.png" });
      await page.goto("http://localhost:3138/writing");
      await page.locator("main h1").waitFor();
      await page.screenshot({
        path: "output/qa/writing-mobile.png",
        fullPage: true,
      });
      const response = await page.request.get("http://localhost:3138/.env");
      assert.equal(response.status(), 404);
      for (const path of [
        "/.git/config",
        "/data/private.sqlite",
        "/backups/archive.zip",
      ])
        assert.equal(
          (await page.request.get(`http://localhost:3138${path}`)).status(),
          404,
        );
      const admin = await page.request.get(
        "http://localhost:3138/admin/publications",
        { maxRedirects: 0 },
      );
      // A redirect after Next.js has streamed the loading shell is encoded in
      // the HTML instead of changing an already-sent HTTP status.
      if (admin.status() === 307)
        assert.match(admin.headers().location, /^\/login\?/);
      else {
        assert.equal(admin.status(), 200);
        const html = await admin.text();
        assert.match(html, /NEXT_REDIRECT|http-equiv="refresh"/);
        assert.match(html, /\/login\?next=/);
      }
      const home = await page.request.get("http://localhost:3138/");
      assert.equal(home.headers()["x-content-type-options"], "nosniff");
      assert(!home.headers()["x-powered-by"]);
      assert.match(
        home.headers()["content-security-policy"],
        /object-src 'none'/,
      );
      assert.equal(
        (await page.request.get("http://localhost:3138/icon.svg")).status(),
        200,
      );
      const reduced = await browser.newContext({
        viewport: { width: 320, height: 568 },
        reducedMotion: "reduce",
      });
      const reducedPage = await reduced.newPage();
      await reducedPage.route("**/api/**", (r) =>
        r.fulfill({ json: { user: null } }),
      );
      await reducedPage.goto("http://localhost:3138/");
      await reducedPage.waitForFunction(() =>
        Array.from(
          document.querySelectorAll(".landing-page [data-reveal]"),
        ).every((n) => getComputedStyle(n).opacity === "1"),
      );
      assert.equal(
        await reducedPage
          .locator(".scene-sheet")
          .first()
          .evaluate((n) => getComputedStyle(n).animationName),
        "none",
      );
      await reduced.close();
      const withoutJs = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
      });
      const plainPage = await withoutJs.newPage();
      await plainPage.goto("http://localhost:3138/");
      assert.equal(
        await plainPage
          .locator(".landing-hero-copy")
          .evaluate((n) => getComputedStyle(n).opacity),
        "1",
        "Landing copy remains visible without JavaScript",
      );
      assert(
        await plainPage
          .getByRole("link", { name: "Start learning ↗", exact: true })
          .first()
          .isVisible(),
      );
      await withoutJs.close();
    } finally {
      await browser.close();
    }
    console.log(
      "PASS: Chromium + WebKit phone layouts and desktop; navigation, overflow, consent, favicon and security headers.",
    );
  } finally {
    server.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
