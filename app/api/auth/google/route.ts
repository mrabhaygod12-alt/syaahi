import { apiHandler } from "@/lib/api-handler";
import { hasConsent, TERMS_VERSION } from "@/lib/auth/consent";
import { originError } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { oauthClient, safeNext } from "@/lib/auth/oauth";
import { rateLimit } from "@/lib/ratelimit";
async function handlePOST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const denied = originError(req);
  if (denied) return denied;
  if (!hasConsent(body))
    return NextResponse.json(
      { error: "Agree to the Terms before Google sign-in." },
      { status: 400 },
    );
  const limited = await rateLimit(req, "oauth", 10, 60000);
  if (limited) return limited;
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  try {
    const client = oauthClient(req, response);
    response.cookies.set(
      "syaahi-oauth-next",
      safeNext(typeof body.next === "string" ? body.next : null),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: origin.startsWith("https:"),
        maxAge: 600,
        path: "/",
      },
    );
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/api/auth/callback` },
    });
    if (error || !data.url)
      throw new Error("Google sign-in could not be started.");
    response.cookies.set("syaahi-oauth-consent", TERMS_VERSION, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https:"),
      path: "/",
      maxAge: 600,
    });
    const result = NextResponse.json({ url: data.url });
    for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
    return result;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Google sign-in unavailable." },
      { status: 503 },
    );
  }
}

export const POST = apiHandler(handlePOST);
