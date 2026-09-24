import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { NextResponse } from "next/server";
import { PROVIDERS, providerEnvKey } from "@/lib/ai/providers";
import { getLiveStealthModel, breakerStatus } from "@/lib/ai/router";

async function handleGET(req: Request) {
  if (process.env.ENABLE_DIAGNOSTICS !== "true")
    return new Response("Not found", { status: 404 });
  const denied = await authError(req);
  if (denied) return denied;
  const stealth = await getLiveStealthModel();
  return NextResponse.json({
    stealthLive: stealth,
    total: PROVIDERS.length,
    configured: PROVIDERS.filter(
      (p) => !!process.env[providerEnvKey(p.type)],
    ).map((p) => p.id),
    breakers: breakerStatus(),
    missingKeys: [
      ...new Set(PROVIDERS.map((p) => providerEnvKey(p.type))),
    ].filter((k) => !process.env[k]),
    providers: PROVIDERS,
    hint: "Copy .env.example to .env.local and add at least OPENROUTER_API_KEY (20+ free models, no card) or GROQ_API_KEY (14.4k req/day free).",
  });
}

export const GET = apiHandler(handleGET);
