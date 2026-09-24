// Provider catalog researched 2026-09-21; see RESEARCH-AND-BUILD-PLAN.md.
import { providerKeys } from "./keys";

export type ProviderType =
  | "openrouter"
  | "zen"
  | "gemini"
  | "groq"
  | "cerebras"
  | "nvidia"
  | "mistral"
  | "deepseek"
  | "apinex";

export interface ProviderDef {
  id: string;
  type: ProviderType;
  model: string; // exact API model id
  maxCtx: number;
  priority: number; // lower = try first
  tier: "quality" | "high" | "fast" | "direct" | "auto";
  note: string;
}

// Official endpoints first. Models with unverified access or evaluation-only terms
// are explicit opt-ins. Names/quotas are a dated catalog, never a guarantee.
export const PROVIDERS: ProviderDef[] = [
  {
    id: "groq-120b",
    type: "groq",
    model: "openai/gpt-oss-120b",
    maxCtx: 131072,
    priority: 1,
    tier: "quality",
    note: "Live text call passed 2026-09-21. Organization quotas apply.",
  },
  {
    id: "gemini-flash",
    type: "gemini",
    model: "gemini-3.8-flash",
    maxCtx: 1000000,
    priority: 2,
    tier: "quality",
    note: "Live API access passed 2026-09-21. Free-tier project quota and data-use terms apply.",
  },
  {
    id: "groq-20b",
    type: "groq",
    model: "openai/gpt-oss-20b",
    maxCtx: 131072,
    priority: 3,
    tier: "fast",
    note: "Free-tier candidate; benchmark before promotion.",
  },
  {
    id: "mistral-small",
    type: "mistral",
    model: "mistral-small-latest",
    maxCtx: 256000,
    priority: 4,
    tier: "direct",
    note: "Free mode with account-specific limits; no configured key in audit.",
  },
  {
    id: "cerebras-120b",
    type: "cerebras",
    model: "gpt-oss-120b",
    maxCtx: 8192,
    priority: 5,
    tier: "direct",
    note: "Conservative context cap until account capability probe succeeds.",
  },
  {
    id: "openrouter-auto",
    type: "openrouter",
    model: "openrouter/free",
    maxCtx: 8192,
    priority: 6,
    tier: "auto",
    note: "Variable free model; returned model identity is logged. Not a quality guarantee.",
  },
  {
    id: "zen-pickle",
    type: "zen",
    model: "big-pickle",
    maxCtx: 32000,
    priority: 20,
    tier: "auto",
    note: "Disabled by default: this account returned 403 client-only free tier.",
  },
  {
    id: "nvidia-direct",
    type: "nvidia",
    model: "deepseek-ai/deepseek-v4-flash",
    maxCtx: 32000,
    priority: 21,
    tier: "direct",
    note: "Evaluation endpoint: opt-in for development, not a default production dependency.",
  },
  {
    id: "apinex-muse",
    type: "apinex",
    model: "free/muse-spark-1.3",
    maxCtx: 32000,
    priority: 22,
    tier: "auto",
    note: "Existing third-party integration retained as opt-in. Provider claims not independently verified.",
  },
];
export function eligibleProviders(): ProviderDef[] {
  return PROVIDERS.filter(
    (p) =>
      providerKeys(providerEnvKey(p.type)).length > 0 &&
      (p.type !== "zen" || process.env.ENABLE_ZEN_API === "true") &&
      (p.type !== "nvidia" || process.env.ENABLE_NVIDIA_TRIAL === "true") &&
      (p.type !== "apinex" || process.env.ENABLE_APINEX === "true"),
  );
}

export const PROVIDER_BASE_URL: Record<ProviderType, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  zen: "https://opencode.ai/zen/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  groq: "https://api.groq.com/openai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  mistral: "https://api.mistral.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
  apinex: "https://apinex.bond/v1",
};

export function providerEnvKey(t: ProviderType): string {
  return {
    openrouter: "OPENROUTER_API_KEY",
    zen: "OPENCODE_API_KEY",
    gemini: "GEMINI_API_KEY",
    groq: "GROQ_API_KEY",
    cerebras: "CEREBRAS_API_KEY",
    nvidia: "NVIDIA_NIM_API_KEY",
    mistral: "MISTRAL_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    apinex: "APINEX_API_KEY",
  }[t];
}
