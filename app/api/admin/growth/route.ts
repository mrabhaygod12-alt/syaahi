import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";
import { metricsReport } from "@/lib/growth/metrics";
import { rateLimit } from "@/lib/ratelimit";
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await currentUser(req);
  if (!user || !(await isAdmin(user)))
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  const limited = await rateLimit(req, "admin-growth-report", 30, 60000);
  if (limited) return limited;
  return NextResponse.json(await metricsReport());
});
