import OpenAI from "openai";
import { orderedKeys } from "./keys";
import {
  eligibleProviders,
  PROVIDER_BASE_URL,
  providerEnvKey,
  type ProviderDef,
} from "./providers";
export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface OutputSchema {
  name: string;
  schema: Record<string, unknown>;
}
export interface Usage {
  prompt: number;
  completion: number;
  total: number;
  cost: number | null;
}
const breaker = new Map<string, { fails: number; until: number }>();
const active = new Map<string, number>();
export function breakerStatus() {
  return Object.fromEntries(
    [...breaker].map(([id, b]) => [
      id,
      { fails: b.fails, cooldownMs: Math.max(0, b.until - Date.now()) },
    ]),
  );
}
export function isRateLimitError(error: unknown) {
  return Number((error as { status?: number })?.status) === 429;
}
export class AIUnavailableError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public retryAfterMs: number,
  ) {
    super(message);
    this.name = "AIUnavailableError";
  }
}
// Retained API compatibility. Do not send user content to unreviewed stealth providers.
export async function getLiveStealthModel(): Promise<string | null> {
  return null;
}
export const KEY_LINKS: Array<[string, string, string]> = [
  [
    "GROQ_API_KEY",
    "Groq: model-specific free quotas",
    "https://console.groq.com",
  ],
  [
    "GEMINI_API_KEY",
    "Gemini: free tier on selected models",
    "https://aistudio.google.com",
  ],
  [
    "MISTRAL_API_KEY",
    "Mistral: limited free mode",
    "https://console.mistral.ai",
  ],
  [
    "CEREBRAS_API_KEY",
    "Cerebras: account-specific free limits",
    "https://cloud.cerebras.ai",
  ],
  [
    "OPENROUTER_API_KEY",
    "OpenRouter: shared daily free-model allowance",
    "https://openrouter.ai",
  ],
];
async function callOne(
  p: ProviderDef,
  messages: ChatMsg[],
  maxTokens: number,
  timeout: number,
  json = false,
  schema?: OutputSchema,
) {
  const keys = orderedKeys(providerEnvKey(p.type));
  let lastError: unknown;
  for (const key of keys) {
    const client = new OpenAI({
      apiKey: key,
      baseURL: PROVIDER_BASE_URL[p.type],
      fetch: globalThis.fetch,
      maxRetries: 0,
      timeout,
    });
    const started = Date.now();
    try {
      const result = await client.chat.completions.create({
        model: p.model,
        messages,
        max_tokens: Math.min(8000, maxTokens),
        temperature: 0.25,
        ...(schema &&
        p.type === "groq" &&
        /^openai\/gpt-oss-(20b|120b)$/.test(p.model)
          ? {
              response_format: {
                type: "json_schema" as const,
                json_schema: { ...schema, strict: true },
              },
            }
          : json && ["groq", "gemini", "mistral"].includes(p.type)
            ? { response_format: { type: "json_object" as const } }
            : {}),
      });
      const choice = result.choices?.[0];
      if (choice?.finish_reason === "length")
        throw new Error("TRUNCATED_OUTPUT");
      const text = choice?.message?.content?.trim();
      if (!text) throw new Error("EMPTY_OUTPUT");
      const u = result.usage;
      return {
        text,
        provider: p.id,
        model: result.model || p.model,
        ms: Date.now() - started,
        usage: {
          prompt: u?.prompt_tokens || 0,
          completion: u?.completion_tokens || 0,
          total: u?.total_tokens || 0,
          cost: null,
        } as Usage,
      };
    } catch (error) {
      lastError = error;
      if (![401, 403].includes(Number((error as { status?: number })?.status)))
        throw error;
    }
  }
  throw lastError || new Error("NO_KEYS");
}
export async function chatWithFallback(
  messages: ChatMsg[],
  opts?: {
    maxTokens?: number;
    onlyConfigured?: boolean;
    rotateBy?: number;
    json?: boolean;
    schema?: OutputSchema;
  },
) {
  const candidates = eligibleProviders().sort(
    (a, b) => a.priority - b.priority,
  );
  if (!candidates.length)
    throw new Error(
      "NO_KEYS: Configure an eligible AI provider in .env.local.",
    );
  const start = Date.now();
  const errors: string[] = [];
  let temporary = false;
  // Keep the best available model first; spread only when its organization is busy.
  const queue = [
    ...candidates.filter((p) => (active.get(p.type) || 0) < 1),
    ...candidates.filter((p) => (active.get(p.type) || 0) >= 1),
  ];
  let attempts = 0;
  for (const p of queue) {
    if (attempts >= 5 || Date.now() - start > 90000) break;
    if ((breaker.get(p.type)?.until || 0) > Date.now()) continue;
    const budget = opts?.maxTokens || 2500;
    // Conservative estimate for multilingual text; reserve output room as well.
    if (
      messages.reduce((n, m) => n + m.content.length, 0) / 2 + budget >
      p.maxCtx
    )
      continue;
    attempts++;
    active.set(p.type, (active.get(p.type) || 0) + 1);
    try {
      const response = await callOne(
        p,
        messages,
        budget,
        Math.max(1000, Math.min(30000, 90000 - (Date.now() - start))),
        opts?.json,
        opts?.schema,
      );
      breaker.delete(p.type);
      return response;
    } catch (error) {
      const status = Number((error as { status?: number })?.status) || 0;
      if (status === 429 || status >= 500 || status === 0) temporary = true;
      const message =
        error instanceof Error ? error.message : "Provider failed";
      const kind = message.includes("TRUNCATED")
        ? "truncated"
        : message.includes("EMPTY")
          ? "empty"
          : status
            ? `HTTP ${status}`
            : "timeout or network";
      errors.push(`${p.id}: ${kind}`);
      const failures = (breaker.get(p.type)?.fails || 0) + 1;
      const retryHeader = (
        error as { headers?: { get?: (name: string) => string | null } }
      ).headers?.get?.("retry-after");
      const retrySeconds = Number(retryHeader);
      const cooldown =
        status === 429
          ? Math.max(
              30000,
              Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 0,
            )
          : [401, 403].includes(status)
            ? 300000
            : Math.min(30000 * failures, 120000);
      breaker.set(p.type, { fails: failures, until: Date.now() + cooldown });
    } finally {
      active.set(p.type, Math.max(0, (active.get(p.type) || 1) - 1));
    }
  }
  const cooldowns = candidates
    .map((p) => (breaker.get(p.type)?.until || 0) - Date.now())
    .filter((n) => n > 0);
  throw new AIUnavailableError(
    `AI providers unavailable. ${errors.join("; ") || "Quotas are cooling down; retry shortly."}`,
    temporary || (!attempts && cooldowns.some((n) => n <= 120000)),
    Math.max(30000, Math.min(120000, ...cooldowns)),
  );
}

export type ChatStreamEvent = {
  t?: string;
  provider?: string;
  model?: string;
  error?: string;
};

/**
 * Stream answer tokens as the selected provider produces them. Provider
 * fallback is attempted only before the first token; switching models after
 * partial output would duplicate or contradict the answer already shown.
 */
export async function* chatStreamWithFallback(
  messages: ChatMsg[],
  opts?: { maxTokens?: number; signal?: AbortSignal },
): AsyncGenerator<ChatStreamEvent> {
  const candidates = eligibleProviders().sort(
    (a, b) => a.priority - b.priority,
  );
  if (!candidates.length) {
    yield {
      error:
        "The study assistant is temporarily unavailable. Please try again shortly.",
    };
    return;
  }

  const started = Date.now();
  const errors: string[] = [];
  const queue = [
    ...candidates.filter((p) => (active.get(p.type) || 0) < 1),
    ...candidates.filter((p) => (active.get(p.type) || 0) >= 1),
  ];
  let attempts = 0;

  for (const p of queue) {
    if (opts?.signal?.aborted) return;
    if (attempts >= 5 || Date.now() - started > 90000) break;
    if ((breaker.get(p.type)?.until || 0) > Date.now()) continue;
    const maxTokens = opts?.maxTokens || 1500;
    if (
      messages.reduce((n, m) => n + m.content.length, 0) / 2 + maxTokens >
      p.maxCtx
    )
      continue;

    attempts++;
    active.set(p.type, (active.get(p.type) || 0) + 1);
    let emitted = false;
    try {
      let lastError: unknown;
      for (const key of orderedKeys(providerEnvKey(p.type))) {
        const client = new OpenAI({
          apiKey: key,
          baseURL: PROVIDER_BASE_URL[p.type],
          fetch: globalThis.fetch,
          maxRetries: 0,
          timeout: Math.max(
            1000,
            Math.min(30000, 90000 - (Date.now() - started)),
          ),
        });
        try {
          const stream = await client.chat.completions.create(
            {
              model: p.model,
              messages,
              max_tokens: Math.min(8000, maxTokens),
              temperature: 0.25,
              stream: true,
            },
            { signal: opts?.signal },
          );

          let model = p.model;
          let truncated = false;
          for await (const chunk of stream) {
            if (opts?.signal?.aborted) return;
            if (chunk.model) model = chunk.model;
            if (chunk.choices?.[0]?.finish_reason === "length")
              truncated = true;
            const text = chunk.choices?.[0]?.delta?.content;
            if (typeof text !== "string" || !text) continue;
            const first = !emitted;
            emitted = true;
            yield first ? { t: text, provider: p.id, model } : { t: text };
          }

          if (!emitted) throw new Error("EMPTY_OUTPUT");
          breaker.delete(p.type);
          if (truncated) {
            yield {
              error:
                "The answer reached the model’s length limit. Ask for a shorter explanation to finish it.",
            };
          }
          return;
        } catch (error) {
          lastError = error;
          const status = Number((error as { status?: number })?.status) || 0;
          if (emitted || ![401, 403].includes(status)) throw error;
        }
      }
      throw lastError || new Error("NO_KEYS");
    } catch (error) {
      if (opts?.signal?.aborted) return;
      const status = Number((error as { status?: number })?.status) || 0;
      const message =
        error instanceof Error ? error.message : "Provider failed";
      const kind = message.includes("TRUNCATED")
        ? "truncated"
        : message.includes("EMPTY")
          ? "empty"
          : status
            ? `HTTP ${status}`
            : "timeout or network";
      errors.push(`${p.id}: ${kind}`);
      const failures = (breaker.get(p.type)?.fails || 0) + 1;
      const retryHeader = (
        error as { headers?: { get?: (name: string) => string | null } }
      ).headers?.get?.("retry-after");
      const retrySeconds = Number(retryHeader);
      const cooldown =
        status === 429
          ? Math.max(
              30000,
              Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 0,
            )
          : [401, 403].includes(status)
            ? 300000
            : Math.min(30000 * failures, 120000);
      breaker.set(p.type, { fails: failures, until: Date.now() + cooldown });

      // Once text is visible, finish with a clear interruption marker rather
      // than silently switching providers or replaying the user's prompt.
      if (emitted) {
        yield {
          error:
            "The connection ended before the answer finished. The text above may be incomplete.",
        };
        return;
      }
    } finally {
      active.set(p.type, Math.max(0, (active.get(p.type) || 1) - 1));
    }
  }

  console.warn("Study chat unavailable", { attempts, failures: errors });
  yield {
    error:
      "The study assistant is temporarily unavailable. Please try again shortly.",
  };
}
