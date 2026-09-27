import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import {
  capturePayment,
  razorpay,
  verifySignature,
} from "@/lib/billing/payments";
import { ownsOrder } from "@/lib/billing/orders";
import { rateLimit } from "@/lib/ratelimit";
async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "verify-payment", 20, 60000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const order = String(body.razorpay_order_id || ""),
    payment = String(body.razorpay_payment_id || "");
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!order || !payment || typeof body.razorpay_signature !== "string")
    return NextResponse.json(
      { error: "Order, payment and signature are required." },
      { status: 400 },
    );
  if (!secret)
    return NextResponse.json(
      {
        error:
          "Payment confirmation is temporarily unavailable. Please check payment status shortly.",
      },
      { status: 503 },
    );
  if (
    !/^order_[a-zA-Z0-9]+$/.test(order) ||
    !/^pay_[a-zA-Z0-9]+$/.test(payment) ||
    !verifySignature(
      `${order}|${payment}`,
      String(body.razorpay_signature || ""),
      secret,
    )
  )
    return NextResponse.json(
      { error: "Invalid payment signature." },
      { status: 400 },
    );
  if (!(await ownsOrder(order, (await currentUser(req))!.id)))
    return NextResponse.json({ error: "Unknown order." }, { status: 404 });
  try {
    const entity = await razorpay(`payments/${payment}`);
    if (
      !("order_id" in entity) ||
      entity.id !== payment ||
      entity.order_id !== order
    )
      throw new Error("Payment order mismatch.");
    return NextResponse.json({
      ok: true,
      balance: await capturePayment(entity, (await currentUser(req))!.id),
    });
  } catch (error) {
    console.error("Payment confirmation failed", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        error:
          "Payment has not been confirmed. Check payment status before paying again.",
      },
      { status: 409 },
    );
  }
}

export const POST = apiHandler(handlePOST);
