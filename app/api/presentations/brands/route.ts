import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { brandKits, saveBrand } from "@/lib/presentations/operations";
import { rateLimit } from "@/lib/ratelimit";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json({
    kits: await brandKits((await currentUser(req))!.id),
  });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "brand-kits", 12, 60000));
  if (denied) return denied;
  try {
    return NextResponse.json({
      kits: await saveBrand((await currentUser(req))!.id, await req.json()),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save." },
      { status: 409 },
    );
  }
});
