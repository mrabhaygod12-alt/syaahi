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
      return await startSession(user, req);
    } catch (err) {
      const isDuplicate =
        err instanceof Error &&
        (err.message.includes("duplicate key") ||
          err.message.includes("E11000"));
      return NextResponse.json(
        {
          error: isDuplicate
            ? "This email is already registered. Please log in instead."
            : "Unable to create this account. If registered, please log in.",
        },
        { status: 409 },
      );
    }
  }
  const row = await accountByEmail(email);
  if (!row || !passwordMatches(password, String(row.password)))
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  await recordConsent(String(row.id));
  return startSession(
    {
      id: String(row.id),
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
