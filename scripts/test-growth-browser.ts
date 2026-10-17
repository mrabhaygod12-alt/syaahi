import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-growth-browser-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.APP_ROLE = "all";
process.env.WORKER_MODE = "external";
process.env.NEXT_DIST_DIR = ".next-validation";
process.env.BACKEND_URL = "";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3157";
async function main() {
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards");
  const user = await auth.register(
    "University Student",
    "growth-browser@example.test",
    "safe-browser-password",
  );
  await markEmailVerified(user.id);
  const [name, value] = (
    await auth.startSession(user, new Request("http://localhost:3157"))
  ).headers
    .get("set-cookie")!
    .split(";")[0]
    .split("=");
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3157"],
    { env: process.env, windowsHide: true, stdio: "ignore" },
  );
  let browser: any;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch("http://localhost:3157/")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(),
      page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e: any) => errors.push(e.message));
    await page.goto("http://localhost:3157/");
    await page.locator(".growth-editorial").waitFor();
    for (const link of await page.locator(".editorial-index a").all()) {
      const destination = await link.getAttribute("href");
      assert.equal(
        await page.locator(destination!).count(),
        1,
        "Landing chapter links resolve",
      );
    }
    await page.locator(".growth-faq summary").first().click();
    assert(
      (await page
        .locator(".growth-faq details")
        .first()
        .getAttribute("open")) !== null,
    );
    const hero = page.locator(".growth-hero-note");
    await hero.hover({ position: { x: 40, y: 60 } });
    await page.waitForTimeout(300);
    assert(
      await hero.evaluate((node: HTMLElement) =>
        node.style.getPropertyValue("--depth-y"),
      ),
      "Desktop pointer drives bounded paper depth",
    );
    await page
      .getByRole("button", { name: "Essential only", exact: true })
      .click();
    await page
      .getByLabel("What are you studying?", { exact: true })
      .fill("DBMS normalization");
    await page.getByRole("button", { name: "Preview my topic" }).click();
    await page
      .locator(".growth-preview-output h3")
      .getByText("Normalization: design around dependencies")
      .waitFor();
    const next = await page
      .getByRole("link", { name: /Build my full lesson/ })
      .getAttribute("href");
    const signup = new URL(next!, "http://localhost:3157");
    assert.equal(signup.searchParams.get("workspace"), "student");
    assert.equal(
      new URL(signup.searchParams.get("next")!, signup.origin).searchParams.get(
        "topic",
      ),
      "DBMS normalization",
    );
    await page
      .getByLabel("Preview language", { exact: true })
      .selectOption("hindi");
    assert.equal(
      await page.locator(".growth-output-label span").last().innerText(),
      "English",
      "Output language must describe the rendered result until regenerated",
    );
    await page.getByRole("button", { name: "मेरा विषय देखें" }).click();
    await page
      .locator(".growth-preview-output h3")
      .getByText("नॉर्मलाइज़ेशन: निर्भरता से डिज़ाइन")
      .waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/",
        "/hi",
        "/examples?sample=dbms",
        "/subjects/computer-science",
        "/resources",
        "/pricing",
        "/signup?workspace=student",
        "/login",
        "/forgot-password",
      ]) {
        await page.goto("http://localhost:3157" + path);
        await page.waitForTimeout(250);
        const box = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        if (box.scroll > box.width + 2)
          console.log(
            await page.evaluate(() =>
              Array.from(document.querySelectorAll("body *"))
                .filter((e) => e.getBoundingClientRect().right > innerWidth + 2)
                .slice(0, 10)
                .map((e) => ({
                  tag: e.tagName,
                  cls: e.className,
                  text: e.textContent?.slice(0, 70),
                })),
            ),
          );
        assert(
          box.scroll <= box.width + 2,
          `Overflow ${path} at ${width}: ${box.scroll}`,
        );
        if (path === "/" && width <= 390) {
          assert(
            await page
              .locator("h1")
              .evaluate(
                (el: Element) =>
                  parseFloat(getComputedStyle(el).fontSize) >= 40,
              ),
            "Mobile hero retains its intended hierarchy",
          );
        }
      }
    }
    mkdirSync("output/growth", { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto("http://localhost:3157/");
    await page.screenshot({
      path: "output/growth/home-desktop.jpg",
      type: "jpeg",
      quality: 82,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3157/");
    await page.screenshot({
      path: "output/growth/home-mobile.jpg",
      type: "jpeg",
      quality: 82,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("http://localhost:3157/");
    assert.equal(
      await page
        .locator(".growth-hero-note")
        .evaluate((el: Element) => getComputedStyle(el).transform),
      "none",
      "Reduced motion removes pointer depth",
    );
    const walkthrough = page.getByRole("group", {
      name: "Explore the study demonstration",
    });
    await walkthrough
      .getByRole("button", { name: /Make your notebook/ })
      .click();
    await page.getByRole("heading", { name: "One fact. One place." }).waitFor();
    assert.equal(
      await walkthrough
        .getByRole("button", { name: /Make your notebook/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page
      .locator(".device-story-sticky")
      .screenshot({ path: "output/growth/device-demo-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page
      .locator(".device-story-sticky")
      .screenshot({ path: "output/growth/device-demo-desktop.png" });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const section of [
        "growth-hero",
        "learning-bento",
        "growth-preview-section",
        "growth-gallery",
        "growth-routine",
        "growth-product-section",
        "review-section",
        "growth-writer",
        "growth-trust",
        "growth-faq",
        "growth-final",
      ]) {
        await page.locator(`.${section}`).screenshot({
          path: `output/growth/editorial-${section}-${width}.png`,
        });
      }
    }
    // On phones the demonstration is manual, so page scrolling must not reset a choice.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await walkthrough.getByRole("button", { name: /Recall the idea/ }).click();
    await page.locator(".growth-gallery").scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    assert.equal(
      await walkthrough
        .getByRole("button", { name: /Recall the idea/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    const staticContext = await browser.newContext({
      javaScriptEnabled: false,
    });
    const staticPage = await staticContext.newPage();
    await staticPage.goto("http://localhost:3157/");
    assert(
      await staticPage.locator("h1").isVisible(),
      "Server-rendered landing content survives without JavaScript",
    );
    assert(await staticPage.locator(".growth-writer h2").isVisible());
    await staticContext.close();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1050 });
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      await page.goto("http://localhost:3157" + path);
      await page.locator(".auth-stage").waitFor();
      assert(
        (await page.locator(".auth-topbar").boundingBox())!.width > 1000,
        "Desktop auth header should span its layout rather than shrink around links",
      );
      await page.screenshot({
        path: `output/growth/auth-${path.slice(1)}-desktop.png`,
        fullPage: true,
      });
    }
    await page.goto("http://localhost:3157/hi");
    assert((await page.locator("h1").innerText()).includes("नोट"));
    await context.addCookies([
      {
        name,
        value,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("http://localhost:3157/dashboard");
    await page.getByText("More tools", { exact: true }).click();
    await page
      .getByRole("button", { name: "Study preferences", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Make your first lesson relevant." })
      .waitFor();
    await page.getByLabel("Level", { exact: true }).selectOption("pg");
    await page
      .getByLabel("Department", { exact: true })
      .selectOption("Data science / AI & ML");
    await page
      .getByLabel("Note language", { exact: true })
      .selectOption("hindi");
    await page.getByRole("button", { name: "Save study preferences" }).click();
    await page
      .getByRole("heading", { name: "PG · Data science / AI & ML" })
      .waitFor();
    await page.reload();
    await page.getByText("More tools", { exact: true }).click();
    await page
      .getByRole("button", { name: "Study preferences", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "PG · Data science / AI & ML" })
      .waitFor();
    await page.getByLabel("Today's study minutes (self-reported)").fill("20");
    await page.getByRole("button", { name: "Save today's total" }).click();
    await page.getByText("20 / 15 minutes", { exact: false }).waitFor();
    await page
      .getByRole("button", { name: "Transformer attention mechanisms" })
      .click();
    await page
      .getByRole("heading", { name: "Start with your source." })
      .waitFor();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        "Dashboard overflow " + width,
      );
      assert.equal(
        await page
          .locator("select")
          .first()
          .evaluate((e: any) => getComputedStyle(e).appearance),
        "none",
      );
    }
    const pdf = await context.request.get(
      "http://localhost:3157/api/resources?id=dbms",
    );
    assert.equal(pdf.status(), 200);
    assert((await pdf.body()).subarray(0, 5).toString() === "%PDF-");
    assert.equal(
      (
        await context.request.get(
          "http://localhost:3157/api/resources?id=../../env",
        )
      ).status(),
      404,
    );
    await page.goto("http://localhost:3157/profile");
    await page.locator(".profile-redesign").waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        "Profile overflow " + width,
      );
      await page.screenshot({
        path: `output/growth/profile-${width}.png`,
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS browser: guest CS preview, Hindi/result labels, signup topic continuity, UG/PG saved preferences, self-reported goal, responsive public/dashboard routes (320/390/768/1440), reduced motion, arrow-free selects and real PDF download.",
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
