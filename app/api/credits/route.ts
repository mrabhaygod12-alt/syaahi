import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { balance } from "@/lib/credits/store";
import { applyAssignmentLaunchGift } from "@/lib/assignments/launch-gift";
export const dynamic = "force-dynamic";
async function handleGET(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!.id;
  const gift = await applyAssignmentLaunchGift(user);
  const units = gift.balance ?? (await balance(user));
  return NextResponse.json(
    {
      user,
      balance: units,
      assignmentGiftApplied: gift.granted,
      pageUnits: units,
      tokens: units / 3,
      pagesPerToken: 3,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function handlePOST(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json(
    {
      error:
        "Credits are reserved by generation and granted only by verified payments.",
    },
    { status: 403 },
  );
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
