import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import {
  writerAccess,
  writerProfile,
  updateWriterProfile,
} from "@/lib/writing/profile";
import { rateLimit } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  return (
    (await writerAccess(user.id)) ||
    NextResponse.json({ profile: await writerProfile(user.id) })
  );
});
export const PATCH = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "writer-profile", 20, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const access = await writerAccess(user.id);
  if (access) return access;
  try {
    return NextResponse.json({
      profile: await updateWriterProfile(user.id, await req.json()),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to save profile." },
      { status: 400 },
    );
  }
});
