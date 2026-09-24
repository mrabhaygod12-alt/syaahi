import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";

// POST /api/test-tier { provider?: 'openrouter'|'apinex'|'zen'|'all', models?: string[], prompt?: string, maxTokens?: number }
// Uses server-side keys from .env.local — keys never leave the server.
// Default budget is 3500: APInex/Zen reasoning models burn ~800-1500 thinking
// tokens before answering, so ≤1000-token tests fake-fail them as EMPTY.

const OPENROUTER_DEFAULTS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "z-ai/glm-5.2:free",
  "thinkingmachines/inkling:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "openrouter/free",
];

const APINEX_DEFAULTS = [
  "free/gemini-3.8-flash",
  "free/gpt-5.6-luna",
  "free/kimi-k3",
  "free/gemini-3.1-pro",
  "free/glm-5.3-flash",
  "free/deepseek-v4-pro-0813",
  "free/qwen-3.8-max",
  "free/deepseek-v4.1-flash",
  "free/deepseek-v4-flash-0731",
  "free/muse-spark-1.3",
  "free/mimo-v2.5",
];

const ZEN_DEFAULTS = [
  "muse-spark-1.3-contributor-free",
  "nemotron-3-ultra-free",
  "mimo-v2.5-free",
];

async function testModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    const ms = Date.now() - t0;
    if (!res.ok)
      return {
        model,
        ok: false,
        ms,
        error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
      };
    const j = await res.json();
    const text: string = j.choices?.[0]?.message?.content ?? "";
    return {
      model,
      ok: !!text.trim(),
      ms,
      chars: text.length,
      sample: text.slice(0, 200),
    };
  } catch (e: any) {
    return {
      model,
      ok: false,
      ms: Date.now() - t0,
      error: String(e?.message).slice(0, 200),
    };
  }
}

async function handleGET(req: Request) {
  if (process.env.ENABLE_DIAGNOSTICS !== "true")
    return new Response("Not found", { status: 404 });
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json({
    openrouter: {
      models: OPENROUTER_DEFAULTS,
      keyConfigured: !!process.env.OPENROUTER_API_KEY,
    },
    apinex: {
      models: APINEX_DEFAULTS,
      keyConfigured: !!process.env.APINEX_API_KEY,
    },
    zen: {
      models: ZEN_DEFAULTS,
      keyConfigured: !!process.env.OPENCODE_API_KEY,
    },
    usage:
      "POST { provider?, models?, prompt?, maxTokens? } — runs server-side with .env.local keys",
  });
}

async function handlePOST(req: NextRequest) {
  if (process.env.ENABLE_DIAGNOSTICS !== "true")
    return new Response("Not found", { status: 404 });
  const denied = await authError(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const provider: string = body.provider ?? "all";
  const prompt: string =
    body.prompt ??
    "Explain Photosynthesis in 5 short bullets for exam revision.";
  const maxTokens: number = Math.min(Number(body.maxTokens ?? 3500), 4000);
  const results: any[] = [];

  if (provider === "openrouter" || provider === "all") {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      results.push({
        provider: "openrouter",
        error: "OPENROUTER_API_KEY not set",
      });
    } else {
      const models: string[] = (body.models ?? OPENROUTER_DEFAULTS).slice(0, 8);
      for (const m of models)
        results.push(
          await testModel(
            "https://openrouter.ai/api/v1",
            key,
            m,
            prompt,
            maxTokens,
          ),
        );
    }
  }

  if (provider === "apinex" || provider === "all") {
    const key = process.env.APINEX_API_KEY;
    if (!key) {
      results.push({ provider: "apinex", error: "APINEX_API_KEY not set" });
    } else {
      const models: string[] = (body.models ?? APINEX_DEFAULTS).slice(0, 12);
      for (const m of models)
        results.push(
          await testModel("https://apinex.bond/v1", key, m, prompt, maxTokens),
        );
    }
  }

  if (provider === "zen" || provider === "all") {
    const key = process.env.OPENCODE_API_KEY;
    if (!key) {
      results.push({
        provider: "zen",
        error:
          "OPENCODE_API_KEY not set — add it to .env.local to activate Zen",
      });
    } else {
      const models: string[] = (body.models ?? ZEN_DEFAULTS).slice(0, 6);
      for (const m of models)
        results.push(
          await testModel(
            "https://opencode.ai/zen/v1",
            key,
            m,
            prompt,
            maxTokens,
          ),
        );
    }
  }

  return NextResponse.json({
    results,
    passed: results.filter((r) => r.ok).length,
    total: results.length,
  });
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);
