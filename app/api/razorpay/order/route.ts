import { isAdmin } from "@/lib/billing/upi";
import { randomUUID } from "node:crypto";
import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { PACKS, packAmountMinor } from "@/lib/billing/packs";
import { razorpay } from "@/lib/billing/payments";
import { saveOrder } from "@/lib/billing/orders";
import { paymentConfiguration } from "@/lib/billing/configuration";
import { rateLimit } from "@/lib/ratelimit";
import {
  currencyForCountry,
  isBillingCurrencyEnabled,
} from "@/lib/billing/currency";
async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "orders", 5, 60000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const pack = String(body.pack || "");
  if (!Object.hasOwn(PACKS, pack))
    return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
  const p = PACKS[pack],
    user = (await currentUser(req))!;
  const currency = currencyForCountry(req.headers.get("x-vercel-ip-country"));
  if (!isBillingCurrencyEnabled(currency))
    return NextResponse.json(
      {
        error: `Razorpay ${currency} checkout is not enabled for this account yet. Please try again after international payments are activated.`,
        currency,
      },
      { status: 409 },
    );
  const amount = packAmountMinor(pack, currency);
  const payment = paymentConfiguration();
  if (!payment.configured)
    return NextResponse.json(
      {
        error: "Payments are temporarily unavailable. Please try again later.",
      },
      { status: 503 },
    );
  const testMode = payment.mode === "test";
  if (
    testMode &&
    process.env.NODE_ENV === "production" &&
    !(await isAdmin(user.id))
  )
    return NextResponse.json(
      {
        error:
          "Checkout is in test mode and is available to payment administrators only.",
      },
      { status: 403 },
    );
  try {
    const order = await razorpay("orders", {
      amount,
      currency,
      receipt: `sy_${randomUUID().replace(/-/g, "")}`,
      notes: { userId: user.id, pack },
    });
    if (
      !/^order_[a-zA-Z0-9]+$/.test(order.id) ||
      Number(order.amount) !== amount ||
      order.currency !== currency
    )
      throw new Error("Invalid order response from provider.");
    await saveOrder(order.id, user.id, pack, amount, p.credits, currency);
    return NextResponse.json({
      orderId: order.id,
      testMode,
      keyId: process.env.RAZORPAY_KEY_ID?.trim(),
      amount,
      currency,
      pack,
      credits: p.credits,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Payments unavailable.",
      },
      { status: 500 },
    );
  }
}

export const POST = apiHandler(handlePOST);
