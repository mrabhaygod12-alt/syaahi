import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { paymentConfiguration } from "@/lib/billing/configuration";
import { subscriptionRequest } from "@/lib/billing/subscriptions";
import { resolveMonthlyPlan } from "@/lib/billing/monthly-catalog";
import {
  MONTHLY_PLANS,
  type MonthlyTier,
} from "@/lib/billing/subscription-plans";
/** Prepares the three public catalogue plans without starting a customer subscription. */
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "catalog-prepare", 2, 60000));
  if (denied) return denied;
  try {
    for (const tier of Object.keys(MONTHLY_PLANS) as MonthlyTier[])
      await resolveMonthlyPlan(tier, subscriptionRequest);
    return NextResponse.json({
      ready: true,
      mode: paymentConfiguration().mode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ready: false,
        error:
          error instanceof Error
            ? error.message
            : "Checkout preparation failed.",
      },
      { status: 503 },
    );
  }
});
