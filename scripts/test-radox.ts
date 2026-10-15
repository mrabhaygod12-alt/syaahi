import assert from "node:assert/strict";
async function main() {
  for (const name of Object.keys(process.env))
    if (
      /(GROQ|GEMINI|MISTRAL|CEREBRAS|OPENROUTER|OPENCODE|NVIDIA_NIM|APINEX|RADOX)_API_KEY/.test(
        name,
      )
    )
      delete process.env[name];
  Object.assign(process.env, {
    RADOX_API_KEY: "fixture-gateway-key",
    RADOX_API_KEY_1: "must-never-rotate-to-this",
    RADOX_MODEL: "fixture-model",
    ENABLE_RADOX: "false",
  });
  const { eligibleProviders } = await import("../lib/ai/providers");
  assert(!eligibleProviders().some((p) => p.type === "radox"));
  process.env.ENABLE_RADOX = "true";
  assert.equal(eligibleProviders().filter((p) => p.type === "radox").length, 1);
  const original = globalThis.fetch,
    seen: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : {}),
    );
    seen.push(headers.get("authorization") || "");
    if (url.endsWith("/models"))
      return Response.json({
        data: [
          {
            id: "fixture-model",
            context_window: 32000,
            capabilities: ["json_mode", "streaming"],
          },
        ],
      });
    if (url.endsWith("/chat/completions")) {
      const raw =
        input instanceof Request ? await input.text() : String(init?.body);
      assert.equal(JSON.parse(raw).response_format.type, "json_object");
      return Response.json({
        id: "fixture",
        object: "chat.completion",
        created: 0,
        model: "gateway-reported-fixture",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: '{"answer":"Fixture response"}',
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });
    }
    throw new Error("Unexpected fixture endpoint");
  };
  try {
    const { radoxModel } = await import("../lib/ai/radox");
    await assert.rejects(
      radoxModel("fixture-gateway-key", "not-in-catalog"),
      /active catalog/,
    );
    const { chatWithFallback } = await import("../lib/ai/router");
    const result = await chatWithFallback(
      [{ role: "user", content: "Reply with one JSON answer." }],
      { json: true, maxTokens: 100 },
    );
    assert.equal(result.model, "gateway-reported-fixture");
    assert.equal(result.provider, "radox-configured");
    assert(seen.every((key) => key === "Bearer fixture-gateway-key"));
    console.log(
      "PASS Radox: explicit opt-in, live catalog validation, JSON capability, gateway-reported identity and one-account key only. All calls use local fixtures; no live access claimed.",
    );
  } finally {
    globalThis.fetch = original;
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
