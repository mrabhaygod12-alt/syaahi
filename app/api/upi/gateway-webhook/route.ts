import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { gatewayWebhookVerify } from "@/lib/billing/upi";

/**
 * POST /api/upi/gateway-webhook
 * Third-party UPI gateway calls this endpoint after payment is confirmed.
 *
 * Expected body:
 * {
 *   orderId: string,
 *   gatewayRef: string,   // gateway's transaction reference
 *   amount: number,       // in paisa
 *   signature: string     // HMAC-SHA256 of "orderId|gatewayRef|amount" with shared secret
 * }
 *
 * The shared secret is stored as UPI_GATEWAY_WEBHOOK_SECRET in env.
 */
async function handlePOST(req: NextRequest) {
  const secret = process.env.UPI_GATEWAY_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Gateway webhook not configured." },
      { status: 503 },
    );

  try {
    const body = await req.json();
    const { orderId, gatewayRef, amount, signature } = body;

    if (!orderId || !gatewayRef || !amount || !signature)
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 },
      );

    const payment = await gatewayWebhookVerify(
      String(orderId),
      String(gatewayRef),
      Number(amount),
      String(signature),
      secret,
    );

    return NextResponse.json({
      ok: true,
      status: payment.status,
      orderId: payment._id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook processing failed.",
      },
      { status: 400 },
    );
  }
}

export const POST = apiHandler(handlePOST);
