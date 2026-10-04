import { apiHandler } from "@/lib/api-handler";
import { TERMS_VERSION, recordConsent } from "@/lib/auth/consent";
import { NextRequest, NextResponse } from "next/server";
import { oauthClient, googleAccount } from "@/lib/auth/oauth";
import { startSession } from "@/lib/auth/server";
import { markEmailVerified } from "@/lib/billing/rewards";
import { claimReferral } from "@/lib/billing/referrals";
import { setWorkspace, workspaceKind } from "@/lib/workspace-preference";
import { enrollWriter, writerProfile } from "@/lib/writing/profile";
import { workspaceDestination } from "@/lib/workspace-routing";
async function handleGET(req: NextRequest) {
  const origin =
    (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "") ||
    req.headers.get("origin")?.replace(/\/+$/, "") ||
    "https://www.syaahii.in";
  const response = NextResponse.redirect(new URL("/login", origin));
  response.headers.set("Cache-Control", "no-store");
  const workspace = workspaceKind(
    req.cookies.get("syaahi-oauth-workspace")?.value,
  );
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
    if (workspace) {
      if (workspace === "writer") {
        if (req.cookies.get("syaahi-oauth-mode")?.value === "signup")
          await enrollWriter(account);
        else if (!(await writerProfile(account.id))) {
          await markEmailVerified(account.id);
          const session = await startSession(account, req);
          for (const cookie of session.cookies.getAll())
            response.cookies.set(cookie);
          response.headers.set(
            "location",
            new URL("/signup?workspace=writer&next=/writer/welcome", origin)
              .href,
          );
          await client.auth.signOut({ scope: "local" });
          for (const key of ["next", "consent", "ref", "workspace", "mode"])
            response.cookies.set(`syaahi-oauth-${key}`, "", {
              path: "/",
              maxAge: 0,
            });
          return response;
        }
      }
      await setWorkspace(account.id, workspace);
      account.workspace = workspace;
    }
    const referral = req.cookies.get("syaahi-oauth-ref")?.value;
    if (referral) {
      try {
        await claimReferral(account.id, referral);
      } catch {
        /* An expired invitation must not prevent an existing member signing in. */
      }
    }
    await markEmailVerified(account.id);
    await recordConsent(account.id);
    const session = await startSession(account, req);
    for (const cookie of session.cookies.getAll()) response.cookies.set(cookie);
    await client.auth.signOut({ scope: "local" });
    response.headers.set(
      "location",
      new URL(
        workspaceDestination(
          req.cookies.get("syaahi-oauth-next")?.value,
          workspace || account.workspace || "student",
        ),
        origin,
      ).href,
    );
  } catch (err) {
    console.error(
      "OAuth callback failed:",
      err instanceof Error ? err.name : "unknown",
    );
    const msg =
      "Google sign-in could not be completed. Please retry or use email sign-in.";
    const retry = new URL(
      req.cookies.get("syaahi-oauth-mode")?.value === "signup"
        ? "/signup"
        : "/login",
      origin,
    );
    retry.searchParams.set("error", msg);
    retry.searchParams.set("workspace", workspace || "student");
    retry.searchParams.set(
      "next",
      workspaceDestination(
        req.cookies.get("syaahi-oauth-next")?.value,
        workspace || "student",
      ),
    );
    response.headers.set("location", retry.href);
  }
  response.cookies.set("syaahi-oauth-next", "", { path: "/", maxAge: 0 });
  response.cookies.set("syaahi-oauth-consent", "", { path: "/", maxAge: 0 });
  response.cookies.set("syaahi-oauth-ref", "", { path: "/", maxAge: 0 });
  response.cookies.set("syaahi-oauth-workspace", "", { path: "/", maxAge: 0 });
  response.cookies.set("syaahi-oauth-mode", "", { path: "/", maxAge: 0 });
  return response;
}

export const GET = apiHandler(handleGET);
