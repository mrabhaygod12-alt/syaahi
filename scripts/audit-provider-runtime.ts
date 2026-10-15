import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { eligibleProviders, PROVIDER_BASE_URL, providerEnvKey } =
    await import("../lib/ai/providers");
  const { providerKeys } = await import("../lib/ai/keys");
  const { radoxModel } = await import("../lib/ai/radox");
  const byType = new Map<
    string,
    ReturnType<typeof eligibleProviders>[number]
  >();
  for (const p of eligibleProviders().sort((a, b) => a.priority - b.priority))
    if (!byType.has(p.type)) byType.set(p.type, p);
  const candidates = [...byType.values()];
  const results = await Promise.all(
    candidates.map(async (p) => {
      const key =
        p.type === "radox"
          ? process.env.RADOX_API_KEY!.trim()
          : providerKeys(providerEnvKey(p.type))[0];
      const start = Date.now();
      try {
        if (p.type === "radox") await radoxModel(key, p.model);
        const response = await fetch(
          PROVIDER_BASE_URL[p.type] + "/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: p.model,
              messages: [
                {
                  role: "user",
                  content:
                    "In one sentence, state the prerequisite for binary search.",
                },
              ],
              max_tokens: 600,
            }),
            signal: AbortSignal.timeout(30000),
          },
        );
        const body = await response.json().catch(() => ({}));
        const answer = body.choices?.[0]?.message?.content;
        return {
          provider: p.type,
          configuredModel: p.model,
          reportedModel: response.ok ? body.model : undefined,
          status: response.status,
          ms: Date.now() - start,
          usableResponse:
            response.ok && typeof answer === "string" && answer.length > 10,
        };
      } catch {
        return {
          provider: p.type,
          configuredModel: p.model,
          status: "unavailable",
          ms: Date.now() - start,
        };
      }
    }),
  );
  console.log(
    JSON.stringify(
      {
        scope:
          "Local configured credentials; hosted environment may differ. Neutral smoke, not a quality benchmark.",
        radoxConfigured: Boolean(process.env.RADOX_API_KEY),
        radoxEnabled: process.env.ENABLE_RADOX === "true",
        results,
      },
      null,
      2,
    ),
  );
}
main().catch(() => {
  console.error("Provider audit could not complete. No credentials printed.");
  process.exit(1);
});
