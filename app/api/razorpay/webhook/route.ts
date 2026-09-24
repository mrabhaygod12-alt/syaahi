import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { capturePayment, verifySignature } from "@/lib/billing/payments";
async function handlePOST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
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
    if (event.event !== "payment.captured")
      return NextResponse.json({ ok: true, ignored: true });
    const payment = event.payload?.payment?.entity;
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
