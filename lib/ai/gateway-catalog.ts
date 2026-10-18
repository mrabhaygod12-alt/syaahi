import { createHash } from "node:crypto";
import { gatewayBase, type GatewayType } from "./gateway-config";
export interface CatalogModel {
  id: string;
  name: string;
  context_window: number;
  contextKnown: boolean;
  capabilities: string[];
  kind: "text" | "image" | "video" | "audio" | "embedding" | "unknown";
  streaming: boolean | null;
  advertisedFree: boolean | null;
  accessible: boolean | null;
  trainingConsentRequired: boolean;
}
export class GatewayModelError extends Error {}
const cached = new Map<string, { expires: number; models: CatalogModel[] }>();
const pending = new Map<string, Promise<CatalogModel[]>>();
const strings = (input: unknown): string[] =>
  Array.isArray(input)
    ? input.filter((s): s is string => typeof s === "string").slice(0, 40)
    : [];
export function normalizeCatalogModel(
  m: any,
  type: GatewayType,
): CatalogModel | null {
  if (
    !m ||
    typeof m.id !== "string" ||
    !/^[a-z0-9][a-z0-9._:/@+-]{0,159}$/i.test(m.id)
  )
    return null;
  const metadata = m.upstream_metadata || {};
  const capabilities = strings(m.capabilities ?? metadata.capabilities);
  const parameters = strings(
    m.supported_parameters ?? metadata.supported_parameters,
  );
  if (
    parameters.includes("response_format") &&
    !capabilities.includes("json_mode")
  )
    capabilities.push("json_mode");
  const output = strings(
    m.architecture?.output_modalities ??
      m.output_modalities ??
      metadata.output_modalities,
  );
  const declared = typeof m.type === "string" ? m.type.toLowerCase() : "";
  const endpoints = strings(m.endpoints);
  const kind =
    output.includes("text") ||
    ["chat", "text", "llm"].includes(declared) ||
    endpoints.includes("chat/completions")
      ? "text"
      : output.includes("image") ||
          ["image", "image_generation"].includes(declared) ||
          endpoints.some((p) => p.startsWith("images/"))
        ? "image"
        : output.includes("video") ||
            ["video", "video_generation"].includes(declared) ||
            endpoints.some((p) => p.startsWith("videos"))
          ? "video"
          : output.includes("audio") ||
              ["audio", "tts", "stt"].includes(declared) ||
              endpoints.some((p) => p.startsWith("audio/"))
            ? "audio"
            : ["embedding", "embeddings"].includes(declared) ||
                endpoints.includes("embeddings")
              ? "embedding"
              : "unknown";
  const context = Number(
    m.context_window ??
      m.context_length ??
      m.max_context_length ??
      metadata.context_length ??
      metadata.context_window,
  );
  const prices = m.pricing;
  const input = prices?.prompt ?? prices?.input_per_1k,
    completion = prices?.completion ?? prices?.output_per_1k;
  const knownPricing =
    input !== undefined &&
    input !== null &&
    completion !== undefined &&
    completion !== null &&
    Number.isFinite(Number(input)) &&
    Number.isFinite(Number(completion));
  return {
    id: m.id,
    name:
      typeof m.name === "string"
        ? m.name.slice(0, 160)
        : typeof m.display_name === "string"
          ? m.display_name.slice(0, 160)
          : m.id,
    context_window:
      Number.isFinite(context) && context > 0
        ? Math.min(2000000, Math.floor(context))
        : 8192,
    contextKnown: Number.isFinite(context) && context > 0,
    capabilities,
    kind,
    streaming:
      capabilities.includes("streaming") ||
      parameters.includes("stream") ||
      m.supports_streaming === true
        ? true
        : m.supports_streaming === false ||
            (type === "radox" && Array.isArray(m.capabilities))
          ? false
          : null,
    advertisedFree: knownPricing
      ? Number(input) === 0 && Number(completion) === 0
      : typeof m.is_free === "boolean"
        ? m.is_free
        : null,
    accessible:
      typeof m.premium_unlocked === "boolean"
        ? m.premium_unlocked
        : typeof m.accessible === "boolean"
          ? m.accessible
          : null,
    trainingConsentRequired: m.requires_training_optin === true,
  };
}
export async function gatewayCatalog(
  type: GatewayType,
  key: string,
): Promise<CatalogModel[]> {
  const base = gatewayBase(type);
  if (!base) throw new GatewayModelError("A valid gateway URL is required.");
  const fingerprint = createHash("sha256")
    .update(type + "\n" + base + "\n" + key)
    .digest("hex");
  const saved = cached.get(fingerprint);
  if (saved && saved.expires > Date.now()) return saved.models;
  const running = pending.get(fingerprint);
  if (running) return running;
  const request = (async () => {
    const response = await fetch(base + "/models", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      throw Object.assign(new Error("Gateway catalog unavailable."), {
        status: response.status,
        headers: response.headers,
      });
    const reader = response.body?.getReader();
    if (!reader) throw new GatewayModelError("Invalid gateway catalog.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.byteLength;
        if (length > 2 * 1024 * 1024)
          throw new GatewayModelError(
            "Gateway catalog exceeds the supported size.",
          );
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    let body: any;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new GatewayModelError("Invalid gateway catalog.");
    }
    if (!Array.isArray(body?.data))
      throw new GatewayModelError("Invalid gateway catalog.");
    const models: CatalogModel[] = body.data
      .slice(0, 4000)
      .map((m: unknown) => normalizeCatalogModel(m, type))
      .filter((m: CatalogModel | null): m is CatalogModel => !!m);
    if (cached.size >= 64) cached.delete(cached.keys().next().value!);
    cached.set(fingerprint, { expires: Date.now() + 300000, models });
    return models;
  })();
  pending.set(fingerprint, request);
  try {
    return await request;
  } finally {
    pending.delete(fingerprint);
  }
}
export async function gatewayModel(
  type: GatewayType,
  key: string,
  id: string,
  streaming = false,
) {
  if (type === "logfare" && ["logfare/auto", "logfare/random"].includes(id))
    throw new GatewayModelError(
      "Select a fixed non-training model for study content.",
    );
  const model = (await gatewayCatalog(type, key)).find((m) => m.id === id);
  if (!model)
    throw new GatewayModelError(
      "Configured gateway model is not in the active catalog.",
    );
  if (!["text", "unknown"].includes(model.kind))
    throw new GatewayModelError("This model is not a text generation model.");
  if (model.accessible === false)
    throw new GatewayModelError(
      "This model is not accessible with this account.",
    );
  // An operator policy acknowledgement is not student consent to train on their material.
  if (model.trainingConsentRequired)
    throw new GatewayModelError(
      "Training-opt-in models are excluded from study content.",
    );
  if (streaming && model.streaming === false)
    throw new GatewayModelError("Gateway model does not support streaming.");
  return model;
}
