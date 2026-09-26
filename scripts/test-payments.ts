import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

async function main() {
  const replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.12" },
  });
  process.env.MONGODB_URI = replica.getUri();
  process.env.DATA_BACKEND = "mongo";
  process.env.MONGODB_DATABASE = "payment_test";
  process.env.APP_ROLE = "all";
  process.env.UPI_MERCHANT_ID = "8090912278@ybl";
  process.env.UPI_MERCHANT_NAME = "CHANDAN PANDEY";
  process.env.RAZORPAY_WEBHOOK_SECRET = "isolated-payment-test-secret";
  process.env.WORKER_MODE = "external";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3120";
  process.env.BACKEND_URL = "";
  process.env.BACKEND_PROXY_SECRET = "test-proxy-secret";
  let server: ReturnType<typeof spawn> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const { register } = await import("../lib/auth/server");
    const { collection } = await import("../lib/storage/mongo");
    const { balance } = await import("../lib/credits/store");
    const upi = await import("../lib/billing/upi");
    const { saveOrder } = await import("../lib/billing/orders");
    const { capturePayment } = await import("../lib/billing/payments");
    const user = await register(
      "Buyer",
      "buyer@example.test",
      "test-password-12345",
    );
    const admin = await register(
      "Admin",
      "admin@example.test",
      "test-password-12345",
    );
    process.env.PAYMENT_ADMIN_IDS = admin.id;
    const verified = await collection("verified_accounts");
    await verified.insertMany([
      { _id: user.id, verifiedAt: new Date() },
      { _id: admin.id, verifiedAt: new Date() },
    ]);
    await (
      await collection("payment_admins")
    ).insertOne({ _id: admin.id, active: true });
    process.env.PAYMENT_ADMIN_IDS = "";
    assert.equal(await upi.isAdmin(admin.id), true);
    assert.equal(await upi.isAdmin(user.id), false);
    const col = await collection("upi_payments");
    await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await upi.ensureUpiIndexes();
    assert(
      !(await col.indexes()).some((i) => i.expireAfterSeconds !== undefined),
      "financial records cannot have TTL deletion",
    );
    const a = await upi.createUpiPayment(user.id, "try");
    assert.equal(a.amount, 900);
    assert.equal(a.credits, 3);
    await assert.rejects(upi.submitUTR(a._id, admin.id, "123456789012"));
    await assert.rejects(upi.approvePayment(a._id, user.id));
    await assert.rejects(upi.approvePayment(a._id, admin.id));
    await upi.submitUTR(a._id, user.id, "123456789012");
    assert.equal(await balance(user.id), 21, "UTR alone grants nothing");
    await upi.submitUTR(a._id, user.id, "123456789012");
    await Promise.all(
      Array.from({ length: 6 }, () => upi.approvePayment(a._id, admin.id)),
    );
    assert.equal(
      await balance(user.id),
      24,
      "competing approval is exactly once",
    );
    const b = await upi.createUpiPayment(user.id, "try");
    await assert.rejects(upi.submitUTR(b._id, user.id, "123456789012"));
    await col.updateOne(
      { _id: b._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    assert.equal(
      (await upi.getPaymentStatus(b._id, user.id))?.status,
      "expired",
    );
    await upi.submitUTR(b._id, user.id, "123456789013"); // money may arrive near expiry
    await upi.rejectPayment(b._id, admin.id, "No corresponding bank receipt");
    await assert.rejects(upi.approvePayment(b._id, admin.id));
    assert.equal(await balance(user.id), 24);
    const c = await upi.createUpiPayment(user.id, "try");
    await assert.rejects(upi.submitUTR(c._id, user.id, "123456789013"));
    const d = await upi.createUpiPayment(user.id, "try");
    const race = await Promise.allSettled([
      upi.submitUTR(c._id, user.id, "123456789014"),
      upi.submitUTR(d._id, user.id, "123456789014"),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    const broken = await upi.createUpiPayment("missing-wallet", "try");
    await upi.submitUTR(broken._id, "missing-wallet", "123456789015");
    await assert.rejects(upi.approvePayment(broken._id, admin.id));
    assert.equal(
      (await col.findOne({ _id: broken._id }))?.status,
      "utr_submitted",
    );
    assert.equal(
      await (
        await collection("ledger")
      ).countDocuments({ _id: `upi_credit:${broken._id}` }),
      0,
    );
    await assert.rejects(upi.createUpiPayment(user.id, "try", "upi_gateway"));
    await assert.rejects(upi.createUpiPayment(user.id, "__proto__"));
    assert.equal(await upi.getPaymentStatus(a._id, admin.id), null);
    console.log(
      "PASS manual: TTL migration, ownership, untrusted UTR, replay, six concurrent approvals, duplicate UTR race, late submission, rejection, rollback",
    );
    await saveOrder("order_TestCapture", user.id, "try", 900, 3);
    const payment = {
      id: "pay_TestCapture",
      order_id: "order_TestCapture",
      amount: 900,
      currency: "INR",
      status: "captured",
    };
    await assert.rejects(capturePayment({ ...payment, amount: 1 }, user.id));
    await assert.rejects(
      capturePayment({ ...payment, status: "authorized" }, user.id),
    );
    await assert.rejects(capturePayment(payment, admin.id));
    await Promise.all(
      Array.from({ length: 4 }, () => capturePayment(payment, user.id)),
    );
    assert.equal(await balance(user.id), 27);
    console.log(
      "PASS gateway: amount/status/ownership and concurrent capture replay",
    );
    if (!process.argv.includes("--http")) return;
    const base = "http://localhost:3120";
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--port", "3120"],
      { env: process.env, stdio: "ignore", windowsHide: true },
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    async function login(email: string) {
      const r = await fetch(base + "/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          email,
          password: "test-password-12345",
          acceptTerms: true,
          termsVersion: "2026-09-24",
        }),
      });
      assert.equal(r.status, 200);
      return r.headers.get("set-cookie")!.split(";")[0];
    }
    const buyerCookie = await login("buyer@example.test"),
      adminCookie = await login("admin@example.test");
    async function req(path: string, cookie: string, body?: unknown) {
      return fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: { cookie, "content-type": "application/json", origin: base },
        body: body ? JSON.stringify(body) : undefined,
      });
    }
    assert.equal((await req("/api/upi/admin", buyerCookie)).status, 403);
    assert.equal((await fetch(base + "/api/upi/status?history=1")).status, 401);
    assert.equal(
      (await req("/api/upi/status?orderId=" + a._id, adminCookie)).status,
      404,
    );
    assert.equal(
      (await req("/api/upi/status?history=1&page=NaN", buyerCookie)).status,
      400,
    );
    assert.equal(
      (await req("/api/upi/gateway-webhook", buyerCookie, {})).status,
      410,
    );
    const created = await req("/api/upi/order", buyerCookie, {
      pack: "starter",
      amount: 1,
      credits: 999999,
    });
    assert.equal(created.status, 200);
    const j = await created.json();
    assert.equal(j.amount, 3900);
    assert.equal(j.credits, 15);
    assert(j.qrDataUrl.startsWith("data:image/png;base64,"));
    assert.equal(j.payeeName, "CHANDAN PANDEY");
    assert.equal(
      (
        await req("/api/upi/submit-utr", buyerCookie, {
          orderId: j.orderId,
          utr: "123456789016",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req("/api/upi/admin", adminCookie, {
          action: "approve",
          orderId: j.orderId,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("/api/upi/admin", adminCookie, {
          action: "approve",
          orderId: j.orderId,
          bankVerified: true,
        })
      ).status,
      200,
    );
    assert.equal(await balance(user.id), 42);
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: payment } },
    });
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(raw)
      .digest("hex");
    assert.equal(
      (
        await fetch(base + "/api/razorpay/webhook", {
          method: "POST",
          headers: { "x-razorpay-signature": "0".repeat(64) },
          body: raw,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/api/razorpay/webhook", {
          method: "POST",
          headers: { "x-razorpay-signature": signature },
          body: raw,
        })
      ).status,
      200,
    );
    assert.equal(await balance(user.id), 42);
    const forgedOrigin = await fetch(base + "/api/upi/admin", {
      method: "POST",
      headers: {
        cookie: adminCookie,
        origin: "https://evil.example",
        "content-type": "application/json",
        "x-syaahi-proxy": "test-proxy-secret",
      },
      body: JSON.stringify({
        action: "approve",
        orderId: j.orderId,
        bankVerified: true,
      }),
    });
    assert.equal(forgedOrigin.status, 403);
    console.log(
      "PASS HTTP: auth, ownership, admin confirmation, server prices, local QR, webhook forgery and replay",
    );
    browser = await chromium.launch();
    const context = await browser.newContext();
    const [name, value] = buyerCookie.split("=");
    await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    const page = await context.newPage();
    mkdirSync("output/qa", { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/pay");
      await page.getByRole("button", { name: "Pay ₹9", exact: true }).click();
      await page.getByRole("heading", { name: "Scan & Pay ₹9" }).waitFor();
      assert.equal(
        await page
          .locator('img[alt="UPI payment QR with order amount"]')
          .evaluate((el: any) => el.complete && el.naturalWidth > 0),
        true,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `overflow ${width}`,
      );
      await page.screenshot({
        path: `output/qa/payment-${width}.png`,
        fullPage: true,
      });
    }
    console.log(
      "PASS browser: checkout QR rendered at 390/768/1440 without horizontal overflow",
    );
    await page
      .getByRole("button", { name: "I've Paid → Enter UTR", exact: true })
      .click();
    await page.getByLabel("UTR / Reference Number").fill("123456789099");
    const submitted = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/upi/submit-utr") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Submit UTR", exact: true }).click();
    assert.equal((await submitted).status(), 200);
    await page.getByRole("heading", { name: "Verifying Payment..." }).waitFor();
    const awaiting = await col.findOne({ utr: "123456789099" });
    const staff = await browser.newContext();
    const [staffName, staffValue] = adminCookie.split("=");
    await staff.addCookies([
      { name: staffName, value: staffValue, domain: "localhost", path: "/" },
    ]);
    const adminPage = await staff.newPage();
    await adminPage.goto(base + "/admin/payments");
    adminPage.on("dialog", (d) => d.accept());
    const card = adminPage
      .locator(".admin-payment-card")
      .filter({ hasText: "123456789099" });
    await card.getByRole("button", { name: "✅ Approve", exact: true }).click();
    await page
      .getByRole("heading", { name: "Payment Confirmed!" })
      .waitFor({ timeout: 15000 });
    assert.equal(
      (await col.findOne({ _id: awaiting!._id }))?.status,
      "approved",
    );
    assert.equal(await balance(user.id), 45);
    await page.reload();
    await page.getByRole("button", { name: "Show Payment History" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "123456789099" })
      .getByText("✅ Approved")
      .waitFor();
    console.log(
      "PASS browser: buyer submits UTR, separate admin approves bank confirmation, buyer sees credited balance, history survives reload",
    );
    const signup = await fetch(base + "/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({
        mode: "signup",
        name: "Unverified",
        email: "unverified@example.test",
        password: "test-password-12345",
        acceptTerms: true,
        termsVersion: "2026-09-24",
      }),
    });
    const signupBody = await signup.json();
    assert.equal(signupBody.verifyUrl, "/verify-email");
    assert(
      !JSON.stringify(signupBody).match(/[a-f0-9]{64}/),
      "verification tokens must never be returned to the requester",
    );
    console.log("PASS signup: no inbox verification token disclosure");
  } finally {
    await browser?.close();
    server?.kill();
    const { mongo } = await import("../lib/storage/mongo");
    await (await mongo()).client.close();
    await replica.stop();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
