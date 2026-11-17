import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { adminScopes } from "@/lib/auth/admin";
import { recentIncidents } from "@/lib/security/abuse";
import { rateLimit } from "@/lib/ratelimit";
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await currentUser(req);
  if (!adminScopes(user).users)
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  const limited = await rateLimit(req, "admin-security-read", 30, 60000);
  if (limited) return limited;
  return NextResponse.json({ incidents: await recentIncidents() });
});
