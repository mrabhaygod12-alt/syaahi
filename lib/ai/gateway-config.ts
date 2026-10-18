import { providerKeys, orderedKeys } from "./keys";
export const GATEWAYS = {
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
  return [
    ...new Set(
      [process.env[`${prefix}_MODEL`], process.env[`${prefix}_MODELS`]]
        .filter(Boolean)
        .join(",")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^[a-z0-9][a-z0-9._:/@+-]{0,159}$/i.test(s)),
    ),
  ].slice(0, 4);
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
    const policyReady =
      type !== "logfare" || process.env.LOGFARE_DATA_POLICY_ACK === "true";
    const status = !enabled
      ? "disabled"
      : !base
        ? "gateway URL required"
        : !keyCount
          ? "keys required"
          : !models.length
            ? "model IDs required"
            : !policyReady
              ? "data policy review required"
              : "configured";
    return {
      type,
      label: def.label,
      docs: def.docs,
      enabled,
      keyCount,
      models,
      status,
      ready: status === "configured",
      keyVariable: gatewayKeyName(type),
      modelVariable: `${def.prefix}_MODELS`,
      credentialLimit: type === "logfare" ? 1 : 4,
    };
  });
}
