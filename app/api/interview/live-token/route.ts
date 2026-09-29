import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Creates a single-use, short-lived token constrained to voice interview
 * sessions. The permanent Gemini key remains only on the application server.
 */
async function handlePOST(req: NextRequest) {
  const denied = (await authError(req)) || (await rateLimit(req, "interview-live", 4, 60_000));
  if (denied) return denied;
  const key = process.env.GEMINI_LIVE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Voice interviews are not configured yet." }, { status: 503 });
  const now = Date.now();
  const model = process.env.GEMINI_LIVE_MODEL?.trim() || "models/gemini-3.8-live";
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 15 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: {
          model,
          config: { responseModalities: ["AUDIO"], sessionResumption: {} },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.name !== "string") {
      console.warn("Gemini Live token request failed", { status: response.status });
      return NextResponse.json({ error: "Voice interviews are temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ token: data.name, model, expiresAt: data.expireTime || new Date(now + 15 * 60_000).toISOString() });
  } catch {
    return NextResponse.json({ error: "Voice interviews are temporarily unavailable." }, { status: 503 });
  }
}
export const POST = apiHandler(handlePOST);
