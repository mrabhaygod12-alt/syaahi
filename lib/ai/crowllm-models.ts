/**
 * CrowLLM free chat models confirmed from the provider's public model pages on
 * 2026-11-22. The provider's `:free` suffix is not a billing guarantee: several
 * IDs carrying it currently have non-zero prices. Keep this list explicit and
 * review it before adding models or changing the provider's free-only policy.
 */
export const CROWLLM_VERIFIED_FREE_CHAT_MODELS = [
  "crow-roleplay:free",
  "laguna-xs-2.1-uncensored:free",
  "laguna-xs-2.1:free",
  "dots-3-note-preview:free",
  "flint-v1.0:free",
  "jais-3-mova-36b-a4b:free",
  "k2-horizon-375b-a23b-uncensored:free",
  "k2-horizon-375b-a23b:free",
  "longcat-2.5:free",
  "particle-1-uncensored:free",
  "particle-1:free",
  "xing4.0-29b-a4b:free",
  "gemma-4-31b-it:free",
  "llama-3.3-70b-instruct:free",
  "llama-3.3-70b:free",
  "minimax-m3.1-flash:free",
  "nemotron-3-ultra-550b-a55b-uncensored:free",
  "nemotron-3.5-super-vl:free",
  "step-5-preview:free",
  "solar-mini4:free",
  "grok-4.7-fast:free",
  "grok-4.7:free",
  "caw/glm-5.3-flash:free",
  "glm-4.6v-flash:free",
] as const;

const verifiedFreeChatModels = new Set<string>(
  CROWLLM_VERIFIED_FREE_CHAT_MODELS,
);

export function isCrowllmVerifiedFreeChatModel(id: string) {
  return verifiedFreeChatModels.has(id);
}
