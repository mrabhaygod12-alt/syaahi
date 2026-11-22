import { providerKeys, orderedKeys } from "./keys";
import { CROWLLM_VERIFIED_FREE_CHAT_MODELS } from "./crowllm-models";
export const GATEWAYS = {
  llm7: {
    label: "LLM7",
    prefix: "LLM7",
    base: "https://api.llm7.io/v1",
    docs: "https://github.com/chigwell/llm7.io/blob/main/TERMS.md",
  },
  radox: {
    label: "Radox AI",
    prefix: "RADOX",
    base: "https://radoxai.com/v1",
    docs: "https://radoxai.com/docs/models",
  },
  aihubmix: {
    label: "AIHubMix",
    prefix: "AIHUBMIX",
    base: "https://aihubmix.com/v1",
    docs: "https://aihubmix.com/developers",
  },
  unorouter: {
    label: "UnoRouter",
    prefix: "UNOROUTER",
    base: "https://api.unorouter.com/v1",
    docs: "https://unorouter.com/en/docs/platform",
  },
  logfare: {
    label: "Logfare",
    prefix: "LOGFARE",
    base: "https://logfare.ai/v1",
    docs: "https://logfare.ai/docs",
  },
  antseed: {
    label: "Antseed gateway",
    prefix: "ANTSEED",
    base: "",
    docs: "https://antseed.com/docs/gateway/api/",
  },
  hms: {
    label: "100MilionSeek",
    prefix: "HMS",
    base: "https://100milionseek.top/v1",
    docs: "https://100milionseek.top/docs",
  },
  crowllm: {
    label: "CrowLLM",
    prefix: "CROWLLM",
    base: "https://crowllm.com/v1",
    docs: "https://docs.crowllm.com/en/docs/guide/quickstart",
  },
} as const;
export type GatewayType = keyof typeof GATEWAYS;
export const isGateway = (value: string): value is GatewayType =>
  Object.hasOwn(GATEWAYS, value);
export function gatewayBase(type: GatewayType) {
  if (type !== "antseed") return GATEWAYS[type].base;
  try {
    const url = new URL(process.env.ANTSEED_BASE_URL || "");
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.replace(/\/+$/, "") !== "/v1"
    )
      return "";
    const loopback = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (loopback) {
      if (
        process.env.NODE_ENV === "production" ||
        url.protocol !== "http:" ||
        url.port !== "8379"
      )
        return "";
    } else if (
      url.protocol !== "https:" ||
      (url.port && url.port !== "443") ||
      !url.hostname.includes(".") ||
      /^\d[\d.]+$/.test(url.hostname) ||
      url.hostname.startsWith("[")
    )
      return "";
    return url.href.replace(/\/+$/, "");
  } catch {
    return "";
  }
}
export function gatewayModels(type: GatewayType) {
  const prefix = GATEWAYS[type].prefix;
  const defaults: Partial<Record<GatewayType, string | readonly string[]>> = {
    hms: "deepseek-v4.1-flash-free",
    crowllm: CROWLLM_VERIFIED_FREE_CHAT_MODELS,
  };
  const configured =
    type === "crowllm" && process.env.CROWLLM_MODELS
      ? [process.env.CROWLLM_MODELS]
      : [process.env[`${prefix}_MODEL`], process.env[`${prefix}_MODELS`]].filter(
          (value): value is string => Boolean(value),
        );
  const selected: string[] = configured.length
    ? configured
    : typeof defaults[type] === "string"
      ? [defaults[type] as string]
      : [...(defaults[type] || [])];
  return [
    ...new Set(
      selected
        .filter(Boolean)
        .join(",")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^[a-z0-9][a-z0-9._:/@+-]{0,159}$/i.test(s)),
    ),
  ].slice(0, type === "crowllm" ? 40 : 4);
}
export function gatewayKeyName(type: GatewayType) {
  return `${GATEWAYS[type].prefix}_API_KEY`;
}
export function gatewayKeys(type: GatewayType, rotate = false) {
  // Logfare documents a single regular key; regeneration invalidates its predecessor.
  const limit = type === "logfare" ? 1 : 4;
  return rotate
    ? orderedKeys(gatewayKeyName(type), limit)
    : providerKeys(gatewayKeyName(type)).slice(0, limit);
}
export function gatewaySetup() {
  return (Object.keys(GATEWAYS) as GatewayType[]).map((type) => {
    const def = GATEWAYS[type],
      enabled = process.env[`ENABLE_${def.prefix}`] === "true",
      keyCount = gatewayKeys(type).length,
      models = gatewayModels(type),
      base = gatewayBase(type);
    const verifiedFreeModelCount =
      type === "crowllm"
        ? models.filter((model) =>
            CROWLLM_VERIFIED_FREE_CHAT_MODELS.includes(
              model as (typeof CROWLLM_VERIFIED_FREE_CHAT_MODELS)[number],
            ),
          ).length
        : null;
    const freeOnly =
      type === "crowllm" && process.env.CROWLLM_FREE_ONLY === "true";
    const policyReady =
      (type !== "logfare" || process.env.LOGFARE_DATA_POLICY_ACK === "true") &&
      (type !== "llm7" || process.env.LLM7_DOWNSTREAM_APPROVED === "true") &&
      (type !== "hms" || process.env.HMS_DATA_POLICY_ACK === "true") &&
      (type !== "crowllm" || process.env.CROWLLM_DATA_POLICY_ACK === "true");
    const status = !enabled
      ? "disabled"
      : !base
        ? "gateway URL required"
        : !keyCount
          ? "keys required"
          : !models.length
            ? "model IDs required"
            : freeOnly && verifiedFreeModelCount === 0
              ? "no verified free chat models"
              : !policyReady
                ? type === "llm7"
                  ? "downstream approval required"
                  : "data policy review required"
                : "configured";
    return {
      type,
      label: def.label,
      docs: def.docs,
      enabled,
      keyCount,
      models,
      verifiedFreeModelCount,
      status,
      ready: status === "configured",
      keyVariable: gatewayKeyName(type),
      modelVariable: `${def.prefix}_MODELS`,
      policyAckVariable:
        type === "hms"
          ? "HMS_DATA_POLICY_ACK"
          : type === "crowllm"
            ? "CROWLLM_DATA_POLICY_ACK"
            : type === "logfare"
              ? "LOGFARE_DATA_POLICY_ACK"
              : type === "llm7"
                ? "LLM7_DOWNSTREAM_APPROVED"
                : null,
      credentialLimit: type === "logfare" ? 1 : 4,
    };
  });
}
