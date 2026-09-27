import { apiHandler } from "@/lib/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { collection, useMongo } from "@/lib/storage/mongo";
import { balance } from "@/lib/credits/store";
import { referralCode } from "@/lib/billing/referrals";

import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";

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
  const limited = await rateLimit(req, "profile-patch", 20, 60000);
  if (limited) return limited;

  const user = (await currentUser(req))!;
  const body = await req.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim().length > 0) {
    updates.name = body.name.trim().slice(0, 80);
  }

  if (typeof body.avatar === "string") {
    const raw = body.avatar.trim();
    if (raw === "") {
      updates.avatar = null;
    } else if (/^anime-(?:[1-9]|1[0-9]|20)$/.test(raw)) {
      updates.avatar = raw;
    } else if (
      /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw) &&
      raw.length <= 2 * 1024 * 1024
    ) {
      // Valid base64 raster image up to 2MB (SVG rejected to prevent XSS)
      updates.avatar = raw;
    } else if (
      raw.startsWith("https://") &&
      raw.length <= 500 &&
      !/[\s<>"']/.test(raw)
    ) {
      updates.avatar = raw;
    } else {
      return NextResponse.json(
        { error: "Invalid avatar format. Use an anime preset or PNG/JPEG/WEBP upload under 2MB." },
        { status: 400 },
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  if (useMongo()) {
    await (await collection("users")).updateOne({ _id: user.id }, { $set: updates });
  } else {
    // Local SQLite fallback
    try {
      try {
        db().exec("ALTER TABLE users ADD COLUMN avatar TEXT");
      } catch {
        /* column might already exist */
      }
      const nameVal = typeof updates.name === "string" ? updates.name : null;
      const avatarVal = typeof updates.avatar === "string" ? updates.avatar : null;
      if (nameVal && updates.avatar !== undefined) {
        db().prepare("UPDATE users SET name=?, avatar=? WHERE id=?").run(nameVal, avatarVal, user.id);
      } else if (nameVal) {
        db().prepare("UPDATE users SET name=? WHERE id=?").run(nameVal, user.id);
      } else if (updates.avatar !== undefined) {
        db().prepare("UPDATE users SET avatar=? WHERE id=?").run(avatarVal, user.id);
      }
    } catch {
      /* ignore local SQLite schema difference */
    }
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
