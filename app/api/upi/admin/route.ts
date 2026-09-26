import { PaymentError } from "@/lib/billing/upi";
import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import {
  isAdmin,
  listPendingPayments,
  approvePayment,
  rejectPayment,
  paymentStats,
  type PaymentStatus,
} from "@/lib/billing/upi";

/**
 * GET /api/upi/admin?action=list&status=utr_submitted&page=1
 * GET /api/upi/admin?action=stats
 * POST /api/upi/admin  { action: "approve"|"reject", orderId, reason? }
 */
async function handleGET(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;

  const user = (await currentUser(req))!;
  if (!(await isAdmin(user.id)))
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";

  if (action === "stats") {
    const stats = await paymentStats();
    return NextResponse.json(stats);
  }

  // Default: list payments
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const status = url.searchParams.get("status") as PaymentStatus | undefined;
  if (
    !Number.isSafeInteger(page) ||
    page > 10000 ||
    (status &&
      ![
        "pending",
        "utr_submitted",
        "verifying",
        "approved",
        "auto_verified",
        "rejected",
        "expired",
      ].includes(status))
  )
    return NextResponse.json(
      { error: "Invalid filter or page." },
      { status: 400 },
    );
  const result = await listPendingPayments(page, 20, status || undefined);

  return NextResponse.json({
    payments: result.payments.map((p) => ({
      orderId: p._id,
      user: p.user,
      userName: p.userName,
      userEmail: p.userEmail,
      status: p.status,
      amount: p.amount,
      amountInr: p.amount / 100,
      credits: p.credits,
      pack: p.pack,
      utr: p.utr,
      upiId: p.upiId,
      method: p.method,
      rejectionReason: p.rejectionReason,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    total: result.total,
    page,
  });
}

async function handlePOST(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;

  const user = (await currentUser(req))!;
  if (!(await isAdmin(user.id)))
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const orderId = String(body.orderId || "");

  if (!orderId)
    return NextResponse.json(
      { error: "Order ID is required." },
      { status: 400 },
    );

  try {
    if (action === "approve") {
      if (body.bankVerified !== true)
        return NextResponse.json(
          {
            error:
              "Confirm the UTR, exact amount and payee against the bank statement first.",
          },
          { status: 400 },
        );
      const payment = await approvePayment(orderId, user.id);
      return NextResponse.json({
        ok: true,
        status: payment.status,
        credits: payment.credits,
        message: `Payment approved. ${payment.credits} credits granted to user.`,
      });
    }

    if (action === "reject") {
      const reason = String(body.reason || "Payment could not be verified.");
      const payment = await rejectPayment(orderId, user.id, reason);
      return NextResponse.json({
        ok: true,
        status: payment.status,
        message: "Payment rejected.",
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "approve" or "reject".' },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof PaymentError ? error.message : "Action failed.",
      },
      { status: 400 },
    );
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
