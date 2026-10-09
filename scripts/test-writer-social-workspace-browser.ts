import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
async function main() {
  const origin = "http://localhost:3162";
  Object.assign(process.env, {
    DATA_DIR: mkdtempSync(join(tmpdir(), "writer-social-ui-")),
    DATA_BACKEND: "sqlite",
    MONGODB_URI: "",
    APP_ROLE: "all",
    BACKEND_URL: "",
    APP_ORIGIN: origin,
    NEXT_PUBLIC_APP_URL: origin,
    NEXT_DIST_DIR: ".next-validation",
    WORKER_MODE: "external",
  });
  const auth = await import("../lib/auth/server"),
    profiles = await import("../lib/writing/profile"),
    stories = await import("../lib/writing/stories"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { setWorkspace } = await import("../lib/workspace-preference"),
    social = await import("../lib/writing/social");
  const author = await auth.register(
      "Aarav Research",
      "social-author-ui@example.test",
      "fixture-password-safe",
    ),
    reader = await auth.register(
      "Mira Reader",
      "social-reader-ui@example.test",
      "fixture-password-safe",
    );
  for (const u of [author, reader]) {
    await markEmailVerified(u.id);
    await profiles.enrollWriter(u);
    await setWorkspace(u.id, "writer");
  }
  const p = (await profiles.writerProfile(author.id))!,
    rp = (await profiles.writerProfile(reader.id))!;
  await social.followWriter(reader.id, p.slug, true);
  await social.followWriter(author.id, rp.slug, true);
  const draft = await stories.saveStory(author.id, {
    title: "A clearer path through university research",
    summary:
      "Use evidence, work through examples, and make your reasoning visible.",
    body: "University research starts with a useful question. Compare sources, examine the evidence, and make the reasoning explicit. A worked example helps other students evaluate the method. ".repeat(
      8,
    ),
    tags: ["research"],
    authorName: p.name,
    creatorSlug: p.slug,
    submit: true,
  });
  const published = await stories.reviewStory(
    draft.id,
    "publish",
    "Fixture reviewed",
    author.id,
  );
  const cookieFor = async (u: typeof author) => {
    const [name, value] = (
      await auth.startSession(u, new Request(origin))
    ).headers
      .get("set-cookie")!
      .split(";")[0]
      .split("=");
    return { name, value, domain: "localhost", path: "/" };
  };
  const authorCookie = await cookieFor(author),
    readerCookie = await cookieFor(reader);
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3162"],
    {
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin + "/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(ready);
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    await context.addCookies([authorCookie]);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(20000);
    const publicSession = await browser.newContext();
    const privateResult = await publicSession.request.get(
      `${origin}/api/creators/${p.slug}/connections`,
    );
    assert.equal(privateResult.status(), 403);
    await page.goto(origin + "/writer/profile");
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    const modal = page.getByRole("dialog", { name: "Profile information" });
    await modal
      .getByRole("checkbox", {
        name: "Show my writer connections",
        exact: false,
      })
      .check();
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await modal.waitFor({ state: "hidden" });
    assert.equal(
      (
        await publicSession.request.get(
          `${origin}/api/creators/${p.slug}/connections`,
        )
      ).status(),
      200,
    );
    await context.addCookies([readerCookie]);
    await page.goto(origin + "/writer/following");
    await page.getByRole("heading", { name: p.name, exact: true }).waitFor();
    await page.getByRole("button", { name: "Following", exact: true }).click();
    await page
      .getByRole("heading", { name: "No public writers in this view yet." })
      .waitFor();
    await page.goto(`${origin}/creators/${p.slug}`);
    await page
      .getByRole("button", { name: "Follow writer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Following", exact: true })
      .waitFor();
    await page.getByRole("tab", { name: "Connections", exact: true }).click();
    await page.getByRole("heading", { name: rp.name, exact: true }).waitFor();
    let failResponses = true;
    await page.route(
      `**/api/publications/${published.slug}/responses`,
      (route) => {
        if (route.request().method() === "GET" && failResponses) {
          failResponses = false;
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Responses are temporarily unavailable.",
            }),
          });
        }
        return route.continue();
      },
    );
    await page.goto(`${origin}/guides/${published.slug}`);
    await page
      .getByRole("alert")
      .filter({ hasText: "Responses are temporarily unavailable." })
      .waitFor();
    assert.equal(
      await page
        .getByText("No responses yet. Share a thoughtful perspective.", {
          exact: true,
        })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "Retry responses", exact: true })
      .click();
    await page
      .getByText("No responses yet. Share a thoughtful perspective.", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "♡ Like", exact: true }).click();
    await page.getByRole("button", { name: "♥ Liked", exact: true }).waitFor();
    await page.getByRole("button", { name: "Save story", exact: true }).click();
    await page.getByRole("button", { name: "Saved", exact: true }).waitFor();
    await page
      .getByLabel("Your response", { exact: true })
      .fill("This example makes the research method much easier to follow.");
    await page
      .getByRole("button", { name: "Post publicly", exact: true })
      .click();
    await page
      .getByText("This example makes the research method", { exact: false })
      .waitFor();
    await page
      .locator(".story-activity-counts")
      .getByText("1 comments", { exact: true })
      .waitFor();
    await page.reload();
    await page.getByRole("button", { name: "♥ Liked", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Saved", exact: true }).count(),
      1,
    );
    await page
      .getByRole("button", { name: "Remove response", exact: true })
      .click();
    await page
      .locator(".story-activity-counts")
      .getByText("0 comments", { exact: true })
      .waitFor();
    await page.goto(origin + "/writer");
    await page
      .getByRole("heading", { name: published.title, exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("link", { name: "1 likes", exact: true }).count(),
      1,
    );
    await context.addCookies([authorCookie]);
    await page.goto(origin + "/writer/stats");
    await page
      .getByRole("heading", { name: "Your impact", exact: true })
      .waitFor();
    assert.match(
      await page.locator(".writer-metrics").innerText(),
      /Followers/,
    );
    assert.match(
      await page.locator(".writer-stats-table").innerText(),
      /Likes/,
    );
    mkdirSync("output/writer-social", { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/writer/following",
        "/writer/stats",
        `/creators/${p.slug}`,
        `/guides/${published.slug}`,
      ]) {
        await page.goto(origin + path);
        await page.waitForLoadState("networkidle");
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `No overflow at ${width}: ${path}`,
        );
        if (width === 1440 && path.startsWith("/writer/"))
          await page.screenshot({
            path: `output/writer-social/${path.split("/").at(-1)}-desktop.png`,
            fullPage: true,
          });
      }
      await page.screenshot({
        path: `output/writer-social/article-${width}.png`,
        fullPage: true,
      });
    }
    const menu = page
      .locator("#story-activity")
      .getByLabel("More story options");
    await menu.click();
    await page
      .getByRole("button", { name: "Edit private revision", exact: true })
      .click();
    await page.waitForURL("**/write?draft=*");
    await page.getByRole("textbox", { name: "Story editor" }).waitFor();
    assert.notEqual(
      new URL(page.url()).searchParams.get("draft"),
      published.id,
    );
    assert.equal(
      (
        await (
          await publicSession.request.get(
            `${origin}/api/publications?slug=${published.slug}`,
          )
        ).json()
      ).stories[0].body,
      published.body,
    );
    // A held response from the author's session cannot restore owner controls in a new reader session.
    await page.goto(`${origin}/guides/${published.slug}`);
    await page.locator(".story-activity-counts").waitFor();
    let release!: () => void, entered!: () => void, delivered!: () => void;
    const held = new Promise<void>((r) => (release = r)),
      started = new Promise<void>((r) => (entered = r)),
      finished = new Promise<void>((r) => (delivered = r));
    let intercept = true;
    await page.route(
      `**/api/publications/${published.slug}/engagement`,
      async (route) => {
        if (route.request().method() !== "GET" || !intercept)
          return route.continue();
        intercept = false;
        const real = await route.fetch();
        entered();
        await held;
        try {
          await route.fulfill({ response: real });
        } catch {
          // The identity change may abort the old request before delivery.
        } finally {
          delivered();
        }
      },
    );
    await page.evaluate(
      (slug) =>
        window.dispatchEvent(
          new CustomEvent("syaahi-story-activity", { detail: slug }),
        ),
      published.slug!,
    );
    await started;
    await context.addCookies([readerCookie]);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("syaahi:account-updated")),
    );
    await page.getByRole("button", { name: "♥ Liked", exact: true }).waitFor();
    release();
    await finished;
    await page.waitForLoadState("networkidle");
    await page.getByLabel("More story options", { exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Edit private revision", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Remove response", exact: true })
        .count(),
      0,
    );
    await publicSession.close();
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS writer social workspace browser: profile connection opt-in, follow/unfollow, public writer lists, like/save/comment persistence, real feed counters, stats, author-only revision menu, stale account response isolation and 390/768/1440 layouts.",
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
