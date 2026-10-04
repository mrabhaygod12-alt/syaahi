import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { capturePayment, verifySignature } from "@/lib/billing/payments";
import {
  settleSubscription,
  syncSubscription,
} from "@/lib/billing/subscriptions";
async function handlePOST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret)
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 503 },
    );
  const raw = await req.text();
  if (
    !verifySignature(raw, req.headers.get("x-razorpay-signature") || "", secret)
  )
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  try {
    const event = JSON.parse(raw);
    if (
      typeof event.event === "string" &&
      event.event.startsWith("subscription.")
    ) {
      const subscription = event.payload?.subscription?.entity;
      if (!/^sub_[A-Za-z0-9]+$/.test(subscription?.id || ""))
        throw new Error("Missing subscription.");
      if (event.event === "subscription.charged") {
        const payment = event.payload?.payment?.entity;
        if (!/^pay_[A-Za-z0-9]+$/.test(payment?.id || ""))
          throw new Error("Missing payment.");
        await settleSubscription(subscription.id, payment.id);
      } else await syncSubscription(subscription.id);
      return NextResponse.json({ ok: true });
    }
    if (event.event !== "payment.captured")
      return NextResponse.json({ ok: true, ignored: true });
    const payment = event.payload?.payment?.entity;
    if (payment?.invoice_id)
      return NextResponse.json({ ok: true, ignored: true });
    if (
      !payment ||
      typeof payment.id !== "string" ||
      typeof payment.order_id !== "string"
    )
      throw new Error("Missing payment.");
    return NextResponse.json({
      ok: true,
      balance: await capturePayment(payment),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook." },
      { status: 400 },
    );
  }
}

export const POST = apiHandler(handlePOST);
