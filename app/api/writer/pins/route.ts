import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser, authError } from "@/lib/auth/server";
import { writerAccess } from "@/lib/writing/profile";
import { rateLimit } from "@/lib/ratelimit";
import { changePin, pinWorkspace, WriterPinError } from "@/lib/writing/pins";
export const dynamic = "force-dynamic";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const user = (await currentUser(req))!;
  return (
    (await writerAccess(user.id)) ||
    NextResponse.json(await pinWorkspace(user.id))
  );
});
export const PATCH = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "writer-pins", 20, 60000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  const access = await writerAccess(user.id);
  if (access) return access;
  try {
    await changePin(user.id, await req.json().catch(() => null));
    return NextResponse.json(await pinWorkspace(user.id));
  } catch (e) {
    if (e instanceof WriterPinError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
});
