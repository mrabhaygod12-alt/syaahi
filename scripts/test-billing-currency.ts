import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  currencyForCountry,
  enabledBillingCurrencies,
} from "../lib/billing/currency";
import { PACKS, formatMinorPrice, packAmountMinor } from "../lib/billing/packs";

async function main() {
  assert.equal(currencyForCountry("IN"), "INR");
  assert.equal(currencyForCountry("FR"), "EUR");
  assert.equal(currencyForCountry("GP"), "EUR");
  assert.equal(currencyForCountry("BG"), "EUR"); // Euro adopted 1 Jan 2026.
  assert.equal(currencyForCountry("US"), "USD");
  assert.equal(currencyForCountry("GB"), "USD");
  assert.equal(currencyForCountry(null), "INR");

  const { GET: getBillingRegion } =
    await import("../app/api/billing/region/route");
  const { NextRequest } = await import("next/server");
  process.env.RAZORPAY_SUPPORTED_CURRENCIES = "";
  const usdRegionResponse = await getBillingRegion(
    new NextRequest("https://www.syaahii.in/api/billing/region", {
      headers: { "x-vercel-ip-country": "US" },
    }),
  );
  const usdRegion = await usdRegionResponse.json();
  assert.equal(usdRegion.currency, "USD");
  assert.equal(usdRegion.checkoutEnabled, false);
  process.env.RAZORPAY_SUPPORTED_CURRENCIES = "INR,USD,EUR";
  const eurRegionResponse = await getBillingRegion(
    new NextRequest("https://www.syaahii.in/api/billing/region", {
      headers: { "x-vercel-ip-country": "FR" },
    }),
  );
  const eurRegion = await eurRegionResponse.json();
  assert.equal(eurRegion.currency, "EUR");
  assert.equal(eurRegion.checkoutEnabled, true);

  assert.deepEqual([...enabledBillingCurrencies("")], ["INR"]);
  assert.deepEqual(
    [...enabledBillingCurrencies("USD, EUR,invalid")],
    ["INR", "USD", "EUR"],
  );

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(PACKS).map(([id, pack]) => [
        id,
        [pack.inr, pack.usd, pack.eur],
      ]),
    ),
    {
      try: [9, 5, 5],
      starter: [39, 22, 22],
      popular: [79, 44, 44],
      pro: [179, 99, 99],
    },
  );
  assert.equal(packAmountMinor("try", "INR"), 900);
  assert.equal(packAmountMinor("try", "USD"), 500);
  assert.equal(packAmountMinor("try", "EUR"), 500);
  assert.equal(formatMinorPrice(500, "USD"), "$5");
  assert.throws(() => packAmountMinor("unknown", "USD"));

  // Open an old SQLite layout to verify the upgrade preserves existing orders.
  process.env.DATA_DIR = mkdtempSync(
    join(tmpdir(), "syaahi-currency-migration-"),
  );
  process.env.DATA_BACKEND = "sqlite";
  process.env.APP_ROLE = "all";
  process.env.MONGODB_URI = "";
  const previousDb = new DatabaseSync(
    join(process.env.DATA_DIR, "syaahi.sqlite"),
  );
  previousDb.exec(`
  CREATE TABLE orders (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pack TEXT NOT NULL,
    amount INTEGER NOT NULL, credits INTEGER NOT NULL,
    payment_id TEXT UNIQUE, paid INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO orders (id,user_id,pack,amount,credits)
  VALUES ('order_legacy','legacy-user','try',900,3);
`);
  previousDb.close();
  const { db } = await import("../lib/db");
  const upgraded = db();
  const { saveOrder, userOrders } = await import("../lib/billing/orders");
  assert.equal(
    (await userOrders("legacy-user", "order_legacy"))[0].currency,
    "INR",
  );
  upgraded
    .prepare("INSERT INTO wallets (user_id,balance) VALUES (?,?)")
    .run("currency-user", 19);
  await saveOrder("order_local_usd", "currency-user", "try", 500, 3, "USD");
  const { capturePayment } = await import("../lib/billing/payments");
  await assert.rejects(
    capturePayment(
      {
        id: "pay_local_wrong_currency",
        order_id: "order_local_usd",
        amount: 500,
        currency: "INR",
        status: "captured",
      },
      "currency-user",
    ),
  );
  assert.equal(
    await capturePayment(
      {
        id: "pay_local_usd",
        order_id: "order_local_usd",
        amount: 500,
        currency: "USD",
        status: "captured",
      },
      "currency-user",
    ),
    22,
  );
  assert.equal(
    (await userOrders("currency-user", "order_local_usd"))[0].currency,
    "USD",
  );
  upgraded.close();

  console.log(
    "PASS billing currency: country mapping, activation gate, fixed regional price ladders, SQLite migration, capture currency validation and display formatting.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
