import { isAdmin } from "@/lib/billing/upi";
import { randomUUID } from "node:crypto";
import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { PACKS } from "@/lib/billing/packs";
import { razorpay } from "@/lib/billing/payments";
import { saveOrder } from "@/lib/billing/orders";
import { rateLimit } from "@/lib/ratelimit";
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
  const testMode = (process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_");
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
  if (!Number.isSafeInteger(p.inr * 100) || p.inr * 100 < 100)
    return NextResponse.json(
      { error: "Minimum payment is 100 paise." },
      { status: 400 },
    );
  try {
    const order = await razorpay("orders", {
      amount: p.inr * 100,
      currency: "INR",
      receipt: `sy_${randomUUID().replace(/-/g, "")}`,
      notes: { userId: user.id, pack },
    });
    if (
      !/^order_[a-zA-Z0-9]+$/.test(order.id) ||
      Number(order.amount) !== p.inr * 100 ||
      order.currency !== "INR"
    )
      throw new Error("Invalid order response from provider.");
    await saveOrder(order.id, user.id, pack, p.inr * 100, p.credits);
    return NextResponse.json({
      orderId: order.id,
      testMode,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: p.inr * 100,
      currency: "INR",
      pack,
      ...p,
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
