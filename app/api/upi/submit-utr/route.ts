import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { submitUTR } from "@/lib/billing/upi";

/**
 * POST /api/upi/submit-utr
 * User submits their UTR after paying via UPI.
 */
async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "upi-utr", 10, 60000));
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || "");
  const utr = String(body.utr || "");

  if (!orderId)
    return NextResponse.json(
      { error: "Order ID is required." },
      { status: 400 },
    );
  if (!utr)
    return NextResponse.json(
      { error: "UTR number is required." },
      { status: 400 },
    );

  const user = (await currentUser(req))!;

  try {
    const payment = await submitUTR(orderId, user.id, utr);
    return NextResponse.json({
      ok: true,
      status: payment.status,
      message:
        "UTR submitted successfully. Your payment will be verified within a few minutes.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not submit UTR.",
      },
      { status: 400 },
    );
  }
}

export const POST = apiHandler(handlePOST);
