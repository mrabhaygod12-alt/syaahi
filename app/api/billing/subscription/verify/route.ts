import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  currentSubscription,
  publicSubscription,
  settleSubscription,
} from "@/lib/billing/subscriptions";
import { verifySignature } from "@/lib/billing/payments";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "subscription-verify", 8, 60000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({})),
    stored = await currentSubscription((await currentUser(req))!.id);
  if (
    !stored ||
    !process.env.RAZORPAY_KEY_SECRET ||
    body.razorpay_subscription_id !== stored.id ||
    !/^pay_[A-Za-z0-9]+$/.test(body.razorpay_payment_id || "") ||
    !verifySignature(
      `${body.razorpay_payment_id}|${stored.id}`,
      body.razorpay_signature || "",
      process.env.RAZORPAY_KEY_SECRET || "",
    )
  )
    return NextResponse.json(
      { error: "Subscription payment signature is invalid." },
      { status: 400 },
    );
  try {
    const result = await settleSubscription(
      stored.id,
      body.razorpay_payment_id,
    );
    return NextResponse.json({
      credited: result.credited,
      subscription: publicSubscription(result.subscription),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "Payment received, but reconciliation is pending. Check billing or contact support before paying again.",
      },
      { status: 503 },
    );
  }
});
