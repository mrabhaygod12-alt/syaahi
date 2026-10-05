import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { rateLimit } from "@/lib/ratelimit";
import { accountByEmail } from "@/lib/auth/server";
import {
  recoveryConfigured,
  sendReset,
  resetPassword,
} from "@/lib/auth/recovery";
export const POST = apiHandler(async (req: Request) => {
  const denied = await rateLimit(req, "password-recovery", 5, 15 * 60000);
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  if (b.action === "reset") {
    try {
      await resetPassword(String(b.token || ""), b.password);
      const response = NextResponse.json({ ok: true });
      response.cookies.set("syaahi-session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not reset password." },
        { status: 400 },
      );
    }
  }
  if (!recoveryConfigured())
    return NextResponse.json(
      {
        error:
          "Reset email delivery is unavailable. Continue with Google or contact support.",
      },
      { status: 503 },
    );
  const email = String(b.email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  const user = await accountByEmail(email);
  if (user)
    await sendReset({
      id: String(user.id),
      email: String(user.email),
      password: String(user.password),
    }).catch(() => false);
  return NextResponse.json(
    {
      ok: true,
      message:
        "If this account exists, a reset link will arrive by email. Check spam, or retry later if delivery is delayed.",
    },
    { status: 202 },
  );
});
