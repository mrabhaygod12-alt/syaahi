import { apiHandler } from "@/lib/api-handler";
import {
  currencyForCountry,
  isBillingCurrencyEnabled,
} from "@/lib/billing/currency";
import { NextRequest, NextResponse } from "next/server";

export const GET = apiHandler(async (req: NextRequest) => {
  const currency = currencyForCountry(req.headers.get("x-vercel-ip-country"));
  return NextResponse.json({
    currency,
    checkoutEnabled: isBillingCurrencyEnabled(currency),
  });
});
