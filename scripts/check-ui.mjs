import assert from 'node:assert/strict';
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("output/qa", { recursive: true });
for (const route of [
  "/",
  "/dashboard",
  "/how-it-works",
  "/subjects",
  "/interview",
  "/docs",
  "/privacy",
  "/about",
  "/pricing",
  "/login",
  "/refer",
]) {
  const r = await page.goto("http://localhost:3101" + route);
  await page.waitForTimeout(600);
  assert.equal(r.status(),200,route);
  console.log(route, r.status(), await page.locator("h1").first().innerText());
  if (route === "/about") {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForTimeout(100);
    await page.screenshot({
      path: "output/qa/about-desktop.png",
      fullPage: true,
    });
  }
  if (route === "/dashboard")
    await page.screenshot({
      path: "output/qa/dashboard-desktop.png",
      fullPage: true,
    });
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:3101/dashboard");
await page.waitForTimeout(500);
await page.screenshot({
  path: "output/qa/dashboard-mobile.png",
  fullPage: true,
});
console.log(
  "mobile overflow",
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
for(const route of ['/about','/pricing','/subjects','/interview','/how-it-works','/docs','/login']){await page.goto('http://localhost:3101'+route);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' mobile overflow');}
assert.deepEqual(errors,[]);
console.log('PASS: public pages and mobile widths, no browser errors.');
await browser.close();
