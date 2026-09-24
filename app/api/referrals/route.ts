import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import {
  claimReferral,
  referralCode,
  referralStats,
} from "@/lib/billing/referrals";
import { rateLimit } from "@/lib/ratelimit";
import {
  rewardSummary,
  transferRewards,
  RewardError,
  qualifyReferral,
} from "@/lib/billing/rewards";
async function handleGET(req: Request) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!.id;
  return NextResponse.json(
    {
      code: await referralCode(user),
      ...(await referralStats(user)),
      ...(await rewardSummary(user)),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function handlePOST(req: Request) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "referral", 10, 60000));
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "recheck") {
      await qualifyReferral((await currentUser(req))!.id);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "transfer") {
      await transferRewards(
        (await currentUser(req))!.id,
        Number(b.credits),
        String(b.requestId || ""),
      );
      return NextResponse.json({ ok: true });
    }
    await claimReferral(
      (await currentUser(req))!.id,
      String(b.code || "").trim(),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (!(e instanceof RewardError)) throw e;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Referral unavailable." },
      { status: 400 },
    );
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
