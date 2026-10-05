import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-engine-ui-"));
Object.assign(process.env, {
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  WORKER_MODE: "external",
  NEXT_DIST_DIR: ".next-validation",
  BACKEND_URL: "",
  NEXT_PUBLIC_APP_URL: "http://localhost:3154",
  GROQ_API_KEY: "fixture-key-never-used",
});
async function main() {
  const { register, startSession } = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { planDeck, ownedDraft } = await import("../lib/presentations/drafts"),
    { ownedDeck, processDeck } = await import("../lib/presentations/store"),
    { ARCHETYPES, archetypeExample } =
      await import("../lib/presentations/archetypes"),
    { balance } = await import("../lib/credits/store"),
    { enrollWriter } = await import("../lib/writing/profile"),
    { saveStory, reviewStory } = await import("../lib/writing/stories");
  const user = await register(
      "Studio Student",
      "new-studio-ui@example.test",
      "safe-fixture-password",
    ),
    author = await register(
      "Browser Writer",
      "social-ui@example.test",
      "safe-fixture-password",
    );
  await markEmailVerified(user.id);
  await markEmailVerified(author.id);
  const profile = await enrollWriter(author);
  const source = {
    id: "text-browser",
    kind: "text" as const,
    name: "Browser reference",
    text: "Illustrative template data 24% 3× 18. A clear idea deserves a clear presentation. Sample attribution. Illustrative quote.",
  };
  const storyboard = {
    thesis: "Useful evidence becomes a clear story",
    beats: ARCHETYPES.map((archetype, i) => ({
      title: [
        "Evidence changes decisions",
        "Explain the real context",
        "Measure what matters",
        "Compare the useful choices",
        "Follow a clear process",
        "Finish with a useful insight",
      ][i],
      purpose:
        archetype === "metric_trio"
          ? "Compare the supplied 24%, 3× and 18 values"
          : "Explain one supported idea clearly",
      role:
        i === 0
          ? "hook"
          : i === 1
            ? "context"
            : i === 5
              ? "takeaway"
              : "pillar",
      archetype,
      evidence: [source.id],
    })),
  };
  const draft = await planDeck(
    user.id,
    {
      prompt: "Explain research clearly to a student audience with evidence",
      audience: "Students",
      count: 6,
      template: "studio",
      language: "english",
      format: "presenter",
      sources: [source],
      designEngine: 2,
    },
    randomUUID(),
    async () => ({ text: JSON.stringify(storyboard), provider: "fixture" }),
  );
  const submitted = await saveStory(author.id, {
      title: "A clearer approach to research",
      summary: "Reading and using evidence with care",
      body: "Evidence stays in the source. Read the original before quoting it. ".repeat(
        24,
      ),
      tags: ["research"],
      authorName: profile.name,
      creatorSlug: profile.slug,
      canonicalUrl: "https://example.com/original-research",
      submit: true,
    }),
    story = await reviewStory(
      submitted.id,
      "publish",
      "Reviewed fixture",
      author.id,
    );
  const cookie = (
    await startSession(user, new Request("http://localhost:3154"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const [name, value] = cookie.split("=");
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3154"],
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
        if ((await fetch("http://localhost:3154/api/health")).ok) {
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
      reducedMotion: "reduce",
    });
    await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    await context.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    mkdirSync("output/live-audit/new-workspace", { recursive: true });
    await page.goto("http://localhost:3154/presentations");
    await page
      .getByRole("heading", { name: "What will you explain today?" })
      .waitFor();
    await page
      .getByLabel("Presentation brief")
      .fill("Explain a clear research process for a student audience");
    await page.reload();
    await page.getByLabel("Presentation brief").waitFor();
    assert.equal(
      await page.getByLabel("Presentation brief").inputValue(),
      "Explain a clear research process for a student audience",
    );
    await page.getByRole("button", { name: "Add research sources" }).click();
    await page
      .getByLabel("Reference text", { exact: true })
      .fill("A locally supplied source with enough evidence for planning.");
    await page.getByRole("button", { name: "Add text", exact: true }).click();
    await page
      .getByRole("button", { name: "Remove Pasted reference" })
      .waitFor();
    await page.getByRole("button", { name: "Remove Pasted reference" }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Remove Pasted reference" })
        .count(),
      0,
    );
    await page.screenshot({
      path: "output/live-audit/new-workspace/create-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.goto("http://localhost:3154/presentations/templates");
    await page
      .getByRole("heading", { name: "Choose your visual language" })
      .waitFor();
    assert.equal(await page.locator(".pw-template").count(), 9);
    await page.getByRole("button", { name: "Research", exact: true }).click();
    assert.equal(await page.locator(".pw-template").count(), 1);
    await page.goto("http://localhost:3154/presentations/library");
    await page.getByRole("heading", { name: "Plans in progress" }).waitFor();
    await page.locator(`a[href="/presentations/plan/${draft.id}"]`).click();
    await page.getByRole("heading", { name: "Review the plan" }).waitFor();
    await page
      .getByLabel("Slide 1 title", { exact: true })
      .fill("Evidence guides better decisions");
    await page.getByRole("button", { name: "Move slide 3 down" }).click();
    await page.getByRole("button", { name: "Browse themes" }).click();
    await page
      .getByRole("button", { name: "Ocean research", exact: true })
      .click();
    await page.getByRole("button", { name: "Save plan", exact: true }).click();
    await page
      .getByText("Plan saved to your account.", { exact: true })
      .waitFor();
    await page.reload();
    assert.equal(
      await page.getByLabel("Slide 1 title", { exact: true }).inputValue(),
      "Evidence guides better decisions",
    );
    assert.equal((await ownedDraft(user.id, draft.id))!.template, "ocean");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 390) {
        assert.equal(await page.locator(".pw-sidebar").isVisible(), false);
        await page
          .getByRole("button", { name: "Open studio navigation" })
          .click();
        await page.getByRole("dialog", { name: "Studio navigation" }).waitFor();
        await page.keyboard.press("Escape");
        await page
          .getByRole("dialog", { name: "Studio navigation" })
          .waitFor({ state: "hidden" });
        assert.equal(
          await page
            .getByRole("button", { name: "Open studio navigation" })
            .evaluate((el) => el === document.activeElement),
          true,
        );
      }
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `plan ${width} overflow`,
      );
      await page.screenshot({
        path: `output/live-audit/new-workspace/plan-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const before = await balance(user.id);
    await page.getByLabel("Use 5 credits to build this presentation").check();
    await page
      .getByRole("button", { name: "Generate presentation", exact: true })
      .click();
    await page.waitForURL(`**/presentations/deck-${draft.id}`);
    assert.equal(await balance(user.id), before - 5);
    const deckId = `deck-${draft.id}`;
    for (let i = 0; i < 6; i++) {
      await processDeck(deckId, async (messages) => {
        const input = JSON.parse(messages.at(-1)!.content),
          beat = input.beat;
        const semantic = archetypeExample(beat.archetype);
        semantic.title = beat.title;
        semantic.evidence = [source.id];
        if (semantic.archetype === "metric_trio")
          semantic.metrics.forEach((m) => (m.sourceId = source.id));
        if (semantic.archetype === "quote_attribution")
          semantic.sourceId = source.id;
        return { text: JSON.stringify(semantic), provider: "fixture" };
      });
    }
    assert.equal((await ownedDeck(user.id, deckId))!.status, "done");
    await page.reload();
    await page.getByLabel("Main takeaway", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Show research", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Hide research", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Hide research", exact: true })
      .click();
    await page
      .getByLabel("Main takeaway", { exact: true })
      .fill("Use reliable sources to explain one clear idea.");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.getByText("Saved to your account.", { exact: true }).waitFor();
    await page.reload();
    assert.equal(
      await page.getByLabel("Main takeaway", { exact: true }).inputValue(),
      "Use reliable sources to explain one clear idea.",
    );
    await page.screenshot({
      path: "output/live-audit/new-workspace/editor-desktop.png",
      fullPage: true,
    });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `editor ${width} overflow`,
      );
      await page.screenshot({
        path: `output/live-audit/new-workspace/editor-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`http://localhost:3154/creators/${profile.slug}`);
    await page
      .getByRole("button", { name: "Follow writer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Following", exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "Following", exact: true })
      .waitFor();
    await page.goto(`http://localhost:3154/guides/${story.slug}`);
    await page
      .getByLabel("Your response", { exact: true })
      .fill("A helpful public response from the browser fixture.");
    await page
      .getByRole("button", { name: "Post publicly", exact: true })
      .click();
    await page
      .getByText("A helpful public response from the browser fixture.", {
        exact: true,
      })
      .waitFor();
    await page
      .getByLabel("Note for selected passage")
      .fill("This thought stays private");
    await page.locator(".reader-story-content").evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const index =
          node.textContent?.indexOf("Evidence stays in the source.") ?? -1;
        if (index >= 0) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + "Evidence stays in the source.".length);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
          return;
        }
      }
      throw new Error("Fixture passage missing");
    });
    await page
      .getByRole("button", { name: "Save selected passage", exact: true })
      .click();
    await page
      .getByText("Saved privately to your reading library.", { exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByText("This thought stays private", { exact: true })
      .waitFor();
    assert.equal(
      await page.locator('link[rel="canonical"]').getAttribute("href"),
      "https://example.com/original-research",
    );
    await page.goto("http://localhost:3154/reading");
    await page
      .getByText("This thought stays private", { exact: true })
      .waitFor();
    await page
      .getByRole("link", { name: "Browser Writer →", exact: true })
      .waitFor();
    await page.screenshot({
      path: "output/live-audit/new-workspace/reading-library.png",
      fullPage: true,
    });
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto(`http://localhost:3154/guides/${story.slug}`);
    await guestPage
      .getByText("A helpful public response from the browser fixture.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await guestPage
        .getByText("This thought stays private", { exact: true })
        .count(),
      0,
    );
    await guest.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS browser: new studio routes, real source import/removal, brief recovery, nine themes/filter, owned saved-plan discovery/reorder/reload, single charge, semantic editing/persistence, responsive plan/editor, durable following/responses, private highlights/library and canonical metadata.",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
