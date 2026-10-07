import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { adminScopes, adminEligibility } from "@/lib/auth/admin";

export const GET = apiHandler(async (req: Request) => {
  const user = await currentUser(req);
  if (!user)
    return NextResponse.json(
      { error: "Please sign in to continue." },
      { status: 401 },
    );
  const scopes = adminScopes(user);
  const eligible = Object.values(adminEligibility(user)).some(Boolean);
  if (!eligible)
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  return NextResponse.json({
    scopes,
    eligible,
    eligibility: adminEligibility(user),
    requiresMfa: !Object.values(scopes).some(Boolean),
    enrolled: !!user.adminMfaEnrolled,
  });
});
