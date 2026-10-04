import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { monthlyTier } from "@/lib/billing/subscription-plans";
import {
  currentSubscription,
  createSubscription,
  cancelSubscription,
  publicSubscription,
  subscriptionReady,
  refreshBilling,
} from "@/lib/billing/subscriptions";
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await currentUser(req);
  let subscription = user ? await currentSubscription(user.id) : null;
  if (user && req.nextUrl.searchParams.get("refresh") === "1") {
    const denied = await rateLimit(req, "subscription-refresh", 4, 60000);
    if (denied) return denied;
    try {
      subscription = await refreshBilling(user.id);
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not refresh provider status. Your saved subscription is unchanged.",
          subscription: publicSubscription(subscription),
        },
        { status: 503 },
      );
    }
  }
  return NextResponse.json({
    subscription: publicSubscription(subscription),
    authenticated: !!user,
    available: {
      starter: subscriptionReady("starter"),
      pro: subscriptionReady("pro"),
      max: subscriptionReady("max"),
    },
    currency: "INR",
  });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "subscription-create", 3, 60000));
  if (denied) return denied;
  const body = await req.json().catch(() => ({})),
    tier = monthlyTier(body.tier);
  if (!tier || body.acceptRecurring !== true)
    return NextResponse.json(
      { error: "Choose a plan and accept monthly recurring charges." },
      { status: 400 },
    );
  try {
    const subscription = await createSubscription(
      (await currentUser(req))!.id,
      tier,
    );
    return NextResponse.json({
      subscription: publicSubscription(subscription),
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed." },
      { status: 409 },
    );
  }
});
export const DELETE = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "subscription-cancel", 3, 60000));
  if (denied) return denied;
  try {
    return NextResponse.json({
      subscription: publicSubscription(
        await cancelSubscription((await currentUser(req))!.id),
      ),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cancellation failed." },
      { status: 400 },
    );
  }
});
