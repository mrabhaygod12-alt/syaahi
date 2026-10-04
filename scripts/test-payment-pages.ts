/** Browser test for the monthly subscription interface; it never sends a payment. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

async function main() {
  const base = "http://localhost:3130";
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3130"],
    {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        APP_ROLE: "all",
        BACKEND_URL: "",
        NEXT_PUBLIC_APP_URL: base,
      },
    },
  );
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        if ((await fetch(`${base}/pricing`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(ready, "Production server must start");
    for (const country of ["IN", "US", "FR"]) {
      const pricing = await fetch(`${base}/pricing`, {
        headers: { "x-vercel-ip-country": country },
      });
      assert.equal(pricing.status, 200);
    }

    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    let created = 0;
    await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "window.Razorpay = class { constructor(options) { this.options=options; window.testCheckout=this; } on(name, fn) { this[name]=fn; } open() {} };",
      }),
    );
    await page.route("**/api/billing/subscription**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/verify")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            credited: false,
            subscription: { id: "sub_BrowserTest" },
          }),
        });
        return;
      }
      const payload = route.request().postDataJSON();
      assert.equal(payload.tier, "starter");
      assert.equal(payload.acceptRecurring, true);
      created++;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          keyId: "rzp_test_browser",
          subscription: { id: "sub_BrowserTest", tier: "starter" },
        }),
      });
    });

    await page.goto(`${base}/pricing`);
    for (const tier of ["Free", "Starter", "Pro", "Max", "Team"])
      assert(
        await page
          .getByRole("heading", { name: tier, exact: true })
          .isVisible(),
      );
    for (const price of ["₹39/month", "₹179/month", "₹399/month"])
      assert(await page.getByText(price, { exact: true }).isVisible());
    assert.equal(
      await page.getByText("$5", { exact: true }).count(),
      0,
      "obsolete regional checkout prices must not be shown",
    );
    await page
      .getByRole("link", { name: "Choose Starter", exact: true })
      .click();
    await page.waitForURL("**/subscribe/starter");
    const continueButton = page.getByRole("button", {
      name: "Continue to Razorpay",
      exact: true,
    });
    assert(
      await continueButton.isDisabled(),
      "consent is required before a mandate checkout",
    );
    await page.getByRole("checkbox").check();
    await continueButton.click();
    await page.waitForFunction(() => Boolean((window as any).testCheckout));
    await page.evaluate(() =>
      (window as any).testCheckout.options.modal.ondismiss(),
    );
    await page.getByText("Checkout closed.", { exact: false }).waitFor();
    await continueButton.click();
    assert.equal(
      created,
      2,
      "a dismissed mandate creates a visible fresh checkout attempt",
    );
    await page.evaluate(() =>
      (window as any).testCheckout.options.handler({
        razorpay_subscription_id: "sub_BrowserTest",
        razorpay_payment_id: "pay_BrowserTest",
        razorpay_signature: "test",
      }),
    );
    await page.getByText("Mandate authorised.", { exact: false }).waitFor();
    mkdirSync("output/qa/payments", { recursive: true });
    await page.screenshot({
      path: "output/qa/payments/subscription-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "subscription page should fit mobile width",
    );
    console.log(
      "PASS browser payment flow: INR monthly plans, consent-gated Razorpay mandate checkout, dismiss, verification message and mobile layout.",
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
