import { apiHandler } from "@/lib/api-handler";
import {
  currencyForCountry,
  isBillingCurrencyEnabled,
} from "@/lib/billing/currency";
import { NextRequest, NextResponse } from "next/server";
import { paymentConfiguration } from "@/lib/billing/configuration";

export const GET = apiHandler(async (req: NextRequest) => {
  const currency = currencyForCountry(req.headers.get("x-vercel-ip-country"));
  const payment = paymentConfiguration();
  return NextResponse.json({
    currency,
    paymentMode: payment.mode,
    checkoutEnabled: payment.configured && isBillingCurrencyEnabled(currency),
  });
});
