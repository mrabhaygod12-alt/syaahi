import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { PUBLIC_EVENTS, recordMetric } from "@/lib/growth/metrics";
import { rateLimit } from "@/lib/ratelimit";
export const POST = apiHandler(async (req: NextRequest) => {
  if (req.cookies.get("syaahi-measurement")?.value !== "1")
    return new NextResponse(null, { status: 204 });
  const denied = await rateLimit(req, "growth-events", 60, 60000);
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  if (
    !b ||
    !PUBLIC_EVENTS.includes(b.event) ||
    typeof b.id !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(b.id) ||
    Object.keys(b).some((k) => !["event", "id"].includes(k))
  )
    return NextResponse.json(
      { error: "Unsupported measurement event." },
      { status: 400 },
    );
  const user = await currentUser(req);
  await recordMetric(
    req.cookies.get("syaahi-visitor")?.value || "",
    b.event,
    b.id,
    user?.id,
  );
  return new NextResponse(null, { status: 204 });
});
