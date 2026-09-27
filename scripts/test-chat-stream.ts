import assert from "node:assert/strict";

async function main() {
  const names = [
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "MISTRAL_API_KEY",
    "CEREBRAS_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENCODE_API_KEY",
    "NVIDIA_NIM_API_KEY",
    "DEEPSEEK_API_KEY",
    "APINEX_API_KEY",
  ];
  for (const key of Object.keys(process.env))
    if (names.some((name) => key === name || key.startsWith(`${name}_`)))
      delete process.env[key];
  process.env.GROQ_API_KEY = "stream-test-key";

  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  globalThis.fetch = (async () => {
    const frames = [
      {
        id: "chatcmpl-test",
        object: "chat.completion.chunk",
        created: 1,
        model: "openai/gpt-oss-120b",
        choices: [
          { index: 0, delta: { content: "A streamed " }, finish_reason: null },
        ],
      },
      {
        id: "chatcmpl-test",
        object: "chat.completion.chunk",
        created: 1,
        model: "openai/gpt-oss-120b",
        choices: [
          { index: 0, delta: { content: "answer." }, finish_reason: null },
        ],
      },
      {
        id: "chatcmpl-test",
        object: "chat.completion.chunk",
        created: 1,
        model: "openai/gpt-oss-120b",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      },
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
          );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }) as typeof fetch;

  try {
    const { chatStreamWithFallback } = await import("../lib/ai/router");
    const events = [];
    for await (const event of chatStreamWithFallback([
      { role: "user", content: "Explain one concept." },
    ]))
      events.push(event);
    assert.equal(
      events.map((event) => event.t || "").join(""),
      "A streamed answer.",
      JSON.stringify(events),
    );
    assert.equal(events[0]?.provider, "groq-120b");
    assert.equal(events[0]?.model, "openai/gpt-oss-120b");
    assert.equal(
      events.some((event) => event.error),
      false,
    );
    let interruptedRequests = 0;
    globalThis.fetch = (async () => {
      interruptedRequests++;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"content":"Partial answer"}}]}\n\n',
              ),
            );
            setTimeout(
              () => controller.error(new Error("Connection interrupted")),
              10,
            );
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }) as typeof fetch;
    const interrupted = [];
    for await (const event of chatStreamWithFallback([
      { role: "user", content: "Explain a concept." },
    ]))
      interrupted.push(event);
    assert.equal(
      interruptedRequests,
      1,
      "Do not replay a partially visible answer through another provider",
    );
    assert.equal(interrupted[0].t, "Partial answer");
    assert.match(interrupted.at(-1)?.error || "", /incomplete/);
    console.log(
      "PASS chat router forwards model tokens incrementally over SSE.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
