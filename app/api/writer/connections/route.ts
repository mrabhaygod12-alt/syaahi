import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { writerAccess } from "@/lib/writing/profile";
import { writerConnections, ConnectionError } from "@/lib/writing/connections";
export const GET = apiHandler(async (req: NextRequest) => {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id;
  const missing = await writerAccess(owner);
  if (missing) return missing;
  try {
    return NextResponse.json(
      await writerConnections(
        owner,
        req.nextUrl.searchParams.get("mode") || "following",
        req.nextUrl.searchParams.get("cursor") || "",
        owner,
      ),
    );
  } catch (e) {
    if (!(e instanceof ConnectionError)) throw e;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
});
