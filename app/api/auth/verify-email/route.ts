import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { confirmVerification, sendVerification } from "@/lib/auth/verification";
import { RewardError, rewardSummary } from "@/lib/billing/rewards";
import { rateLimit } from "@/lib/ratelimit";
export const POST = apiHandler(async (req: Request) => {
  const denied = await authError(req);
  if (denied) return denied;
  const b = await req.json().catch(() => ({})),
    user = (await currentUser(req))!;
  const limited = await rateLimit(
    req,
    b.token ? "verify-email" : "send-verification",
    b.token ? 10 : 3,
    b.token ? 60000 : 3600000,
  );
  if (limited) return limited;
  try {
    if (b.token) await confirmVerification(user.id, String(b.token));
    else if (!(await rewardSummary(user.id)).emailVerified)
      await sendVerification(user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (!(e instanceof RewardError)) throw e;
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
});
