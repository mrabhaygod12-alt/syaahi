import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { adminEligibility } from "@/lib/auth/admin";
import {
  beginMfa,
  confirmMfa,
  challengeMfa,
  mfaStatus,
  beginMfaReplacement,
  rotateMfaRecovery,
  MfaError,
  cancelMfaReplacement,
} from "@/lib/auth/admin-mfa";
import { rateLimit } from "@/lib/ratelimit";
import QRCode from "qrcode";
async function guard(req: Request) {
  const u = await currentUser(req);
  return u && Object.values(adminEligibility(u)).some(Boolean) ? u : null;
}
export const GET = apiHandler(async (req: Request) => {
  const u = await guard(req);
  return u
    ? NextResponse.json(await mfaStatus(u, req))
    : NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 },
      );
});
export const POST = apiHandler(async (req: Request) => {
  const u = await guard(req);
  if (!u)
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  const limited = await rateLimit(req, "admin-mfa", 6, 5 * 60000);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b))
    return NextResponse.json(
      { error: "Enter valid verification details." },
      { status: 400 },
    );
  try {
    if (b.action === "begin" || b.action === "replace") {
      const setup =
        b.action === "replace"
          ? await beginMfaReplacement(u, req, b.password, b.code)
          : await beginMfa(u, req, b.password);
      return NextResponse.json({
        ...setup,
        qr: await QRCode.toDataURL(setup.uri, { margin: 1, width: 240 }),
      });
    }
    if (b.action === "confirm")
      return NextResponse.json({
        recoveryCodes: await confirmMfa(u, req, b.id, b.code),
        verified: true,
      });
    if (b.action === "rotate-recovery")
      return NextResponse.json({
        recoveryCodes: await rotateMfaRecovery(u, req, b.password, b.code),
        verified: true,
      });
    if (b.action === "cancel-replacement") {
      await cancelMfaReplacement(u, req, b.id);
      return NextResponse.json({ cancelled: true });
    }
    if (b.action === "verify") {
      await challengeMfa(u, req, b.code);
      return NextResponse.json({ verified: true });
    }
    return NextResponse.json({ error: "Unknown MFA action." }, { status: 400 });
  } catch (e) {
    if (e instanceof MfaError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
});
