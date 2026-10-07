import { apiHandler } from "@/lib/api-handler";
import { hasConsent, recordConsent } from "@/lib/auth/consent";
import { NextRequest, NextResponse } from "next/server";
import {
  accountByEmail,
  currentUser,
  endSession,
  originError,
  passwordMatches,
  register,
  startSession,
  assertAccountActive,
  AccountAccessError,
} from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { setWorkspace, workspaceKind } from "@/lib/workspace-preference";
import { enrollWriter, writerAccess } from "@/lib/writing/profile";
import { recordTrap } from "@/lib/security/abuse";
import { learningPreferences } from "@/lib/growth/preferences";
import { mutateState } from "@/lib/study/state";
import { freshHub } from "@/lib/study/hub";
import { recordMetric, setMeasurementConsent } from "@/lib/growth/metrics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handleGET(req: NextRequest) {
  return NextResponse.json({ user: await currentUser(req) });
}
async function handleDELETE(req: NextRequest) {
  return originError(req) || endSession(req);
}
async function handlePOST(req: NextRequest) {
  const limited =
    originError(req) || (await rateLimit(req, "auth", 10, 60_000));
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  if (typeof body.website === "string" && body.website.trim()) {
    await recordTrap(req, "form-trap");
    return NextResponse.json(
      { error: "Sign-in could not be completed. Please retry." },
      { status: 400 },
    );
  }
  if (!hasConsent(body))
    return NextResponse.json(
      {
        error:
          "Please agree to the current Terms and acknowledge the Privacy Policy before continuing.",
      },
      { status: 400 },
    );
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    email.length > 254 ||
    password.length < 10 ||
    password.length > 128
  ) {
    return NextResponse.json(
      { error: "Use a valid email and a password of 10-128 characters." },
      { status: 400 },
    );
  }
  if (body.mode === "signup") {
    try {
      const preferences =
        body.workspace !== "writer" && body.learningPreferences !== undefined
          ? learningPreferences(body.learningPreferences)
          : null;
      // Same email, same identity and wallet. Authenticate before adding a writer profile.
      const existing = await accountByEmail(email);
      if (existing && body.workspace === "writer") {
        if (!passwordMatches(password, String(existing.password)))
          return NextResponse.json(
            {
              error:
                "Use your existing account password to create your writer profile, or continue with Google.",
            },
            { status: 401 },
          );
        const { rewardSummary } = await import("@/lib/billing/rewards");
        await assertAccountActive(String(existing.id));
        if (!(await rewardSummary(String(existing.id))).emailVerified)
          return NextResponse.json(
            {
              error:
                "Verify your existing email before creating a writer profile.",
              requireVerification: true,
              verifyUrl: "/verify-email",
            },
            { status: 403 },
          );
        const account = {
          id: String(existing.id),
          email,
          name: String(existing.name),
          createdAt: String(existing.created_at),
          workspace: "writer" as const,
        };
        await enrollWriter(account);
        await recordConsent(account.id);
        await setWorkspace(account.id, "writer");
        return startSession(account, req);
      }
      const user = await register(
        String(body.name || email.split("@")[0])
          .trim()
          .slice(0, 80),
        email,
        password,
      );
      await recordConsent(user.id);
      if (preferences)
        await mutateState(user.id, "hub", freshHub(), (s) => ({
          ...s,
          preferences,
        }));
      if (req.cookies.get("syaahi-measurement")?.value === "1")
        try {
          await setMeasurementConsent(user.id, true);
          await recordMetric(
            req.cookies.get("syaahi-visitor")?.value || "",
            "signup_created",
            user.id,
            user.id,
          );
        } catch {
          console.warn("Signup measurement unavailable");
        }
      if (body.workspace === "writer") await enrollWriter(user);
      if (workspaceKind(body.workspace))
        await setWorkspace(user.id, workspaceKind(body.workspace)!);

      // Record invite attribution now; the inviter is rewarded only after
      // this account completes email verification.
      if (typeof body.referralCode === "string" && body.referralCode) {
        try {
          const { claimReferral } = await import("@/lib/billing/referrals");
          await claimReferral(user.id, body.referralCode);
        } catch {
          // A stale or invalid invite should not block signup.
        }
      }

      // Issue verification link/token
      let verificationSent = false;
      try {
        const { sendVerification } = await import("@/lib/auth/verification");
        await sendVerification(user);
        verificationSent = true;
      } catch (vErr) {
        console.warn("Verification delivery unavailable");
      }

      return NextResponse.json(
        {
          ok: true,
          requireVerification: true,
          verifyUrl: "/verify-email",
          message: verificationSent
            ? "Account created. Open the verification link sent to your email."
            : "Account created, but the verification email could not be sent. Go to Log in and submit your email and password to retry delivery. You cannot use the account until it is verified.",
        },
        { status: 202 },
      );
    } catch (err) {
      if (err instanceof AccountAccessError) throw err;
      console.error(
        "Signup failed:",
        err instanceof Error ? err.name : "unknown",
      );
      const isDuplicate =
        err instanceof Error &&
        (err.message.includes("duplicate key") ||
          err.message.includes("E11000") ||
          err.message.includes("already registered"));
      return NextResponse.json(
        {
          error: isDuplicate
            ? "This email is already registered. Please log in instead."
            : "Unable to create this account. If registered, please log in or contact support.",
        },
        { status: isDuplicate ? 409 : 500 },
      );
    }
  }
  const row = await accountByEmail(email);
  if (!row || !passwordMatches(password, String(row.password)))
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );

  // Verification is required for both local and hosted accounts.
  const userId = String(row.id);
  await assertAccountActive(userId);
  const { rewardSummary } = await import("@/lib/billing/rewards");
  if (!(await rewardSummary(userId)).emailVerified) {
    let verificationSent = false;
    try {
      const { sendVerification } = await import("@/lib/auth/verification");
      await sendVerification({ id: userId, email });
      verificationSent = true;
    } catch {}
    return NextResponse.json(
      {
        error: verificationSent
          ? "Email not verified. Open the link sent to your inbox."
          : "Email verification delivery is unavailable. Please contact support.",
        requireVerification: true,
        verifyUrl: "/verify-email",
        email,
      },
      { status: 403 },
    );
  }

  await recordConsent(userId);
  if (body.workspace === "writer") {
    const access = await writerAccess(userId);
    if (access) return access;
  }
  if (workspaceKind(body.workspace))
    await setWorkspace(userId, workspaceKind(body.workspace)!);
  return startSession(
    {
      id: userId,
      email,
      name: String(row.name),
      createdAt: String(row.created_at),
      workspace:
        workspaceKind(body.workspace) ||
        workspaceKind(row.workspace) ||
        "student",
    },
    req,
  );
}

export const GET = apiHandler(handleGET);
export const DELETE = apiHandler(handleDELETE);
export const POST = apiHandler(handlePOST);
