import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium, webkit, devices } from "playwright";

async function main() {
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3138"],
    { windowsHide: true, stdio: "ignore" },
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
          await page.route("**/api/**", (r) =>
            r.fulfill({ json: { user: null } }),
          );
          await page.goto("http://localhost:3138/login");
          const nav = page.locator("#site-navigation");
          await page.getByRole("button", { name: "Open navigation" }).click();
          await page
            .getByRole("button", { name: "Study", exact: true })
            .click();
          assert(
            await nav.getByText("Course packs", { exact: true }).isVisible(),
          );
          assert.equal(await page.locator(".nav-popover:visible").count(), 1);
          await page
            .getByRole("button", { name: "Community", exact: true })
            .click();
          assert.equal(await page.locator(".nav-popover:visible").count(), 1);
          await nav
            .getByRole("link", { name: "About", exact: true })
            .scrollIntoViewIfNeeded();
          const box = await nav
            .getByRole("link", { name: "About", exact: true })
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
          await context.close();
        }
      } finally {
        await browser.close();
      }
    }
    console.log(
      "PASS: Chromium + WebKit, iPhone portrait/landscape and 320px; disclosure, scrolling, dismissal and overflow.",
    );
  } finally {
    server.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
