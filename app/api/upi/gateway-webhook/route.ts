import { NextResponse } from "next/server";
// The generic HMAC contract was never connected to a real payment provider.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Endpoint retired. Configure payment.captured at /api/razorpay/webhook.",
    },
    { status: 410 },
  );
}
