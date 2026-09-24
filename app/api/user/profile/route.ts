import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { collection, useMongo } from "@/lib/storage/mongo";
import { balance } from "@/lib/credits/store";
import { referralCode } from "@/lib/billing/referrals";

export const dynamic = "force-dynamic";

async function handleGET(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;

  let credits = 0;
  try {
    credits = await balance(user.id);
  } catch {
    /* fallback to 0 */
  }

  let refCode: string | null = null;
  try {
    refCode = await referralCode(user.id);
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    user: {
      ...user,
      balance: credits,
      tokens: Math.floor(credits / 3),
      referralCode: refCode,
    },
  });
}

async function handlePATCH(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const body = await req.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim().length > 0) {
    updates.name = body.name.trim().slice(0, 80);
  }

  if (typeof body.avatar === "string") {
    // Allows either anime-X id or data URL up to 2MB
    if (body.avatar.startsWith("anime-") || body.avatar.startsWith("data:image/") || body.avatar.startsWith("https://")) {
      updates.avatar = body.avatar.slice(0, 2 * 1024 * 1024);
    } else if (body.avatar === "") {
      updates.avatar = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  if (useMongo()) {
    await (await collection("users")).updateOne({ _id: user.id }, { $set: updates });
  }

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      ...updates,
    },
  });
}

export const GET = apiHandler(handleGET);
export const PATCH = apiHandler(handlePATCH);
