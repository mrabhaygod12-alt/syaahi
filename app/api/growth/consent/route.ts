import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import {
  setMeasurementConsent,
  forgetVisitor,
  validVisitor,
  visitorVariant,
} from "@/lib/growth/metrics";
import { rateLimit } from "@/lib/ratelimit";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied = await rateLimit(req, "measurement-consent", 20, 60000);
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  if (typeof b?.allowed !== "boolean")
    return NextResponse.json(
      { error: "Choose a measurement preference." },
      { status: 400 },
    );
  const user = await currentUser(req);
  if (user) await setMeasurementConsent(user.id, b.allowed);
  const old = req.cookies.get("syaahi-visitor")?.value || "";
  const visitor = validVisitor(old) ? old : randomUUID();
  if (!b.allowed) await forgetVisitor(old);
  const r = NextResponse.json({
    ok: true,
    variant: b.allowed ? visitorVariant(visitor) : "A",
  });
  const secure =
    process.env.NODE_ENV === "production" ||
    new URL(req.url).protocol === "https:";
  r.cookies.set("syaahi-measurement", b.allowed ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 90 * 86400,
  });
  r.cookies.set("syaahi-visitor", b.allowed ? visitor : "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: b.allowed ? 90 * 86400 : 0,
  });
  return r;
});
