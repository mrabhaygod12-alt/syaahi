import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, webkit, devices } from "playwright";
import sharp from "sharp";
async function main() {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-writer-ui-"));
  process.env.DATA_BACKEND = "sqlite";
  process.env.MONGODB_URI = "";
  process.env.APP_ROLE = "all";
  process.env.BACKEND_URL = "";
  process.env.NEXT_DIST_DIR = ".next-validation";
  process.env.WORKER_MODE = "external";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3147";
  const { register, startSession } = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { enrollWriter } = await import("../lib/writing/profile"),
    { saveStory, reviewStory } = await import("../lib/writing/stories");
  const user = await register(
    "Student Example",
    "student-browser@example.test",
    "browser-password-42",
  );
  await markEmailVerified(user.id);
  const author = await register(
    "Syaahi Editorial",
    "editor-browser@example.test",
    "browser-password-42",
  );
  await markEmailVerified(author.id);
  await enrollWriter(author);
  const draft = await saveStory(author.id, {
    title: "The art of learning something deeply",
    summary:
      "Why curiosity, practice and a little patience make all the difference.",
    body: "Close the book and explain what you know. Learning begins when you ask a better question, revisit a difficult idea, and make space to think for yourself.",
    tags: ["Learning", "Personal growth"],
    authorName: author.name,
    submit: true,
  });
  const published = await reviewStory(
    draft.id,
    "publish",
    "Reviewed",
    author.id,
  );
  const jobs = await import("../lib/jobs/store");
  const lesson = await jobs.createJob(
    author.id,
    ["Shared learning"],
    "concise",
    {},
  );
  const lease = (await jobs.claimJob(lesson.id))!;
  await jobs.commitPage(lesson.id, lease.token, 0, {
    topic: "Shared learning",
    markdown: "## Learning together\nAsk questions and explain your reasoning.",
    provider: "fixture",
    model: "fixture",
  });
  await jobs.finishJob(lesson.id, lease.token);
  const { createShare } = await import("../lib/study/collaboration");
  const invitation = await createShare(lesson, "viewer");
  const session = await startSession(
    user,
    new Request("http://localhost:3147"),
  );
  const [name, value] = session.headers
    .get("set-cookie")!
    .split(";")[0]
    .split("=");
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3147"],
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
        if ((await fetch("http://localhost:3147/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (dialog) => dialog.accept());
    await page.addInitScript(() => {
      if (window === window.top)
        localStorage.setItem("syaahi-privacy-v1", "essential");
    });
    mkdirSync("output/writer-redesign", { recursive: true });
    await page.goto("http://localhost:3147/writing");
    await page.getByRole("link", { name: "Log in", exact: true }).click();
    const modal = page.getByRole("dialog");
    await modal.waitFor();
    assert.match(page.url(), /\/writing$/);
    await modal.getByRole("heading", { name: "Welcome back." }).waitFor();
    await page.screenshot({ path: "output/writer-redesign/auth-dialog.png" });
    await modal
      .getByRole("link", { name: "Create account", exact: true })
      .click();
    await modal
      .getByRole("heading", { name: "Create your Syaahi account." })
      .waitFor();
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    await page.goto(`http://localhost:3147/share/${invitation.token}`);
    await page.getByRole("button", { name: "Open in my workspace" }).click();
    await page
      .getByRole("link", { name: "Sign in to join this lesson" })
      .click();
    await modal.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.match(page.url(), /\/share\//);
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    await page.goto("http://localhost:3147/writer");
    await page
      .getByText(
        "Create a writer profile with your existing email and password.",
        { exact: false },
      )
      .waitFor();
    await page
      .getByRole("link", { name: "Create writer profile", exact: true })
      .click();
    await modal.waitFor();
    await modal.locator('input[value="writer"]:checked').waitFor();
    await modal.getByLabel("Full name").fill("Student Example");
    await modal.getByLabel("Email", { exact: true }).fill(user.email);
    await modal
      .getByLabel("Password", { exact: true })
      .fill("browser-password-42");
    await modal.getByRole("checkbox").check();
    await modal
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "For the curious mind." })
      .waitFor();
    await page.getByRole("heading", { name: published.title }).waitFor();
    await page.screenshot({
      path: "output/writer-redesign/writer-home.png",
      fullPage: true,
    });
    const identity = await (
      await page.request.get("http://localhost:3147/api/user/profile")
    ).json();
    assert.equal(identity.user.id, user.id);
    assert.equal(identity.user.balance, 19);
    await page.goto("http://localhost:3147/writer/profile");
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await modal.getByLabel("Name*").fill("Aarav the Writer");
    await modal
      .getByLabel("Short bio")
      .fill(
        "Exploring technology, learning and the everyday art of curiosity.",
      );
    await modal.getByLabel("Pronouns").fill("he/him");
    await modal
      .getByLabel("About page")
      .fill(
        "I write to understand the world. I share practical guides for curious students and thoughtful creators.",
      );
    const photo = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#b4c5a2" },
    })
      .png()
      .toBuffer();
    await modal.locator("input[type=file]").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: photo,
    });
    await page.screenshot({
      path: "output/writer-redesign/profile-dialog.png",
    });
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await modal.waitFor({ state: "hidden" });
    await page
      .getByRole("heading", { name: "Aarav the Writer", exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByRole("heading", { name: "Aarav the Writer", exact: true })
      .waitFor();
    assert.equal(
      (
        await (
          await page.request.get("http://localhost:3147/api/user/profile")
        ).json()
      ).user.name,
      "Student Example",
    );
    await page.screenshot({
      path: "output/writer-redesign/writer-profile.png",
      fullPage: true,
    });
    const wp = (
      await (
        await page.request.get("http://localhost:3147/api/writer/profile")
      ).json()
    ).profile;
    await page.goto(`http://localhost:3147/creators/${wp.slug}`);
    await page
      .getByRole("heading", { name: "Aarav the Writer", exact: true })
      .waitFor();
    await page
      .getByText("I write to understand the world.", { exact: false })
      .waitFor();
    await page.goto("http://localhost:3147/write");
    const editor = page.getByRole("textbox", { name: "Story editor" });
    await editor.waitFor();
    await page.locator("#story-title").fill("A more thoughtful way to learn");
    await editor.fill(
      "Curiosity is the beginning of understanding. Read actively, test your knowledge and revisit difficult ideas. A thoughtful practice turns a collection of facts into an understanding that stays with you.",
    );
    await editor.press("Control+a");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    // Split the first word across marks; Find must still see the whole word.
    await editor.press("Control+Home");
    await editor.press("Shift+ArrowRight");
    await editor.press("Shift+ArrowRight");
    await page.getByRole("button", { name: "Italic", exact: true }).click();
    await editor.press("Control+a");
    await page
      .getByLabel("Font family", { exact: true })
      .selectOption("Georgia");
    await page.getByLabel("Font size", { exact: true }).selectOption("24px");
    await page
      .getByRole("button", { name: "Align center", exact: true })
      .click();
    await page.getByText("Saved to your account.", { exact: true }).waitFor();
    assert.match(page.url(), /draft=/);
    let saved = (
      await (await page.request.get("http://localhost:3147/api/stories")).json()
    ).stories[0];
    assert.equal(saved.document.content[0].attrs.textAlign, "center");
    assert(
      saved.document.content[0].content[0].marks.some(
        (m: any) => m.type === "textStyle" && m.attrs.fontSize === "24px",
      ),
    );
    await page
      .getByRole("button", { name: "Find and replace", exact: true })
      .click();
    await page.getByLabel("Find text", { exact: true }).fill("Curiosity");
    await page.getByLabel("Replace with", { exact: true }).fill("Wonder");
    await page
      .getByRole("button", { name: "Replace all", exact: true })
      .click();
    assert((await editor.textContent())!.startsWith("Wonder"));
    await page.getByRole("button", { name: "Close find and replace" }).click();
    await editor.click();
    await editor.press("Control+End");
    await editor.press("Enter");
    await page.getByRole("tab", { name: "Insert", exact: true }).click();
    await page
      .getByRole("button", { name: "Insert table", exact: true })
      .click();
    await editor.locator("table").waitFor();
    await page.getByRole("button", { name: "Add row", exact: true }).click();
    assert.equal(await editor.locator("tr").count(), 4);
    await page.getByText("Saved to your account.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    assert.equal(await page.locator(".story-prose table tr").count(), 4);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await page.screenshot({
      path: "output/writer-redesign/writer-editor.png",
      fullPage: true,
    });
    const draftUrl = page.url();
    await page.reload();
    await editor.waitFor();
    assert.equal(
      await page.locator("#story-title").inputValue(),
      "A more thoughtful way to learn",
    );
    assert.equal(await editor.locator("table tr").count(), 4);
    assert((await editor.textContent())!.includes("Wonder"));
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await modal
      .getByLabel("Story preview summary")
      .fill("A practical approach to active learning.");
    await modal.getByLabel("Topics (up to five)").fill("Learning, Technology");
    await modal
      .getByRole("button", { name: "Submit for publication", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    await page.getByText("This story is awaiting editorial review.").waitFor();
    await page.goto("http://localhost:3147/writer/stories");
    await page.getByRole("tab", { name: /In review/ }).click();
    await page
      .getByRole("heading", { name: "A more thoughtful way to learn" })
      .waitFor();
    await page.screenshot({
      path: "output/writer-redesign/writer-stories.png",
      fullPage: true,
    });
    await page.goto("http://localhost:3147/writer/stats");
    await page.getByRole("heading", { name: "Your impact" }).waitFor();
    assert(
      (await page.locator(".writer-metrics").innerText()).includes("In review"),
    );
    await page.request.post(
      `http://localhost:3147/api/publications/${published.slug}/engagement`,
      {
        headers: { origin: "http://localhost:3147" },
        data: { action: "bookmark", value: true },
      },
    );
    await page.goto("http://localhost:3147/writer/library");
    await page.getByRole("heading", { name: published.title }).waitFor();
    await page.goto("http://localhost:3147/writer/settings");
    await page.getByLabel("Writer appearance").selectOption("dark");
    await page.waitForFunction(
      () => document.documentElement.dataset.writerTheme === "dark",
    );
    await page.reload();
    await page.waitForFunction(
      () => document.documentElement.dataset.writerTheme === "dark",
    );
    await page.screenshot({
      path: "output/writer-redesign/writer-dark.png",
      fullPage: true,
    });
    await page.getByLabel("Writer appearance").selectOption("light");
    await page.waitForFunction(
      () => document.documentElement.dataset.writerTheme === "light",
    );
    await page
      .getByRole("button", { name: "Open writer account menu", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Your stories", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".writer-account-menu").count(), 0);
    assert.equal(errors.length, 0, errors.join("\n"));
    // Safari rejects Secure cookies on local HTTP. Production uses HTTPS;
    // transplant only this isolated test session into the loopback contexts.
    const writerCookies = (await context.cookies()).map((c) => ({
      ...c,
      secure: false,
    }));
    for (const engine of [chromium, webkit]) {
      const mobileBrowser = await engine.launch();
      try {
        const mobile = await mobileBrowser.newContext({
          ...devices["iPhone 13"],
          browserName: undefined,
        } as any);
        await mobile.addCookies(writerCookies);
        const p = await mobile.newPage();
        p.on("pageerror", (e) => errors.push(e.message));
        await p.addInitScript(() => {
          if (window === window.top)
            localStorage.setItem("syaahi-privacy-v1", "essential");
        });
        for (const path of [
          "/writer",
          "/writer/stories",
          "/writer/profile",
          "/writer/stats",
          "/writer/library",
          "/writer/settings",
          new URL(draftUrl).pathname + new URL(draftUrl).search,
          "/pricing",
        ]) {
          await p.goto(`http://localhost:3147${path}`);
          if (path.startsWith("/writer"))
            await p.locator(".writer-workspace").waitFor();
          if (path.startsWith("/write?"))
            await p.getByRole("textbox", { name: "Story editor" }).waitFor();
          await p.waitForLoadState("networkidle");
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
            `${engine.name()} overflow: ${path}`,
          );
        }
        await p.goto("http://localhost:3147/writer/profile");
        await p.waitForLoadState("networkidle");
        await p
          .getByRole("button", { name: "Toggle writer navigation" })
          .click();
        await p.locator(".writer-sidebar.expanded").waitFor();
        await p
          .getByRole("button", { name: "Toggle writer navigation" })
          .click();
        await p.screenshot({
          path: `output/writer-redesign/writer-mobile-${engine.name()}.png`,
          fullPage: true,
        });
      } finally {
        await mobileBrowser.close();
      }
    }
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS: real auth modal + same-email enrollment; profile/photo/public persistence; editor styles/autosave/reload/find/table/preview/submission; library/stats/theme/account menu; Chromium and WebKit mobile navigation and overflow.",
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
