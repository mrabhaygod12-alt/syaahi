/** Radox is a third-party gateway; its labels are not upstream identity attestations. */
export interface GatewayModel {
  id: string;
  context_window: number;
  capabilities: string[];
}
let cached:
  { key: string; expires: number; models: GatewayModel[] } | undefined;
let pending: Promise<GatewayModel[]> | undefined;
export async function radoxModels(key: string): Promise<GatewayModel[]> {
  if (cached?.key === key && cached.expires > Date.now()) return cached.models;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch("https://radoxai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok)
      throw Object.assign(new Error("Gateway model catalog unavailable"), {
        status: response.status,
      });
    const body = await response.json();
    if (!Array.isArray(body.data))
      throw new Error("Invalid gateway model catalog");
    const models = body.data
      .filter(
        (m: any) => typeof m.id === "string" && Array.isArray(m.capabilities),
      )
      .map((m: any) => ({
        id: m.id,
        context_window: Number(m.context_window) || 8192,
        capabilities: m.capabilities.filter(
          (c: unknown) => typeof c === "string",
        ),
      }));
    cached = { key, models, expires: Date.now() + 300000 };
    return models;
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
export async function radoxModel(key: string, id: string, streaming = false) {
  const model = (await radoxModels(key)).find((m) => m.id === id);
  if (!model)
    throw new Error("Configured gateway model is not in the active catalog");
  if (streaming && !model.capabilities.includes("streaming"))
    throw new Error("Gateway model does not support streaming");
  return model;
}
