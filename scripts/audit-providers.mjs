import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const providers = [
  {
    name: "groq",
    base: "https://api.groq.com/openai/v1",
    key: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
  },
  {
    name: "gemini",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    key: "GEMINI_API_KEY",
    model: "gemini-3.8-flash",
  },
  {
    name: "zen",
    base: "https://opencode.ai/zen/v1",
    key: "OPENCODE_API_KEY",
    model: "big-pickle",
  },
];
const results = await Promise.all(
  providers.map(async (p) => {
    const key = process.env[p.key];
    if (!key) return { provider: p.name, status: "not configured" };
    try {
      const t = Date.now();
      const res = await fetch(p.base + "/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: p.model,
          messages: [
            {
              role: "user",
              content:
                "Explain binary search in 3 concise accurate sentences. State its precondition.",
            },
          ],
          max_tokens: 600,
        }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await res.json();
      return {
        provider: p.name,
        model: p.model,
        status: res.status,
        ms: Date.now() - t,
        answer: res.ok ? data.choices?.[0]?.message?.content : undefined,
        error: !res.ok
          ? String(data.error?.message || "API request rejected")
              .replaceAll(key, "[redacted]")
              .slice(0, 200)
          : undefined,
      };
    } catch (e) {
      return { provider: p.name, status: "unavailable", error: e.name };
    }
  }),
);
console.log(JSON.stringify(results, null, 2));
