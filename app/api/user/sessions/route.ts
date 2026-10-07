import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import {
  activeSessions,
  revokeSessions,
  sessionKey,
} from "@/lib/auth/session-security";
import { rateLimit } from "@/lib/ratelimit";
export const GET = apiHandler(async (req: Request) => {
  const u = await currentUser(req);
  return u
    ? NextResponse.json({
        sessions: await activeSessions(u.id, sessionKey(req)),
      })
    : NextResponse.json({ error: "Please sign in." }, { status: 401 });
});
export const POST = apiHandler(async (req: Request) => {
  const u = await currentUser(req);
  if (!u)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const limited = await rateLimit(req, "sessions-revoke", 10, 60000);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  if (
    !b ||
    !["revoke", "others"].includes(b.action) ||
    (b.action === "revoke" && !/^[a-f0-9]{64}$/.test(b.id || ""))
  )
    return NextResponse.json(
      { error: "Choose a session to revoke." },
      { status: 400 },
    );
  const count = await revokeSessions(
    u.id,
    b.action === "revoke" ? b.id : undefined,
    b.action === "others" ? sessionKey(req) : undefined,
  );
  const response = NextResponse.json({ count });
  if (b.action === "revoke" && b.id === sessionKey(req))
    response.cookies.set("syaahi-session", "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  return response;
});
