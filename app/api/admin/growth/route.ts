import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";
import { metricsReport } from "@/lib/growth/metrics";
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await currentUser(req);
  if (!user || !(await isAdmin(user)))
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  return NextResponse.json(await metricsReport());
});
