import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { confirmVerification, sendVerification } from "@/lib/auth/verification";
import { RewardError, rewardSummary } from "@/lib/billing/rewards";
import { rateLimit } from "@/lib/ratelimit";
export const POST = apiHandler(async (req: Request) => {
  const b = await req.json().catch(() => ({}));

  if (b.token) {
    const limited = await rateLimit(req, "verify-email", 15, 60000);
    if (limited) return limited;
    try {
      const userId = await confirmVerification(String(b.token));
      const { collection, useMongo } = await import("@/lib/storage/mongo");
      let userObj: any = null;
      if (useMongo()) {
        userObj = await (await collection("users")).findOne({ _id: userId });
      } else {
        const { db } = await import("@/lib/db");
        userObj = db()
          .prepare("SELECT * FROM users WHERE id=?")
          .get(userId);
      }
      if (userObj) {
        const { startSession } = await import("@/lib/auth/server");
        return await startSession(
          {
            id: userId,
            email: String(userObj.email),
            name: String(userObj.name),
            createdAt: String(userObj.createdAt || userObj.created_at),
          },
          req,
        );
      }
      return NextResponse.json({ ok: true, verified: true, userId });
    } catch (e) {
      if (e instanceof RewardError)
        return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
  }

  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const limited = await rateLimit(req, "send-verification", 5, 3600000);
  if (limited) return limited;
  try {
    if (!(await rewardSummary(user.id)).emailVerified)
      await sendVerification(user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof RewardError)
      return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
});
