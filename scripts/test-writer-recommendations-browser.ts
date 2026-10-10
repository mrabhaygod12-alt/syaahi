import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { load } from "cheerio";
async function main() {
  const base = "http://localhost:3159";
  Object.assign(process.env, {
    APP_ROLE: "all",
    BACKEND_URL: "",
    MONGODB_URI: "",
    DATA_BACKEND: "sqlite",
    DATA_DIR: mkdtempSync(join(tmpdir(), "writer-recommendations-ui-")),
    WORKER_MODE: "external",
    NEXT_DIST_DIR: ".next-validation",
    NEXT_PUBLIC_APP_URL: base,
  });
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    profiles = await import("../lib/writing/profile"),
    stories = await import("../lib/writing/stories"),
    { setWorkspace } = await import("../lib/workspace-preference"),
    { followWriter } = await import("../lib/writing/social");
  const reader = await auth.register(
      "University Reader",
      "recommendation-ui@example.test",
      "fixture-password-safe",
    ),
    author = await auth.register(
      "Database Writer",
      "author-recommendation-ui@example.test",
      "fixture-password-safe",
    ),
    other = await auth.register(
      "Research Writer",
      "other-recommendation-ui@example.test",
      "fixture-password-safe",
    );
  for (const u of [reader, author, other]) {
    await markEmailVerified(u.id);
    await profiles.enrollWriter(u);
  }
  await setWorkspace(reader.id, "writer");
  let slug = "";
  for (const u of [author, other]) {
    const p = (await profiles.writerProfile(u.id))!;
    for (let i = 0; i < 3; i++) {
      const s = await stories.saveStory(u.id, {
        title: `${u === author ? "Database" : "Research"} university perspective ${i}`,
        summary: "A source-aware perspective for university readers.",
        body: "This article explains a university course concept through a worked example. Read the original reference and verify the reasoning before using it for your own course revision.",
        tags: [u === author ? "databases" : "research"],
        authorName: u.name,
        creatorSlug: p.slug,
        submit: true,
      });
      const published = await stories.reviewStory(
        s.id,
        "publish",
        "Reviewed fixture",
        reader.id,
      );
      if (!slug) slug = published.slug!;
    }
  }
  await followWriter(
    reader.id,
    (await profiles.writerProfile(author.id))!.slug,
    true,
  );
  const cookie = (await auth.startSession(reader, new Request(base))).headers
    .get("set-cookie")!
    .split(";")[0];
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3159"],
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
        if ((await fetch(base + "/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(ready);
    browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const [name, value] = cookie.split("=");
    await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    await ctx.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    const page = await ctx.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    mkdirSync("output/writer-recommendations", { recursive: true });
    await page.goto(base + "/writer/settings#reading-preferences");
    const preferences = page.locator("#reading-preferences"),
      history = preferences.getByRole("checkbox");
    await history.waitFor();
    assert.equal(await history.isChecked(), false);
    await preferences
      .getByRole("button", { name: "databases", exact: true })
      .click();
    await preferences.getByLabel(/^Topics to show less/).fill("research");
    await history.check();
    await preferences
      .getByRole("button", { name: "Save reading preferences", exact: true })
      .click();
    await preferences.getByRole("status").waitFor();
    await page.reload();
    await history.waitFor();
    assert(await history.isChecked());
    assert.equal(
      await preferences.getByLabel(/^Topics to show less/).inputValue(),
      "research",
    );
    const authorSlug = (await profiles.writerProfile(author.id))!.slug;
    const writerInput = preferences.getByLabel("Writer profile URL or handle", {
      exact: true,
    });
    await writerInput.fill(`https://outside.example/creators/${authorSlug}`);
    await preferences
      .getByRole("button", { name: "Add writer", exact: true })
      .click();
    await preferences
      .getByRole("alert")
      .filter({ hasText: "Use a Syaahi writer profile URL" })
      .waitFor();
    await writerInput.fill(`${base}/creators/${authorSlug}`);
    await preferences
      .getByRole("button", { name: "Add writer", exact: true })
      .click();
    await preferences
      .getByRole("button", { name: `Unmute ${authorSlug}`, exact: true })
      .waitFor();
    await preferences
      .getByRole("button", { name: "Save reading preferences", exact: true })
      .click();
    await preferences
      .getByRole("status")
      .filter({ hasText: "Reading preferences saved." })
      .waitFor();
    await page.reload();
    await preferences
      .getByRole("button", { name: `Unmute ${authorSlug}`, exact: true })
      .waitFor();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await preferences.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.screenshot({
        path: `output/writer-recommendations/preferences-${width}.png`,
      });
    }
    await page.goto(base + "/writer");
    await page
      .getByRole("heading", {
        name: "Your feed has room for new voices.",
        exact: true,
      })
      .waitFor();
    assert.equal(await page.locator(".writer-story-row").count(), 0);
    const hidden = await (
      await ctx.request.get(base + "/api/writer/preferences")
    ).json();
    assert.deepEqual(hidden.preferences.mutedCreators, [authorSlug]);
    await page.goto(base + "/writer/settings#reading-preferences");
    await preferences
      .getByRole("button", { name: `Unmute ${authorSlug}`, exact: true })
      .click();
    await preferences
      .getByRole("button", { name: "Save reading preferences", exact: true })
      .click();
    await preferences
      .getByRole("status")
      .filter({ hasText: "Reading preferences saved." })
      .waitFor();
    await page.goto(base + "/writer");
    await page.getByRole("tab", { name: "For you", exact: true }).waitFor();
    await page.locator(".writer-story-row").first().waitFor();
    assert.equal(
      await page
        .locator(".writer-story-row")
        .filter({ hasText: "Research university" })
        .count(),
      0,
    );
    assert(
      (
        await page.locator(".writer-recommendation-reason").first().innerText()
      ).includes("databases"),
    );
    await page.getByRole("tab", { name: "Following", exact: true }).click();
    await page.locator(".writer-story-row").first().waitFor();
    assert.equal(await page.locator(".writer-story-row").count(), 3);
    // A delayed earlier mode must never replace the user's current choice.
    await page.route("**/api/writer/feed?mode=latest", async (route) => {
      const response = await route.fetch();
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({ response });
    });
    await page.getByRole("tab", { name: "Latest", exact: true }).click();
    await page.getByRole("tab", { name: "For you", exact: true }).click();
    await page
      .locator(".writer-recommendation-reason")
      .first()
      .filter({ hasText: "Your topic" })
      .waitFor();
    await page.waitForTimeout(650);
    assert(
      (
        await page.locator(".writer-recommendation-reason").first().innerText()
      ).includes("Your topic"),
    );
    await page.screenshot({
      path: "output/writer-recommendations/feed-desktop.png",
      fullPage: true,
    });
    const html = await (await fetch(base + "/guides/" + slug)).text(),
      $ = load(html);
    assert($(".related-public-reading a").length > 0);
    assert(
      !$(".related-public-reading a")
        .toArray()
        .some((e) => $(e).attr("href") === "/guides/" + slug),
    );
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(base + "/guides/" + slug);
    await page
      .getByRole("heading", { name: "A few more perspectives" })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS writer recommendations browser: private preference save/reload, opt-in history, topic/author mute and unmute persistence, profile URL validation, For you/Latest/Following, stale-mode isolation, related SSR links and 390/768/1440 layouts.",
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
