import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
async function main() {
  const base = "http://localhost:3158";
  Object.assign(process.env, {
    APP_ROLE: "all",
    BACKEND_URL: "",
    MONGODB_URI: "",
    DATA_BACKEND: "sqlite",
    DATA_DIR: mkdtempSync(join(tmpdir(), "writer-publishing-ui-")),
    WORKER_MODE: "external",
    NEXT_DIST_DIR: ".next-validation",
    NEXT_PUBLIC_APP_URL: base,
    ADMIN_EMAILS: "publishing-admin-ui@example.test",
    ADMIN_MFA_ENFORCE: "1",
    ADMIN_MFA_KEY: Buffer.alloc(32, 12).toString("base64"),
  });
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { enrollWriter } = await import("../lib/writing/profile"),
    { setWorkspace } = await import("../lib/workspace-preference"),
    stories = await import("../lib/writing/stories"),
    mfa = await import("../lib/auth/admin-mfa");
  const writer = await auth.register(
      "University Writer",
      "publishing-writer-ui@example.test",
      "publishing-fixture-password",
    ),
    admin = await auth.register(
      "Editorial Administrator",
      "publishing-admin-ui@example.test",
      "publishing-fixture-password",
    );
  for (const u of [writer, admin]) await markEmailVerified(u.id);
  await enrollWriter(writer);
  await setWorkspace(writer.id, "writer");
  const draft = await stories.saveStory(writer.id, {
    title: "Database normalization: original reviewed guide",
    summary: "A concise database design guide for university students.",
    body: "Functional dependencies explain how attributes determine one another. A database normalization example must preserve a lossless reconstruction and avoid redundant data.",
    tags: ["databases"],
    authorName: writer.name,
    submit: true,
  });
  const published = await stories.reviewStory(
    draft.id,
    "publish",
    "Reviewed fixture",
    admin.id,
  );
  const cookie = async (u: any) =>
    (await auth.startSession(u, new Request(base))).headers
      .get("set-cookie")!
      .split(";")[0];
  const own = await cookie(writer),
    root = await cookie(admin),
    req = new Request(base + "/api/admin/mfa", { headers: { cookie: root } });
  const principal = (await auth.currentUser(req))!,
    setup = await mfa.beginMfa(principal, req, "publishing-fixture-password");
  await mfa.confirmMfa(principal, req, setup.id, mfa.totp(setup.secret));
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3158"],
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
    const makeContext = async (raw: string) => {
      const ctx = await browser!.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const [name, value] = raw.split("=");
      await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
      await ctx.addInitScript(() =>
        localStorage.setItem("syaahi-privacy-v1", "essential"),
      );
      return ctx;
    };
    const ctx = await makeContext(own),
      rootCtx = await makeContext(root),
      page = await ctx.newPage(),
      review = await rootCtx.newPage(),
      errors: string[] = [];
    for (const p of [page, review])
      p.on("pageerror", (e) => errors.push(e.message));
    mkdirSync("output/writer-publishing", { recursive: true });
    const tab = (name: string) =>
      page.getByRole("tab", { name: new RegExp("^" + name) });
    await page.goto(base + "/writer/stories");
    await tab("Published").click();
    await page
      .getByRole("button", { name: "Edit private revision", exact: true })
      .click();
    await page.waitForURL(/\/write\?draft=/);
    await page.getByText("Private revision ·", { exact: false }).waitFor();
    await page
      .locator("#story-title")
      .fill("Normalization with a clearer worked example");
    await page
      .getByRole("textbox", { name: "Story editor" })
      .fill(
        "Functional dependencies explain how attributes determine one another. A lossless decomposition keeps the original data reconstructable. This reviewed revision adds a useful university course example.",
      );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Publish your story" });
    const d = new Date(Date.now() + 3600000),
      local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    await modal
      .getByLabel("Requested publication time", { exact: true })
      .fill(local);
    await modal
      .getByRole("button", { name: "Submit for publication", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    assert.equal(
      (await stories.getPublicStory(published.slug!))!.title,
      published.title,
    );
    await review.goto(base + "/admin/publications");
    await review
      .getByRole("button", { name: "Approve and schedule", exact: true })
      .click();
    await review
      .getByRole("button", { name: "Approve and schedule", exact: true })
      .waitFor({ state: "hidden" });
    await page.goto(base + "/writer/stories");
    await tab("Scheduled").click();
    await page
      .getByRole("button", { name: "Cancel schedule", exact: true })
      .waitFor();
    await page.screenshot({
      path: "output/writer-publishing/scheduled-desktop.png",
      fullPage: true,
    });
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.screenshot({
        path: `output/writer-publishing/scheduled-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Cancel schedule", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm cancel schedule", exact: true })
      .click();
    await page.getByRole("link", { name: "Edit draft", exact: true }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    assert.equal(
      await modal
        .getByLabel("Requested publication time", { exact: true })
        .inputValue(),
      "",
    );
    await modal
      .getByRole("button", { name: "Submit for publication", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    await review.reload();
    await review
      .getByRole("button", { name: "Approve revision", exact: true })
      .click();
    await review
      .getByRole("button", { name: "Approve revision", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      (await stories.getPublicStory(published.slug!))!.title,
      "Normalization with a clearer worked example",
    );
    await page.goto(base + "/writer/stories");
    await tab("Published").click();
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm unpublish", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Revise and republish", exact: true })
      .waitFor();
    assert.equal((await fetch(base + "/guides/" + published.slug)).status, 404);
    await page
      .getByRole("button", { name: "Revise and republish", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Story editor" }).waitFor();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await modal
      .getByRole("button", { name: "Submit for publication", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    await review.reload();
    await review
      .getByRole("button", { name: "Approve revision", exact: true })
      .click();
    await review
      .getByRole("button", { name: "Approve revision", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal((await fetch(base + "/guides/" + published.slug)).status, 200);
    await page.goto(base + "/writer/stories");
    await tab("Published").click();
    await page
      .getByRole("button", { name: "Edit private revision", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS writer publishing browser: real private revision editor, requested time, MFA-authorized approval, scheduled cancellation, unchanged public content until approval, stable URL, unpublish/republish and 390/768/1440 layout.",
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
