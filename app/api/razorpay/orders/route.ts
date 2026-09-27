import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { userOrders } from "@/lib/billing/orders";
import { rateLimit } from "@/lib/ratelimit";

export const GET = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "payment-status", 40, 60000));
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("order") || undefined;
  if (id && !/^order_[a-zA-Z0-9]+$/.test(id))
    return NextResponse.json(
      { error: "Invalid order reference." },
      { status: 400 },
    );
  const orders = await userOrders((await currentUser(req))!.id, id);
  if (id && !orders.length)
    return NextResponse.json(
      { error: "Order not found for this account." },
      { status: 404 },
    );
  return NextResponse.json({ orders });
});
