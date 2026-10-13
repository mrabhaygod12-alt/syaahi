import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { load } from "cheerio";
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
    NEXT_DIST_DIR: process.argv.includes("--dev")
      ? ".next-hydration-debug"
      : ".next-validation",
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
  // Exercise a server-rendered count whose punctuation differs by locale.
  await stories.commitStoryChanges([
    {
      before: published,
      after: {
        ...published,
        analytics: { views: 12345, lastViewedAt: null },
      },
    },
  ]);
  const secondDraft = await stories.saveStory(author.id, {
    title: "Read the evidence before choosing a research method",
    summary:
      "A practical guide to comparing references before drawing conclusions.",
    body: draft.body,
    tags: ["research"],
    authorName: p.name,
    creatorSlug: p.slug,
    submit: true,
  });
  const secondPublished = await stories.reviewStory(
    secondDraft.id,
    "publish",
    "Synthetic reviewed story",
    author.id,
  );
  const legacy = await auth.register(
    "Chandan Legacy Fixture",
    "social-legacy-ui@example.test",
    "fixture-password-safe",
  );
  const legacyPublished = await stories.reviewStory(
    (
      await stories.saveStory(legacy.id, {
        title: "Quantum computing without the clutter",
        summary:
          "Understand qubits, compare the evidence and keep the source in view.",
        body: "# What a qubit changes\n\nA **careful reader** checks [the original source](https://example.test/source) before repeating a claim.\n\n## Three useful ideas\n- Superposition describes a state\n- Measurement produces an outcome\n- Entanglement connects joint states\n\n## A practical sequence\n1. Read the source\n2. Compare the explanation\n3. Test your understanding\n\n> Learn the limits as well as the possibilities.\n\n```\nconst evidence = '<script>not executable</script>';\n```",
        tags: ["computer science", "research"],
        authorName: legacy.name,
        submit: true,
      })
    ).id,
    "publish",
    "Reviewed synthetic legacy publication",
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
    readerCookie = await cookieFor(reader),
    legacyCookie = await cookieFor(legacy);
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      process.argv.includes("--dev") ? "dev" : "start",
      "--port",
      "3162",
    ],
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
      locale: "de-DE",
      timezoneId: "Pacific/Kiritimati",
    });
    await context.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    await context.addCookies([authorCookie]);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => {
      errors.push(`${page.url()}: ${e.message}`);
      if (process.argv.includes("--dev")) console.error(e.message);
    });
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
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await modal
      .getByLabel("Short bio", { exact: false })
      .fill("My unsaved profile edit");
    const profileSnapshot = (
      await (await context.request.get(`${origin}/api/writer/profile`)).json()
    ).profile;
    assert.equal(
      (
        await context.request.patch(`${origin}/api/writer/profile`, {
          headers: { origin },
          data: {
            bio: "Saved in another tab",
            expectedUpdatedAt: profileSnapshot.updatedAt,
          },
        })
      ).status(),
      200,
    );
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await modal
      .getByRole("alert")
      .filter({ hasText: "changed in another tab" })
      .waitFor();
    assert.equal(
      await modal.getByLabel("Short bio", { exact: false }).inputValue(),
      "My unsaved profile edit",
    );
    assert.equal(
      await modal
        .getByRole("button", { name: "Save", exact: true })
        .isDisabled(),
      true,
    );
    page.once("dialog", (dialog) => void dialog.accept());
    await modal
      .getByRole("button", { name: "Reload saved profile", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        (
          document.querySelector(
            '.writer-profile-form textarea[maxlength="160"]',
          ) as HTMLTextAreaElement
        )?.value === "Saved in another tab",
    );
    await modal
      .getByLabel("Short bio", { exact: false })
      .fill("Research notes and practical examples for university students.");
    let failProfileSave = true;
    const safeReference = "6eef2c93-dfaf-452c-95cd-7ef80ecfbf2c";
    await page.route("**/api/writer/profile", async (route) => {
      if (route.request().method() === "PATCH" && failProfileSave) {
        failProfileSave = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "The service could not save your profile. Please retry.",
            requestId: safeReference,
          }),
        });
      } else await route.continue();
    });
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await modal.getByRole("alert").filter({ hasText: safeReference }).waitFor();
    mkdirSync("output/writer-social", { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await modal.evaluate((node) => node.scrollWidth > node.clientWidth + 1),
        false,
        `Profile recovery dialog fits ${width}px`,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.screenshot({
        path: `output/writer-social/profile-save-recovery-${width}.png`,
        fullPage: true,
      });
    }
    assert.equal(
      await modal.getByLabel("Short bio", { exact: false }).inputValue(),
      "Research notes and practical examples for university students.",
    );
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await modal.waitFor({ state: "hidden" });
    await page.unroute("**/api/writer/profile");
    const savedBio = (
      await (await context.request.get(`${origin}/api/writer/profile`)).json()
    ).profile;
    assert.equal(
      savedBio.bio,
      "Research notes and practical examples for university students.",
    );
    assert.equal(savedBio.showConnections, true);
    const featured = page.locator("#featured-stories");
    await featured
      .getByLabel("Published story to pin")
      .selectOption(published.id);
    await featured
      .getByRole("button", { name: "Pin story", exact: true })
      .click();
    await featured
      .getByRole("button", { name: `Unpin ${published.title}`, exact: true })
      .waitFor();
    await featured
      .getByLabel("Published story to pin")
      .selectOption(secondPublished.id);
    await featured
      .getByRole("button", { name: "Pin story", exact: true })
      .click();
    await featured
      .getByRole("button", {
        name: `Unpin ${secondPublished.title}`,
        exact: true,
      })
      .waitFor();
    await featured
      .getByRole("button", {
        name: `Move ${secondPublished.title} earlier`,
        exact: true,
      })
      .click();
    await page.waitForFunction(
      (title) =>
        document
          .querySelector("#featured-stories li:first-child")
          ?.textContent?.includes(title),
      secondPublished.title,
    );
    await page.reload();
    await featured
      .getByRole("button", {
        name: `Unpin ${secondPublished.title}`,
        exact: true,
      })
      .waitFor();
    assert.match(
      await featured.locator("li").first().innerText(),
      /Read the evidence/,
    );
    const publicPins = (
      await (
        await publicSession.request.get(
          `${origin}/api/publications?creator=${p.slug}`,
        )
      ).json()
    ).stories;
    assert.deepEqual(
      publicPins.slice(0, 2).map((s: { slug: string }) => s.slug),
      [secondPublished.slug, published.slug],
    );
    assert(publicPins.slice(0, 2).every((s: { pinned?: boolean }) => s.pinned));
    const html = await (
      await publicSession.request.get(`${origin}/creators/${p.slug}`)
    ).text();
    const $ = load(html);
    assert.equal(
      $(".writer-story-row h2").first().text(),
      secondPublished.title,
    );
    assert.equal(
      $(".writer-pinned-label").length,
      2,
      "Profile pins are visible in server-rendered HTML",
    );
    assert.equal(
      $(".writer-story-row h2")
        .map((_, n) => $(n).text())
        .get()
        .filter((title) => title === published.title).length,
      1,
      "Pins do not duplicate articles",
    );
    // A real competing tab updates the saved revision. The stale UI must reload,
    // rather than replaying the author's write against a newer list.
    const pinSnapshot = await (
      await context.request.get(`${origin}/api/writer/pins`)
    ).json();
    const competing = await context.request.patch(`${origin}/api/writer/pins`, {
      headers: { origin },
      data: {
        storyId: published.id,
        action: "move_up",
        expectedUpdatedAt: pinSnapshot.updatedAt,
      },
    });
    assert.equal(competing.status(), 200);
    await featured
      .getByRole("button", {
        name: `Unpin ${secondPublished.title}`,
        exact: true,
      })
      .click();
    await featured
      .getByRole("alert")
      .filter({ hasText: "changed in another tab" })
      .waitFor();
    await featured
      .getByRole("button", { name: "Reload profile pins", exact: true })
      .click();
    await page.waitForFunction(
      (title) =>
        document
          .querySelector("#featured-stories li:first-child")
          ?.textContent?.includes(title),
      published.title,
    );
    await page.waitForFunction(
      (title) =>
        document.querySelector(".writer-story-row h2")?.textContent === title,
      published.title,
    );
    mkdirSync("output/writer-social", { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `Profile pins fit ${width}px`,
      );
      await page.screenshot({
        path: `output/writer-social/profile-pins-${width}.png`,
        fullPage: true,
      });
    }
    const appearance = async (value: "dark" | "light") => {
      const current = (
        await (await context.request.get(`${origin}/api/writer/profile`)).json()
      ).profile;
      const changed = await context.request.patch(
        `${origin}/api/writer/profile`,
        {
          headers: { origin },
          data: { appearance: value, expectedUpdatedAt: current.updatedAt },
        },
      );
      assert.equal(changed.status(), 200);
      await page.reload();
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.writerTheme === theme,
        value,
      );
      await featured
        .getByRole("button", { name: `Unpin ${published.title}`, exact: true })
        .waitFor();
    };
    await appearance("dark");
    await page.setViewportSize({ width: 390, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await page.screenshot({
      path: "output/writer-social/profile-pins-dark-390.png",
      fullPage: true,
    });
    await appearance("light");
    await featured
      .getByRole("button", {
        name: `Unpin ${secondPublished.title}`,
        exact: true,
      })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("#featured-stories li").length === 1,
    );
    await page.goto(origin + "/writer/settings");
    const appearanceSelect = page.getByLabel("Writer appearance", {
      exact: true,
    });
    await appearanceSelect.waitFor();
    const settingsSnapshot = (
      await (await context.request.get(`${origin}/api/writer/profile`)).json()
    ).profile;
    assert.equal(
      (
        await context.request.patch(`${origin}/api/writer/profile`, {
          headers: { origin },
          data: {
            bio: "A newer profile detail must survive a theme change.",
            expectedUpdatedAt: settingsSnapshot.updatedAt,
          },
        })
      ).status(),
      200,
    );
    await appearanceSelect.selectOption("dark");
    await page
      .locator(".writer-profile-conflict")
      .getByRole("alert")
      .filter({ hasText: "changed in another tab" })
      .waitFor();
    assert.equal(await appearanceSelect.isDisabled(), true);
    await page
      .getByRole("button", { name: "Reload saved profile", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !(
          document.querySelector(
            '[aria-label="Writer appearance"]',
          ) as HTMLSelectElement
        )?.disabled,
    );
    await appearanceSelect.selectOption("dark");
    await page.waitForFunction(
      () => document.documentElement.dataset.writerTheme === "dark",
    );
    const themedProfile = (
      await (await context.request.get(`${origin}/api/writer/profile`)).json()
    ).profile;
    assert.equal(
      themedProfile.bio,
      "A newer profile detail must survive a theme change.",
    );
    await appearanceSelect.selectOption("light");
    await page.waitForFunction(
      () => document.documentElement.dataset.writerTheme === "light",
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
      .getByRole("button", { name: "Pin to profile", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "already pinned" })
      .waitFor();
    assert.equal(
      (await (await context.request.get(`${origin}/api/writer/pins`)).json())
        .pinned.length,
      1,
    );
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
        .getByRole("button", { name: "Pin to profile", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Remove response", exact: true })
        .count(),
      0,
    );
    // Reject a profile response bound to a different signed-in account, even if
    // the transport incorrectly supplies HTTP 200 (for example a stale cache).
    await page.route("**/api/writer/profile", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: await profiles.writerProfile(author.id),
        }),
      });
    });
    await page.goto(origin + "/writer/profile");
    await page
      .getByRole("alert")
      .filter({ hasText: "profile could not be verified" })
      .waitFor();
    assert.equal(await page.locator(".writer-profile-cover").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Edit profile", exact: true })
        .count(),
      0,
    );
    assert.equal(await page.locator("#featured-stories").count(), 0);
    await page.unroute("**/api/writer/profile");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page
      .getByRole("heading", { name: rp.name, exact: true, level: 1 })
      .waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: p.name, exact: true, level: 1 })
        .count(),
      0,
    );
    let failLegacyGet = true;
    const legacyFollowPath = `**/api/creators/${legacyPublished.creatorSlug}/follow`;
    await page.route(legacyFollowPath, async (route) => {
      if (route.request().method() === "GET" && failLegacyGet) {
        failLegacyGet = false;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Follower information is temporarily unavailable.",
            requestId: safeReference,
          }),
        });
      }
      return route.continue();
    });
    await page.goto(`${origin}/guides/${legacyPublished.slug}`);
    const followControl = page.locator(".public-article .writer-follow");
    await followControl
      .getByRole("alert")
      .filter({ hasText: safeReference })
      .waitFor();
    await followControl
      .getByRole("button", { name: "Retry followers", exact: true })
      .click();
    await followControl
      .getByRole("button", { name: "Follow writer", exact: true })
      .click();
    await followControl
      .getByRole("button", { name: "Following", exact: true })
      .waitFor();
    await page.reload();
    await followControl
      .getByRole("button", { name: "Following", exact: true })
      .waitFor();
    await page
      .locator(".reader-story-content")
      .getByRole("heading", {
        name: "Three useful ideas",
        exact: true,
        level: 2,
      })
      .waitFor();
    assert.equal(await page.locator(".reader-story-content ul li").count(), 3);
    assert.equal(await page.locator(".reader-story-content ol li").count(), 3);
    assert.equal(await page.locator(".reader-story-content script").count(), 0);
    const selectVisiblePassage = () => {
      const node = document.querySelector(".reader-story-content p")!;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    };
    await page
      .getByLabel("Note for selected passage", { exact: true })
      .fill("A private source-check reminder");
    await page.evaluate(selectVisiblePassage);
    // Keep selection inside the article while activating the notes button.
    await page
      .getByRole("button", { name: "Save selected passage", exact: true })
      .evaluate((node: HTMLButtonElement) => node.click());
    await page
      .getByRole("status")
      .filter({ hasText: "Saved privately" })
      .waitFor();
    await page
      .locator(".story-private-notes blockquote")
      .filter({ hasText: "careful reader checks the original source" })
      .waitFor();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `Legacy reader fits ${width}px`,
      );
      assert.equal(await page.locator("main h1").count(), 1);
      await page.evaluate(() => {
        window.getSelection()?.removeAllRanges();
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `output/writer-social/legacy-article-${width}.png`,
        fullPage: true,
      });
    }
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "dark"),
    );
    const highlightColors = await page
      .locator(".story-private-notes blockquote")
      .first()
      .evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        text: getComputedStyle(el.querySelector("p") || el).color,
      }));
    assert.equal(highlightColors.background, "rgb(29, 44, 36)");
    assert.equal(highlightColors.text, "rgb(179, 195, 181)");
    await page.screenshot({
      path: "output/writer-social/legacy-article-dark.png",
      fullPage: true,
    });
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "light"),
    );
    await page.goto(origin + "/writer/following");
    await page
      .getByRole("heading", { name: legacy.name, exact: true })
      .waitFor();
    await page.goto(`${origin}/guides/${legacyPublished.slug}`);
    await followControl
      .getByRole("button", { name: "Following", exact: true })
      .waitFor();
    await page.unroute(legacyFollowPath);
    // A delayed reader response cannot re-enable follow on the author’s own
    // profile after an account refresh in the same rendered page.
    let deliverFollow!: () => void, followEntered!: () => void;
    const delayedFollow = new Promise<void>(
        (resolve) => (deliverFollow = resolve),
      ),
      followStarted = new Promise<void>((resolve) => (followEntered = resolve));
    let holdFollow = true;
    await page.route(legacyFollowPath, async (route) => {
      if (route.request().method() !== "GET" || !holdFollow)
        return route.continue();
      holdFollow = false;
      const real = await route.fetch();
      followEntered();
      await delayedFollow;
      try {
        await route.fulfill({ response: real });
      } catch {
        /* identity refresh may abort */
      }
    });
    await page.evaluate(() =>
      window.dispatchEvent(new Event("syaahi:account-updated")),
    );
    await followStarted;
    await context.addCookies([legacyCookie]);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("syaahi:account-updated")),
    );
    await followControl.getByText("1 followers", { exact: false }).waitFor();
    deliverFollow();
    await page.waitForLoadState("networkidle");
    assert.equal(
      await followControl
        .getByRole("button", { name: /Follow writer|Following/ })
        .count(),
      0,
      "The author cannot follow their own legacy profile",
    );
    await page.unroute(legacyFollowPath);
    await context.addCookies([readerCookie]);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("syaahi:account-updated")),
    );
    await followControl
      .getByRole("button", { name: "Following", exact: true })
      .click();
    await followControl
      .getByRole("button", { name: "Follow writer", exact: true })
      .waitFor();
    assert.equal(
      await profiles.writerProfile(legacy.id),
      null,
      "Following a legacy author never grants enrollment",
    );
    await publicSession.close();
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    for (let i = 0; i < 4; i++) {
      await page.goto(`${origin}/creators/${p.slug}`);
      await page.waitForLoadState("networkidle");
      await page.goto(`${origin}/guides/${published.slug}`);
      await page.waitForLoadState("networkidle");
    }
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS writer social workspace browser: legacy reviewed author follows/retry/reference without enrollment; own-profile and delayed account-switch isolation; semantic Markdown and selected-source private highlights; public reader 390/768/1440 and dark appearance; profile/pin conflicts, real engagement, lists, stats and author-only controls.",
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
