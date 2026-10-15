import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
const origin = "http://localhost:3188";
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahii-video-ui-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  WORKER_MODE: "external",
  APP_ROLE: "all",
  NEXT_DIST_DIR: ".next-validation",
  BACKEND_URL: "",
  NEXT_PUBLIC_APP_URL: origin,
  ADMIN_EMAILS: "review-editor@example.test",
  ADMIN_MFA_ENFORCE: "1",
  ADMIN_MFA_KEY: Buffer.alloc(32, 9).toString("base64"),
});
async function main() {
  const auth = await import("../lib/auth/server"),
    jobs = await import("../lib/jobs/store"),
    mfa = await import("../lib/auth/admin-mfa");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  const user = await auth.register(
      "University learner",
      "review-learner@example.test",
      "fixture-browser-password",
    ),
    admin = await auth.register(
      "Fixture editor",
      "review-editor@example.test",
      "fixture-browser-password",
    );
  for (const u of [user, admin]) await markEmailVerified(u.id);
  const cookie = async (u: any) =>
    (await auth.startSession(u, new Request(origin))).headers
      .get("set-cookie")!
      .split(";")[0];
  const studentCookie = await cookie(user),
    adminCookie = await cookie(admin);
  const adminRequest = new Request(origin, {
      headers: { cookie: adminCookie },
    }),
    administrator = (await auth.currentUser(adminRequest))!;
  const setup = await mfa.beginMfa(
    administrator,
    adminRequest,
    "fixture-browser-password",
  );
  await mfa.confirmMfa(
    administrator,
    adminRequest,
    setup.id,
    mfa.totp(setup.secret),
  );
  const markdown =
    "## Database normalization\n**Definition:** Organise relational data to reduce redundancy.\n### Core idea\n- Keep each **fact** in one place.\n- Connect tables using keys.\n### Worked example\n- Store a department name once in its department table.\nDiagram: flow | Identify redundancy | Separate entities | Connect with keys\n| Before | After |\n| Repeated departments | One department record |\nExam alert: Splitting tables without preserving relationships loses meaning.\nSummary: Normalize carefully, then verify dependencies.\n";
  const job = await jobs.createJob(
      user.id,
      ["Database normalization"],
      "detailed",
    ),
    lease = (await jobs.claimJob(job.id))!;
  await jobs.commitPage(job.id, lease.token, 0, {
    topic: "Database normalization",
    markdown,
    provider: "fixture",
    model: "fixture",
  });
  await jobs.finishJob(job.id, lease.token);
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3188"],
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
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("syaahi-privacy-v1", "essential");
      } catch {
        /* Opaque sandboxed print frames have no storage. */
      }
    });
    const add = async (ctx: any, raw: string) => {
      const [name, value] = raw.split("=");
      await ctx.addCookies([{ name, value, url: origin }]);
    };
    await add(context, studentCookie);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    mkdirSync("output/video-reviews", { recursive: true });
    const layout = async (label: string) => {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
          `${label} overflows at ${width}`,
        );
        await page.screenshot({
          path: `output/video-reviews/${label}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    };
    await page.goto(origin + "/feedback");
    await page
      .getByLabel("Your experience")
      .fill(
        "The editable outline helped me understand normalization, but I would like more worked examples.",
      );
    await page.getByRole("radio", { name: "2", exact: true }).check();
    await page.getByRole("checkbox", { name: /I agree to display/ }).check();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await page.getByText(/Thank you. Your feedback is saved/).waitFor();
    await layout("feedback");
    await add(context, adminCookie);
    await page.goto(origin + "/admin/reviews");
    await page.getByRole("heading", { name: "University learner" }).waitFor();
    await page
      .getByLabel("Moderation reason")
      .fill("Genuine learning experience; suitable for public feedback.");
    await page.getByRole("button", { name: "Save decision" }).click();
    await page.getByText(/2\/5 · published/).waitFor();
    await layout("admin-reviews");
    await page.goto(origin + "/admin");
    await page.getByRole("heading", { name: "AI routing" }).waitFor();
    await layout("admin-overview");
    await page
      .getByRole("button", { name: "Open administration navigation" })
      .click();
    await page
      .getByRole("navigation", { name: "Administration" })
      .getByRole("link", { name: "Reviews", exact: true })
      .click();
    await page.waitForURL("**/admin/reviews");
    await add(context, studentCookie);
    await page.goto(origin + "/");
    await page
      .getByRole("heading", { name: "Real experience. Useful feedback." })
      .waitFor();
    await page.getByText("University learner", { exact: true }).waitFor();
    await page.getByRole("button", { name: "03 Make ideas visible" }).click();
    await page.getByText("03 · STUDY ATLAS", { exact: true }).waitFor();
    await layout("landing");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator(".learning-bento").screenshot({
      path: "output/video-reviews/learning-bento-desktop.png",
      animations: "disabled",
    });
    for (const path of ["/ai-generated-notes", "/youtube-video-to-notes"]) {
      const response = await fetch(origin + path),
        html = await response.text();
      assert.equal(response.status, 200);
      assert(html.includes('name="robots" content="index, follow"'));
      assert(html.includes("application/ld+json"));
      assert(html.includes("Syaahii Pvt. Ltd."));
    }
    await page.goto(`${origin}/lesson/${job.id}/notes`);
    await page.getByLabel("PDF template", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("PDF template", { exact: true }).inputValue(),
      "atlas",
    );
    await page
      .getByText(/Active recall: explain Database normalization/)
      .click();
    await page
      .getByRole("button", { name: "Practice with the study assistant" })
      .waitFor();
    await page.getByLabel("Reviewed", { exact: true }).check();
    await page.reload();
    await page.getByLabel("Reviewed", { exact: true }).waitFor();
    assert(await page.getByLabel("Reviewed", { exact: true }).isChecked());
    await page.locator(".reading-page").waitFor();
    await layout("atlas-reader");
    await page.getByText("Reading & accessibility", { exact: true }).click();
    await page.getByLabel("View", { exact: true }).selectOption("print");
    const frame = page.frameLocator(".print-note iframe");
    await frame.locator(".sheet").first().waitFor({ timeout: 30000 });
    assert((await frame.locator(".sheet").count()) >= 1);
    assert.equal(
      await frame.locator(".sheet").evaluateAll((sheets) =>
        sheets.every((sheet) => {
          const body = sheet.querySelector(".sheet-body")!;
          return body.scrollHeight <= body.clientHeight + 3;
        }),
      ),
      true,
    );
    assert(
      await frame.getByText("Identify redundancy", { exact: false }).count(),
    );
    await layout("atlas-notes");
    await page.goto(origin + "/dashboard");
    await page.getByRole("heading", { name: /Your next step/ }).waitFor();
    await layout("student-workspace");
    const video = await import("../lib/youtube/jobs");
    const videoUrl = "https://www.youtube.com/watch?v=abcdefghijk";
    const videoJob = await video.enqueueVideo(user.id, videoUrl);
    const initialBalance = (
      await (await context.request.get(origin + "/api/credits")).json()
    ).balance;
    let plannedSource = "";
    await page.route("**/api/plan", async (route) => {
      plannedSource = route.request().postDataJSON().context;
      await route.fulfill({
        json: {
          topics: ["Database normalization"],
          context: plannedSource,
          sources: [],
          readingLinks: [],
          evidence: "supplied source",
          reason: "Fixture source reviewed",
          note: "Review this outline",
        },
      });
    });
    await page.goto(
      origin + "/dashboard?topic=" + encodeURIComponent(videoUrl),
    );
    await page
      .getByRole("button", { name: "Plan my notes", exact: true })
      .click();
    await page
      .getByText("Lecture queued… Waiting for the processing service.", {
        exact: true,
      })
      .waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "Plan my notes", exact: true })
      .click();
    await page
      .getByText("Lecture queued… Waiting for the processing service.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      (await video.ownedVideo(videoJob.id, user.id))?.status,
      "queued",
    );
    await video.processVideo(videoJob.id, {
      assertAccountActive: async () => {},
      fetchYouTube: async () =>
        ({
          videoId: "abcdefghijk",
          title: "Database normalization",
          author: "Fixture source",
          durationSeconds: 240,
          transcript:
            "Database normalization reduces duplicate data and connects tables with keys. ".repeat(
              8,
            ),
          transcriptChars: 608,
          transcriptSource: "video-digest",
        }) as any,
      assessVideo: async () => ({
        classification: "educational",
        reason: "Teaches a CS topic",
        topics: ["Database normalization"],
      }),
    });
    await page
      .getByLabel("Edit your note pages, one per line", { exact: true })
      .waitFor({ timeout: 15000 });
    assert(
      plannedSource.includes(
        "SOURCE TYPE: AI-extracted video digest, not verbatim captions.",
      ),
    );
    assert(
      plannedSource.includes("Database normalization reduces duplicate data"),
    );
    assert.equal(
      (await (await context.request.get(origin + "/api/credits")).json())
        .balance,
      initialBalance,
    );
    await layout("video-outline");
    const stopped = await video.enqueueVideo(
      user.id,
      "https://youtu.be/lmnopqrstuv",
    );
    await page.reload();
    const queuePanel = page.getByRole("region", {
      name: "Recent lecture imports",
    });
    await queuePanel.getByRole("button", { name: "Stop", exact: true }).click();
    await queuePanel.getByText("cancelled", { exact: true }).waitFor();
    assert.equal(
      (await video.ownedVideo(stopped.id, user.id))?.status,
      "cancelled",
    );
    // A denied storage API must not undo a successfully revoked server session.
    await page.evaluate(() => {
      Storage.prototype.removeItem = () => {
        throw new DOMException("Blocked", "SecurityError");
      };
    });
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL(origin + "/");
    assert.equal(
      (await context.request.get(origin + "/api/auth")).status(),
      200,
    );
    assert.equal(
      (await (await context.request.get(origin + "/api/auth")).json()).user,
      null,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS browser: authentic negative feedback, MFA-protected moderation, responsive admin navigation, real homepage widget, bento workflow, indexable product pages, atlas pagination, saved review progress, resumable queued video-to-outline without credit charges, responsive student workspace and logout with blocked local storage.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
