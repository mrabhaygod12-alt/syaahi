import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { load } from "cheerio";
async function main() {
  const base = "http://localhost:3156",
    env = {
      ...process.env,
      APP_ROLE: "all",
      BACKEND_URL: "",
      MONGODB_URI: "",
      DATA_BACKEND: "sqlite",
      DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-public-discovery-")),
      WORKER_MODE: "external",
      NEXT_DIST_DIR: ".next-validation",
      NEXT_PUBLIC_APP_URL: base,
    };
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3156"],
    { env, windowsHide: true, stdio: "ignore" },
  );
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base + "/syaahi")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert(ready);
    const paths = [
      "/syaahi",
      "/writing/features",
      "/writing/pricing",
      "/writing/medium-comparison",
      "/ai-presentations",
    ];
    for (const path of paths) {
      const res = await fetch(base + path),
        html = await res.text(),
        $ = load(html);
      assert.equal(res.status, 200);
      assert.equal($("h1").length, 1);
      assert.equal(
        $("link[rel=canonical]").attr("href"),
        "https://www.syaahii.in" + path,
      );
      assert(!$("meta[name=robots]").attr("content")?.includes("noindex"));
      assert(
        $(".product-public-content").text().length > 600,
        "Core product facts must be server-rendered",
      );
      for (const script of $("script[type='application/ld+json']").toArray())
        assert(JSON.parse($(script).text()));
    }
    const writer = load(await (await fetch(base + "/writing/pricing")).text());
    assert.equal(writer(".writer-public-plans article").length, 2);
    const facts = await (await fetch(base + "/product-facts.json")).json();
    assert.deepEqual(
      facts.pricing.student.map((p: any) => p.inr),
      [399],
    );
    assert.equal(facts.pricing.writer.length, 2);
    assert.deepEqual(
      facts.pricing.studentOneTime.map((p: any) => p.inr),
      [9, 39, 79],
    );
    const retiredStudent = await fetch(base + "/subscribe/pro", {
      redirect: "manual",
    });
    assert.equal(retiredStudent.status, 307);
    assert.equal(
      new URL(retiredStudent.headers.get("location")!, base).pathname,
      "/pricing",
    );
    const retiredWriter = await fetch(base + "/writer/subscribe/starter", {
      redirect: "manual",
    });
    assert.equal(retiredWriter.status, 307);
    assert.equal(
      new URL(retiredWriter.headers.get("location")!, base).pathname,
      "/writer/membership",
    );
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    mkdirSync("output/live-audit/public-discovery", { recursive: true });
    for (const path of paths) {
      await page.goto(base + path);
      await page.locator("h1").waitFor();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          `${path} overflows at ${width}px`,
        );
      }
      await page.screenshot({
        path: `output/live-audit/public-discovery/${path.replaceAll("/", "-")}.png`,
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const simple = await nojs.newPage();
    await simple.goto(base + "/writing/features");
    assert(
      await simple
        .getByRole("heading", {
          name: "Build a distinct writer profile",
          exact: true,
        })
        .isVisible(),
    );
    await nojs.close();
    console.log(
      "PASS public discovery: server-rendered product areas, canonical/indexable pages, valid JSON-LD, two writer offers and three one-time/one monthly student offers, retired-checkout rejection, content without JavaScript and 320/390/768/1440px overflow checks.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
