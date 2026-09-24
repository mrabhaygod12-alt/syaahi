import { apiHandler } from "@/lib/api-handler";
import { TERMS_VERSION, recordConsent } from "@/lib/auth/consent";
import { NextRequest, NextResponse } from "next/server";
import { oauthClient, googleAccount, safeNext } from "@/lib/auth/oauth";
import { startSession } from "@/lib/auth/server";
async function handleGET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  response.headers.set("Cache-Control", "no-store");
  try {
    if (req.cookies.get("syaahi-oauth-consent")?.value !== TERMS_VERSION)
      throw new Error("Agree to the Terms before signing in.");
    const code = req.nextUrl.searchParams.get("code");
    if (!code || code.length > 4096)
      throw new Error("Google sign-in was cancelled or expired.");
    const client = oauthClient(req, response);
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error("Google sign-in expired. Please try again.");
    const { data, error: verifyError } = await client.auth.getUser();
    if (verifyError || !data.user)
      throw new Error("Google identity could not be verified.");
    const account = await googleAccount(data.user);
    await recordConsent(account.id);
    const session = await startSession(account, req);
    for (const cookie of session.cookies.getAll()) response.cookies.set(cookie);
    await client.auth.signOut({ scope: "local" });
    response.headers.set(
      "location",
      new URL(
        safeNext(req.cookies.get("syaahi-oauth-next")?.value || null),
        origin,
      ).href,
    );
  } catch (e) {
    response.headers.set(
      "location",
      new URL(
        "/login?error=" +
          encodeURIComponent(
            e instanceof Error ? e.message : "Sign-in failed.",
          ),
        origin,
      ).href,
    );
  }
  response.cookies.set("syaahi-oauth-next", "", { path: "/", maxAge: 0 });
  response.cookies.set("syaahi-oauth-consent", "", { path: "/", maxAge: 0 });
  return response;
}

export const GET = apiHandler(handleGET);
