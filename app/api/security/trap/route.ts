import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { recordTrap } from "@/lib/security/abuse";
const trap = apiHandler(async (req: NextRequest) => {
  await recordTrap(req, "path-probe");
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
});
export const GET = trap;
export const POST = trap;
