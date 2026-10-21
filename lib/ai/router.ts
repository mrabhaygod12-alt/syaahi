import OpenAI from "openai";
import { gatewayModel, GatewayModelError } from "./gateway-catalog";
import { gatewayBase, gatewayKeys, isGateway } from "./gateway-config";
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
const quotaPrefix = "sorry, to prevent abuse of free resources";
async function inferenceFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await globalThis.fetch(input, { ...init, redirect: "error" });
  if (!response.body) return response;
  const reader = response.body.getReader();
  let bytes = 0;
  return new Response(new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) { controller.close(); return; }
        bytes += chunk.value.byteLength;
        if (bytes > 4 * 1024 * 1024) {
          await reader.cancel();
          controller.error(new Error("Provider response exceeds the supported size."));
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  }), { status: response.status, statusText: response.statusText, headers: response.headers });
}
function assertProviderText(p: ProviderDef, text: string) {
  if (
    p.type === "aihubmix" &&
    text.trimStart().toLowerCase().startsWith(quotaPrefix)
  )
    throw Object.assign(new Error("Provider quota unavailable."), {
      status: 402,
    });
}
function providerAtCapacity(p: ProviderDef) {
  const value = Number(process.env.AI_PROVIDER_MAX_IN_FLIGHT || 2);
  const max = Number.isInteger(value) && value >= 1 && value <= 8 ? value : 2;
  return (active.get(p.type) || 0) >= max;
}
function cooling(p: ProviderDef) {
  return (
    Math.max(
      breaker.get(p.type)?.until || 0,
      breaker.get(`model:${p.type}:${p.model}`)?.until || 0,
    ) > Date.now()
  );
}
function recordFailure(p: ProviderDef, error: unknown) {
  if (error instanceof GatewayModelError) return;
  const status = Number((error as { status?: number })?.status) || 0;
  // A retired/invalid model must not disable other models at the same provider.
  const key = [400, 404, 410].includes(status)
    ? `model:${p.type}:${p.model}`
    : p.type;
  const failures = (breaker.get(key)?.fails || 0) + 1;
  const raw = (
    error as { headers?: { get?: (key: string) => string | null } }
  ).headers?.get?.("retry-after");
  const delay =
    raw && /^\d+(?:\.\d+)?$/.test(raw)
      ? Number(raw) * 1000
      : raw
        ? Date.parse(raw) - Date.now()
        : 0;
  const cooldown = [401, 402, 403].includes(status)
    ? 300000
    : status === 429
      ? Math.max(30000, Number.isFinite(delay) ? Math.min(900000, delay) : 0)
      : Math.min(30000 * failures, 120000);
  breaker.set(key, { fails: failures, until: Date.now() + cooldown });
}
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
  signal?: AbortSignal,
) {
  const keys = isGateway(p.type)
    ? gatewayKeys(p.type, true)
    : orderedKeys(providerEnvKey(p.type));
  let lastError: unknown;
  for (const key of keys) {
    try {
      const gateway = isGateway(p.type)
        ? await gatewayModel(p.type, key, p.model)
        : null;
      if (
        gateway &&
        JSON.stringify(messages).length / 3 + maxTokens > gateway.context_window
      )
        throw new GatewayModelError(
          "Gateway context window is too small for this request",
        );
      const client = new OpenAI({
        apiKey: key,
        baseURL: isGateway(p.type)
          ? gatewayBase(p.type)
          : PROVIDER_BASE_URL[p.type],
        fetch: inferenceFetch,
        maxRetries: 0,
        timeout,
      });
      const started = Date.now();
      const result = await client.chat.completions.create(
        {
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
            : json &&
                (["groq", "gemini", "mistral"].includes(p.type) ||
                  gateway?.capabilities.includes("json_mode"))
              ? { response_format: { type: "json_object" as const } }
              : {}),
        },
        { signal },
      );
      const choice = result.choices?.[0];
      if (choice?.finish_reason === "length")
        throw new Error("TRUNCATED_OUTPUT");
      const text = choice?.message?.content?.trim();
      if (!text) throw new Error("EMPTY_OUTPUT");
      assertProviderText(p, text);
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
    timeoutMs?: number;
    maxAttempts?: number;
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
  const deadline = Math.max(1000, Math.min(90000, opts?.timeoutMs || 90000));
  const deadlineSignal = AbortSignal.timeout(deadline);
  const errors: string[] = [];
  let temporary = false;
  let saturated = false;
  // Keep the best available model first; spread only when its organization is busy.
  const queue = [
    ...candidates.filter((p) => (active.get(p.type) || 0) < 1),
    ...candidates.filter((p) => (active.get(p.type) || 0) >= 1),
  ];
  // A retry must not hit the same provider lane that just failed. `rotateBy`
  // shifts the ranking so attempt N starts further down the priority list,
  // which is what the lesson runner expects when it retries a page.
  if (opts?.rotateBy) {
    const shift = opts.rotateBy % queue.length;
    queue.push(...queue.splice(0, shift));
  }
  let attempts = 0;
  for (const p of queue) {
    if (
      attempts >= Math.max(1, Math.min(5, opts?.maxAttempts || 5)) ||
      Date.now() - start > deadline
    )
      break;
    if (cooling(p)) continue;
    if (providerAtCapacity(p)) {
      saturated = true;
      continue;
    }
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
        Math.max(1000, Math.min(30000, deadline - (Date.now() - start))),
        opts?.json,
        opts?.schema,
        deadlineSignal,
      );
      breaker.delete(p.type);
      breaker.delete(`model:${p.type}:${p.model}`);
      return response;
    } catch (error) {
      const status = Number((error as { status?: number })?.status) || 0;
      if (
        !(error instanceof GatewayModelError) &&
        (status === 429 || status >= 500 || status === 0)
      )
        temporary = true;
      const message =
        error instanceof Error ? error.message : "Provider failed";
      const kind =
        error instanceof GatewayModelError
          ? "model unavailable"
          : message.includes("TRUNCATED")
            ? "truncated"
            : message.includes("EMPTY")
              ? "empty"
              : status
                ? `HTTP ${status}`
                : "timeout or network";
      errors.push(`${p.id}: ${kind}`);
      recordFailure(p, error);
    } finally {
      active.set(p.type, Math.max(0, (active.get(p.type) || 1) - 1));
    }
  }
  const cooldowns = candidates
    .map((p) => (breaker.get(p.type)?.until || 0) - Date.now())
    .filter((n) => n > 0);
  throw new AIUnavailableError(
    `AI providers unavailable. ${errors.join("; ") || "Quotas are cooling down; retry shortly."}`,
    temporary || saturated || (!attempts && cooldowns.some((n) => n <= 120000)),
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
    if (cooling(p) || providerAtCapacity(p)) continue;
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
      for (const key of isGateway(p.type)
        ? gatewayKeys(p.type, true)
        : orderedKeys(providerEnvKey(p.type))) {
        try {
          if (isGateway(p.type)) {
            const model = await gatewayModel(p.type, key, p.model, true);
            if (
              messages.reduce((n, m) => n + m.content.length, 0) / 2 +
                maxTokens >
              model.context_window
            )
              throw new GatewayModelError(
                "Gateway context window is too small for this request",
              );
          }
          const client = new OpenAI({
            apiKey: key,
            baseURL: isGateway(p.type)
              ? gatewayBase(p.type)
              : PROVIDER_BASE_URL[p.type],
            fetch: inferenceFetch,
            maxRetries: 0,
            timeout: Math.max(
              1000,
              Math.min(30000, 90000 - (Date.now() - started)),
            ),
          });
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
          let initial = "";
          for await (const chunk of stream) {
            if (opts?.signal?.aborted) return;
            if (chunk.model) model = chunk.model;
            if (chunk.choices?.[0]?.finish_reason === "length")
              truncated = true;
            let text = chunk.choices?.[0]?.delta?.content;
            if (typeof text !== "string" || !text) continue;
            if (p.type === "aihubmix" && !emitted) {
              initial += text;
              assertProviderText(p, initial);
              if (quotaPrefix.startsWith(initial.trimStart().toLowerCase()))
                continue;
              text = initial;
              initial = "";
            }
            const first = !emitted;
            emitted = true;
            yield first ? { t: text, provider: p.id, model } : { t: text };
          }
          if (!emitted && initial) {
            assertProviderText(p, initial);
            emitted = true;
            yield { t: initial, provider: p.id, model };
          }

          if (!emitted) throw new Error("EMPTY_OUTPUT");
          breaker.delete(p.type);
          breaker.delete(`model:${p.type}:${p.model}`);
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
      const kind =
        error instanceof GatewayModelError
          ? "model unavailable"
          : message.includes("TRUNCATED")
            ? "truncated"
            : message.includes("EMPTY")
              ? "empty"
              : status
                ? `HTTP ${status}`
                : "timeout or network";
      errors.push(`${p.id}: ${kind}`);
      recordFailure(p, error);

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
