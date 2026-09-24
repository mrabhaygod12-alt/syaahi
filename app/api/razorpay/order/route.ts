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
  try {
    const order = await razorpay("orders", {
      amount: p.inr * 100,
      currency: "INR",
      receipt: `syaahi_${Date.now()}`,
      notes: { userId: user.id, pack },
    });
    await saveOrder(order.id, user.id, pack, p.inr * 100, p.credits);
    return NextResponse.json({
      orderId: order.id,
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
      { status: 503 },
    );
  }
}

export const POST = apiHandler(handlePOST);
