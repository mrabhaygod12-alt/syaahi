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
import { createHash } from "node:crypto";
import { validMeasurementProof } from "@/lib/growth/consent-proof";
import { passwordHash } from "@/lib/auth/server";
const dummyCredential = passwordHash("non-user-timing-fixture-unusable");
const signupReceipt = () =>
  NextResponse.json(
    {
      ok: true,
      requireVerification: true,
      verifyUrl: "/verify-email",
      message:
        "Check your inbox for verification, or sign in to your existing account. If no email arrives, sign in to retry delivery or contact support.",
    },
    { status: 202 },
  );
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
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Provide a JSON object." }, { status: 400 });
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
      if (existing && body.workspace !== "writer") return signupReceipt();
      if (existing && body.workspace === "writer") {
        if (!passwordMatches(password, String(existing.password)))
          return signupReceipt();
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
      if (
        req.cookies.get("syaahi-measurement")?.value === "1" &&
        validMeasurementProof(
          req.cookies.get("syaahi-visitor")?.value || "",
          req.cookies.get("syaahi-measurement-proof")?.value || "",
        )
      )
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
      try {
        const { sendVerification } = await import("@/lib/auth/verification");
        await sendVerification(user);
      } catch (vErr) {
        console.warn("Verification delivery unavailable");
      }

      return signupReceipt();
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
      if (isDuplicate) return signupReceipt();
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
  const targeted = await rateLimit(
    req,
    "auth-email:" + createHash("sha256").update(email).digest("hex"),
    5,
    15 * 60000,
  );
  if (targeted) return targeted;
  const row = await accountByEmail(email);
  const matches = passwordMatches(
    password,
    row ? String(row.password) : dummyCredential,
  );
  if (!row || !matches)
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );

  // Verification is required for both local and hosted accounts.
  const userId = String(row.id);
  await assertAccountActive(userId);
  const { rewardSummary } = await import("@/lib/billing/rewards");
  if (
    !(await rewardSummary(userId)).emailVerified &&
    (await (
      await import("@/lib/auth/hosted-verification")
    ).hostedEmailConfirmed(email, password))
  ) {
    await (await import("@/lib/billing/rewards")).markEmailVerified(userId);
  }
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
