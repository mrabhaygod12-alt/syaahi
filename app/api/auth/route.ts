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
} from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
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
      const user = await register(
        String(body.name || email.split("@")[0])
          .trim()
          .slice(0, 80),
        email,
        password,
      );
      await recordConsent(user.id);

      // Issue verification link/token
      let verificationSent = false;
      try {
        const { sendVerification } = await import("@/lib/auth/verification");
        await sendVerification(user);
        verificationSent = true;
      } catch (vErr) {
        console.warn("Verification delivery unavailable");
      }

      return await startSession(user, req, {
        ok: true,
        requireVerification: true,
        verifyUrl: "/verify-email",
        message: verificationSent
          ? "Account created. Open the verification link sent to your email."
          : "Account created, but verification email delivery is unavailable. Contact support or retry sending from your account.",
      });
    } catch (err) {
      const detail =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error("Signup failed:", detail);
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

  // Check email verification for production MongoDB accounts
  const userId = String(row.id);
  const { collection, useMongo } = await import("@/lib/storage/mongo");
  if (useMongo()) {
    let verified = Boolean((row as any).verified);
    const vDoc = await (
      await collection("verified_accounts")
    ).findOne({ _id: userId });
    if (vDoc) verified = true;

    if (!verified) {
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
  }

  await recordConsent(userId);
  return startSession(
    {
      id: userId,
      email,
      name: String(row.name),
      createdAt: String(row.created_at),
    },
    req,
  );
}

export const GET = apiHandler(handleGET);
export const DELETE = apiHandler(handleDELETE);
export const POST = apiHandler(handlePOST);
