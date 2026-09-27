import QRCode from "qrcode";
import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { PACKS, tokenLabel } from "@/lib/billing/packs";
import {
  createUpiPayment,
  merchant,
  PaymentError,
  upiDeepLink,
  type PaymentMethod,
} from "@/lib/billing/upi";

/**
 * POST /api/upi/order
 * Create a new UPI payment order with QR code data.
 */
async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "upi-order", 10, 60000));
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const pack = String(body.pack || "");
  if (body.method && body.method !== "upi_qr")
    return NextResponse.json(
      { error: "Use /pricing for automatic Razorpay checkout." },
      { status: 400 },
    );
  const method: PaymentMethod =
    body.method === "upi_gateway" ? "upi_gateway" : "upi_qr";

  if (!Object.hasOwn(PACKS, pack))
    return NextResponse.json({ error: "Unknown pack." }, { status: 400 });

  const qrProvider = String(body.qrProvider || "phonepe");
  try {
    merchant(qrProvider);
  } catch {
    return NextResponse.json(
      { error: "Unknown receiving QR." },
      { status: 400 },
    );
  }
  const user = (await currentUser(req))!;
  const p = PACKS[pack];

  try {
    const payment = await createUpiPayment(
      user.id,
      pack,
      method,
      {
        name: user.name,
        email: user.email,
      },
      qrProvider,
    );

    const deepLink = upiDeepLink(
      payment._id,
      payment.amount,
      payment.payeeName!,
      payment.upiId,
    );

    return NextResponse.json({
      orderId: payment._id,
      upiId: payment.upiId,
      amount: payment.amount,
      amountInr: p.inr,
      currency: "INR",
      pack,
      credits: p.credits,
      tokenLabel: tokenLabel(p.credits),
      deepLink,
      payeeName: payment.payeeName!,
      qrProvider: payment.qrProvider,
      qrImage: merchant(qrProvider).image,
      qrDataUrl: await QRCode.toDataURL(deepLink, {
        width: 320,
        margin: 3,
        errorCorrectionLevel: "M",
      }),
      expiresAt: payment.expiresAt.toISOString(),
      status: payment.status,
      method: payment.method,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PaymentError
            ? error.message
            : "Payment temporarily unavailable. Please retry later.",
      },
      { status: 503 },
    );
  }
}

export const POST = apiHandler(handlePOST);
