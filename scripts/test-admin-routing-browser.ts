import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
async function main() {
  const origin = "http://localhost:3148";
  Object.assign(process.env, {
    DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-admin-browser-")),
    DATA_BACKEND: "sqlite",
    MONGODB_URI: "",
    APP_ROLE: "all",
    BACKEND_URL: "",
    WORKER_MODE: "external",
    NEXT_DIST_DIR: ".next-validation",
    NEXT_PUBLIC_APP_URL: origin,
    ADMIN_EMAILS: "admin-browser@example.test",
    ADMIN_MFA_ENFORCE: "1",
    ADMIN_MFA_KEY: Buffer.alloc(32, 6).toString("base64"),
  });
  const auth = await import("../lib/auth/server"),
    { markEmailVerified } = await import("../lib/billing/rewards"),
    { enrollWriter } = await import("../lib/writing/profile"),
    { setWorkspace } = await import("../lib/workspace-preference"),
    mfa = await import("../lib/auth/admin-mfa");
  const admin = await auth.register(
      "Browser Administrator",
      "admin-browser@example.test",
      "browser-admin-password",
    ),
    student = await auth.register(
      "University Student",
      "student-browser@example.test",
      "browser-student-password",
    );
  for (const u of [admin, student]) await markEmailVerified(u.id);
  await enrollWriter(student);
  await setWorkspace(student.id, "writer");
  const cookie = async (u: any) =>
    (await auth.startSession(u, new Request(origin))).headers
      .get("set-cookie")!
      .split(";")[0];
  const adminCookie = await cookie(admin),
    writerCookie = await cookie(student);
  const ticketStore = await import("../lib/support"),
    id = "9a89c981-660a-4fa2-aef1-49e9c610a744",
    at = new Date().toISOString();
  await ticketStore.changeTicket(
    student.id,
    id,
    () => ({
      id,
      user: student.id,
      workspace: "writer",
      subject: "Writer billing help",
      category: "payment",
      status: "open",
      createdAt: at,
      messages: [
        {
          by: "learner",
          text: "Please explain the monthly writer plan billing date.",
          at,
        },
      ],
    }),
    undefined,
    "create",
    true,
  );
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3148"],
    {
      windowsHide: true,
      env: process.env,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const add = async (ctx: any, raw: string) => {
      const [name, value] = raw.split("=");
      await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    };
    await add(context, adminCookie);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    await page.goto(origin + "/admin/users");
    await page.waitForURL("**/admin/security");
    await page
      .getByRole("heading", { name: "Enroll an authenticator." })
      .waitFor();
    await page.getByLabel("Current password").fill("browser-admin-password");
    const setupResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/mfa") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    const setup = await (await setupResponse).json();
    await page
      .getByLabel("Six-digit authenticator code")
      .fill(mfa.totp(setup.secret));
    await page.getByRole("button", { name: "Confirm authenticator" }).click();
    await page
      .getByRole("heading", { name: "Save your recovery codes now." })
      .waitFor();
    assert.equal(
      (await page.getByLabel("Recovery codes").inputValue()).split("\n").length,
      8,
    );
    await page.getByRole("link", { name: "Open control room" }).click();
    await page
      .getByRole("heading", { name: "A clear view of your platform." })
      .waitFor();
    await page.goto(origin + "/admin/users");
    await page.getByLabel("Search users").fill("student-browser@example.test");
    await page.getByRole("button", { name: "Search accounts" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll(".admin-table tbody tr").length === 1,
    );
    await page.getByRole("button", { name: "Inspect account" }).waitFor();
    await page.getByRole("button", { name: "Inspect account" }).click();
    await page.getByLabel("Account name").fill("University Writer");
    await page
      .getByLabel("Reason for this change")
      .fill("Correct synthetic account display name");
    await page.getByRole("button", { name: "Save name" }).click();
    await page
      .getByRole("heading", { name: "University Writer", exact: true })
      .waitFor();
    await page.goto(origin + "/admin/support?ticket=" + id);
    await page
      .getByRole("heading", { name: "Writer billing help", exact: true })
      .waitFor();
    await page
      .getByLabel("Reply or private note")
      .fill("Private operations note for the synthetic ticket.");
    await page.getByRole("button", { name: "Save internal note" }).click();
    await page.getByText("Internal notes (1)", { exact: true }).waitFor();
    await page
      .getByLabel("Reply or private note")
      .fill(
        "Your Max membership renews monthly. Check Billing for the actual next billing date.",
      );
    await page.getByRole("button", { name: "Send support reply" }).click();
    await page.getByText("Support reply", { exact: true }).waitFor();
    mkdirSync("output/admin", { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "output/admin/support-desktop.png",
      fullPage: true,
    });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/admin",
        "/admin/users",
        "/admin/support",
        "/admin/security",
      ]) {
        await page.goto(origin + path);
        await page.locator(".admin-content").waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `${path} overflows ${width}px`,
        );
      }
    }
    const writer = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await add(writer, writerCookie);
    const w = await writer.newPage();
    await w.addInitScript(() =>
      localStorage.setItem("syaahi-privacy-v1", "essential"),
    );
    for (const [source, target] of [
      ["/pricing?region=INR#max", "/writer/membership?region=INR#max"],
      ["/support", "/writer/support"],
      ["/profile", "/writer/settings"],
      ["/account/billing", "/writer/billing"],
      ["/payments", "/writer/payments"],
      ["/checkout/9", "/writer/membership"],
      ["/dashboard", "/writer/welcome"],
    ]) {
      await w.goto(origin + source);
      await w.waitForURL(origin + target);
      await w.locator(".writer-workspace").waitFor();
      assert.equal(
        await w.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        source + " mobile overflow",
      );
    }
    const denied = await w.goto(origin + "/admin/users");
    assert.equal(denied!.status(), 404);
    const api = await w.request.get(origin + "/api/admin/users");
    assert.equal(api.status(), 403);
    await w.goto(origin + "/writer/support");
    await w
      .getByRole("button", { name: "Writer billing help", exact: false })
      .click();
    await w
      .getByText("Your Max membership renews monthly.", { exact: false })
      .waitFor();
    assert.equal(
      await w.getByText("Private operations note", { exact: false }).count(),
      0,
    );
    // A delayed account response must not overwrite a newer refresh.
    let release: () => void = () => {},
      calls = 0;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    await w.route("**/api/auth", async (route) => {
      const old = ++calls === 1;
      if (old) await delayed;
      await route
        .fulfill({
          json: { user: { ...student, workspace: old ? "writer" : "student" } },
        })
        .catch(() => {});
    });
    await w.goto(origin + "/writer/profile");
    await w.waitForFunction(() =>
      document.body.textContent?.includes("Opening your writing space"),
    );
    await w.evaluate(() =>
      window.dispatchEvent(new Event("syaahi:account-updated")),
    );
    await w
      .getByText("Sign in as a writer to open your writing space.", {
        exact: false,
      })
      .waitFor();
    release();
    await w.waitForTimeout(200);
    assert.equal(await w.locator(".writer-workspace").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "Production browser checks passed: real MFA enrollment, admin accounts/support, private note redaction, 390/768/1440px layout, writer route matrix and stale account response isolation.",
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
