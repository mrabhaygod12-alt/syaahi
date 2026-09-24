// Tier-1 live test — run with keys from .env.local, NEVER paste keys in chat.
// Usage (PowerShell):
//   $env:OPENROUTER_API_KEY="sk-or-..."; & "C:\Program Files\nodejs\node.exe" scripts/test-tier.mjs
//   or: node scripts/test-tier.mjs --key sk-or-... --models nvidia/nemotron-3-ultra-550b-a55b:free,z-ai/glm-5.2:free
// The script masks keys in output.

const DEFAULT_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "z-ai/glm-5.2:free",
  "thinkingmachines/inkling:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "openrouter/free",
];

function mask(k) {
  if (!k) return "(missing)";
  return k.length <= 8 ? "****" : k.slice(0, 4) + "…" + k.slice(-4);
}

function parseArgs() {
  const a = Object.fromEntries(
    process.argv.slice(2).map((s) => {
      const m = s.match(/^--([^=]+)=(.*)$/);
      return m ? [m[1], m[2]] : [s.replace(/^--/, ""), true];
    }),
  );
  return a;
}

const args = parseArgs();
const key = args.key || process.env.OPENROUTER_API_KEY;
const models = (args.models ? String(args.models).split(",") : DEFAULT_MODELS)
  .map((s) => s.trim())
  .filter(Boolean);
const prompt =
  args.prompt || "Explain Photosynthesis in 5 short bullets for exam revision.";

console.log(`OpenRouter key: ${mask(key)} | models: ${models.length}`);
if (!key) {
  console.error(
    "No key. Set $env:OPENROUTER_API_KEY first. Get one free (no card) at https://openrouter.ai",
  );
  process.exit(1);
}

let pass = 0;
for (const model of models) {
  const t0 = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Syaahi tier-test",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const err = await res.text().then((t) => t.slice(0, 300));
      console.log(`FAIL ${model} | HTTP ${res.status} | ${ms}ms | ${err}`);
      continue;
    }
    const j = await res.json();
    const text = j.choices?.[0]?.message?.content ?? "";
    console.log(
      `PASS ${model} | ${ms}ms | ${text.length} chars | ${text.slice(0, 120).replace(/\n/g, " ")}…`,
    );
    pass++;
  } catch (e) {
    console.log(`FAIL ${model} | ${String(e?.message).slice(0, 200)}`);
  }
}
console.log(`\n${pass}/${models.length} passed.`);
process.exit(pass ? 0 : 2);
