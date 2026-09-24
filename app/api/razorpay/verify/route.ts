import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import {
  capturePayment,
  razorpay,
  verifySignature,
} from "@/lib/billing/payments";
import { ownsOrder } from "@/lib/billing/orders";
async function handlePOST(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const order = String(body.razorpay_order_id || ""),
    payment = String(body.razorpay_payment_id || "");
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (
    !secret ||
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
    return NextResponse.json({
      ok: true,
      balance: await capturePayment(entity, (await currentUser(req))!.id),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Payment verification failed.",
      },
      { status: 409 },
    );
  }
}

export const POST = apiHandler(handlePOST);
