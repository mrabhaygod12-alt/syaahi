import { NextResponse } from "next/server";
import { currentUser, type Account } from "@/lib/auth/server";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import { currentSubscription } from "@/lib/billing/subscriptions";

/** A free signup wallet is not a purchased entitlement. Never trust client plan labels. */
export async function inkEntitled(user: Account): Promise<boolean> {
  if (user.workspace === "writer") return false;
  const subscription = await currentSubscription(user.id);
  if (
    subscription &&
    subscription.currentEnd > Date.now() / 1000 &&
    !!subscription.lastPayment &&
    !["halted", "expired"].includes(subscription.status)
  ) return true;
  if (useMongo()) return !!(await (await collection("orders")).findOne({
    user: user.id, paid: true, amount: { $gt: 0 }, paymentId: { $type: "string", $ne: "" },
  }));
  return !!db().prepare(
    "SELECT id FROM orders WHERE user_id=? AND paid=1 AND amount>0 AND payment_id IS NOT NULL AND payment_id<>'' LIMIT 1",
  ).get(user.id);
}

export async function inkAccount(req: Request, requirePlan = true) {
  const user = await currentUser(req);
  if (!user) return { response: NextResponse.json({ error: "Please sign in to use AI Ink." }, { status: 401 }) };
  if (user.workspace === "writer") return { response: NextResponse.json({
    error: "AI Ink is in the student workspace. Switch to your student account to continue.", code: "STUDENT_WORKSPACE_REQUIRED",
  }, { status: 403 }) };
  if (requirePlan && !(await inkEntitled(user))) return { response: NextResponse.json({
    error: "AI Ink is included with a purchased student pack or an active paid student subscription.", code: "INK_PLAN_REQUIRED",
  }, { status: 402 }) };
  return { user };
}
