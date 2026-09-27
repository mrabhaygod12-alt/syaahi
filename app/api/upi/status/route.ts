import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { getPaymentStatus, listUserPayments } from "@/lib/billing/upi";

/**
 * GET /api/upi/status?orderId=xxx     — single order status
 * GET /api/upi/status?history=1       — all user payments
 */
async function handleGET(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;

  const user = (await currentUser(req))!;
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");
  const history = url.searchParams.get("history");

  if (orderId) {
    const payment = await getPaymentStatus(orderId, user.id);
    if (!payment)
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 },
      );
    return NextResponse.json({
      orderId: payment._id,
      status: payment.status,
      amount: payment.amount,
      credits: payment.credits,
      pack: payment.pack,
      utr: payment.utr,
      method: payment.method,
      upiId: payment.upiId,
      rejectionReason: payment.rejectionReason,
      createdAt: payment.createdAt,
      expiresAt: payment.expiresAt,
    });
  }

  if (history) {
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    if (!Number.isSafeInteger(page) || page > 10000)
      return NextResponse.json({ error: "Invalid page." }, { status: 400 });
    const result = await listUserPayments(user.id, page, 20);
    return NextResponse.json({
      payments: result.payments.map((p) => ({
        orderId: p._id,
        status: p.status,
        amount: p.amount,
        credits: p.credits,
        pack: p.pack,
        utr: p.utr,
        method: p.method,
        createdAt: p.createdAt,
      })),
      total: result.total,
      page,
    });
  }

  return NextResponse.json(
    { error: "Provide orderId or history=1." },
    { status: 400 },
  );
}

export const GET = apiHandler(handleGET);
