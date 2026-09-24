// Dated provider evidence and access limits: docs/PROVIDERS.md.
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
    id: "apinex-glm",
    type: "apinex",
    model: "free/glm-5.3-flash",
    maxCtx: 32000,
    priority: 7,
    tier: "auto",
    note: "Public free catalog; account quotas apply. Model identity is the gateway's claim.",
  },
  ...["free/deepseek-v4.1-flash", "free/mimo-v2.6-pro"].map(
    (model, i): ProviderDef => ({
      id: `apinex-${i + 1}`,
      type: "apinex",
      model,
      maxCtx: 32000,
      priority: 8 + i,
      tier: "auto",
      note: "Public free catalog; verify account access before enabling.",
    }),
  ),
  ...["space-bunny-free", "mimo-v2.6-flash-free"].map(
    (model, i): ProviderDef => ({
      id: `zen-${i + 1}`,
      type: "zen",
      model,
      maxCtx: 32000,
      priority: 10 + i,
      tier: "auto",
      note: "Limited-time free catalog; account access and data terms apply.",
    }),
  ),
];
export function eligibleProviders(): ProviderDef[] {
  return PROVIDERS.filter(
    (p) =>
      providerKeys(providerEnvKey(p.type)).length > 0 &&
      (p.type !== "zen" || process.env.ENABLE_ZEN_API === "true") &&
      (p.type !== "nvidia" || process.env.ENABLE_NVIDIA_TRIAL === "true") &&
      (p.type !== "apinex" || process.env.ENABLE_APINEX !== "false"),
  );
}

export const PROVIDER_BASE_URL: Record<ProviderType, string> = {
  openrouter: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  zen: process.env.ZEN_BASE_URL || "https://opencode.ai/zen/v1",
  gemini: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
  groq: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  cerebras: process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1",
  nvidia: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
  mistral: process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1",
  deepseek: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apinex: process.env.APINEX_BASE_URL || "https://api.apinex.bond/v1",
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
