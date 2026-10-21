import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GATEWAYS,
  gatewayBase,
  gatewayKeys,
  gatewaySetup,
  type GatewayType,
} from "../lib/ai/gateway-config";
import { eligibleProviders } from "../lib/ai/providers";
import {
  gatewayCatalog,
  gatewayModel,
  normalizeCatalogModel,
} from "../lib/ai/gateway-catalog";

const originalFetch = globalThis.fetch;
const types = Object.keys(GATEWAYS) as GatewayType[];
function clear() {
  for (const name of Object.keys(process.env)) {
    if (
      /_API_KEY(?:_\d+)?$/.test(name) ||
      /^(ENABLE_(RADOX|AIHUBMIX|UNOROUTER|LOGFARE|ANTSEED|LLM7)|(?:RADOX|AIHUBMIX|UNOROUTER|LOGFARE|ANTSEED|LLM7)_(MODEL|MODELS|BASE_URL|DATA_POLICY_ACK|FREE_ONLY|DOWNSTREAM_APPROVED))$/.test(
        name,
      )
    )
      delete process.env[name];
  }
}
function enable(type: GatewayType, suffix: string, model = "fixture-text") {
  const prefix = GATEWAYS[type].prefix;
  process.env[`ENABLE_${prefix}`] = "true";
  process.env[`${prefix}_API_KEY`] = `${type}-${suffix}-key`;
  process.env[`${prefix}_MODELS`] = model;
  if (type === "antseed")
    process.env.ANTSEED_BASE_URL = "https://gateway.example.test/v1";
  if (type === "logfare") process.env.LOGFARE_DATA_POLICY_ACK = "true";
  if (type === "llm7") process.env.LLM7_DOWNSTREAM_APPROVED = "true";
}
function request(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  return {
    url: String(input instanceof Request ? input.url : input),
    key:
      new Headers(
        init?.headers || (input instanceof Request ? input.headers : {}),
      ).get("authorization") || "",
    body: async () =>
      JSON.parse(
        input instanceof Request ? await input.text() : String(init?.body),
      ),
  };
}
const catalog = () =>
  Response.json({
    data: [
      {
        id: "fixture-text",
        type: "text",
        context_window: 32000,
        capabilities: ["json_mode", "streaming"],
      },
    ],
  });
const answer = () =>
  Response.json({
    id: "fixture",
    object: "chat.completion",
    model: "gateway-reported-fixture",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: '{"answer":"Fixture"}' },
      },
    ],
  });
async function main() {
  clear();
  for (const type of types) {
    enable(type, "config");
    const prefix = GATEWAYS[type].prefix;
    for (let i = 1; i <= 6; i++)
      process.env[`${prefix}_API_KEY_${i}`] = `${type}-slot-${i}`;
    assert.equal(gatewayKeys(type).length, type === "logfare" ? 1 : 4);
    process.env[`ENABLE_${prefix}`] = "false";
  }
  assert.equal(eligibleProviders().length, 0, "No implicit gateway opt-in");
  process.env.ENABLE_LOGFARE = "true";
  delete process.env.LOGFARE_DATA_POLICY_ACK;
  assert.equal(
    gatewaySetup().find((p) => p.type === "logfare")!.status,
    "data policy review required",
  );
  assert.equal(eligibleProviders().length, 0);
  for (const url of [
    "http://example.test/v1",
    "https://127.0.0.1/v1",
    "https://user:pass@example.test/v1",
    "https://example.test/v1?key=hidden",
    "https://example.test/wrong",
    "https://example.test:444/v1",
  ]) {
    process.env.ANTSEED_BASE_URL = url;
    assert.equal(gatewayBase("antseed"), "", url);
  }
  process.env.ANTSEED_BASE_URL = "https://gateway.example.test/v1/";
  assert.equal(gatewayBase("antseed"), "https://gateway.example.test/v1");
  const previousNodeEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "production";
  process.env.ANTSEED_BASE_URL = "http://localhost:8379/v1";
  assert.equal(gatewayBase("antseed"), "");
  if (previousNodeEnv === undefined) delete (process.env as any).NODE_ENV;
  else (process.env as any).NODE_ENV = previousNodeEnv;

  assert.equal(normalizeCatalogModel({ id: "bad\nheader" }, "radox"), null);
  const image = normalizeCatalogModel(
    {
      id: "fixture-image",
      endpoints: ["images/generations"],
      premium_unlocked: false,
    },
    "logfare",
  )!;
  assert.equal(image.kind, "image");
  assert.equal(image.accessible, false);
  assert.equal(image.contextKnown, false);
  assert.equal(image.context_window, 8192);
  assert.equal(image.advertisedFree, null);
  assert.equal(
    normalizeCatalogModel(
      { id: "fixture-video", output_modalities: ["video"] },
      "aihubmix",
    )!.kind,
    "video",
  );
  assert.equal(
    normalizeCatalogModel(
      { id: "fixture-free", pricing: { prompt: "0", completion: "0" } },
      "unorouter",
    )!.advertisedFree,
    true,
  );
  assert.equal(
    normalizeCatalogModel(
      { id: "fixture-paid", pricing: { input_per_1k: 0.1, output_per_1k: 0 } },
      "radox",
    )!.advertisedFree,
    false,
  );
  let catalogs = 0;
  globalThis.fetch = async () => {
    catalogs++;
    return catalog();
  };
  await Promise.all([
    gatewayCatalog("aihubmix", "cache-a"),
    gatewayCatalog("aihubmix", "cache-a"),
  ]);
  assert.equal(catalogs, 1, "Concurrent discovery coalesces per credential");
  await gatewayCatalog("aihubmix", "cache-b");
  assert.equal(catalogs, 2, "Account catalogs never share a cache entry");
  globalThis.fetch = async () =>
    Response.json({
      data: [
        { id: "image", endpoints: ["images/generations"] },
        {
          id: "locked",
          endpoints: ["chat/completions"],
          premium_unlocked: false,
        },
        {
          id: "training",
          endpoints: ["chat/completions"],
          premium_unlocked: true,
          requires_training_optin: true,
        },
        { id: "no-stream", type: "text", supports_streaming: false },
      ],
    });
  await assert.rejects(
    gatewayModel("logfare", "catalog-guards", "missing"),
    /active catalog/,
  );
  await assert.rejects(
    gatewayModel("logfare", "catalog-guards", "image"),
    /not a text/,
  );
  await assert.rejects(
    gatewayModel("logfare", "catalog-guards", "locked"),
    /not accessible/,
  );
  await assert.rejects(
    gatewayModel("logfare", "catalog-guards", "training"),
    /Training-opt-in/,
  );
  await assert.rejects(
    gatewayModel("logfare", "catalog-guards", "logfare/auto"),
    /fixed non-training/,
  );
  await assert.rejects(
    gatewayModel("logfare", "catalog-guards", "no-stream", true),
    /streaming/,
  );
  globalThis.fetch = async () => Response.json({ data: { invalid: true } });
  await assert.rejects(
    gatewayCatalog("aihubmix", "malformed"),
    /Invalid gateway catalog/,
  );
  globalThis.fetch = async () => new Response(" ".repeat(2 * 1024 * 1024 + 1));
  await assert.rejects(gatewayCatalog("aihubmix", "oversized"), /exceeds/);

  const { chatWithFallback, chatStreamWithFallback } =
    await import("../lib/ai/router");
  const prompt = [
    { role: "user" as const, content: "Return one short fixture answer." },
  ];
  for (const type of types) {
    clear();
    enable(type, "roundrobin");
    for (let i = 1; i < 4; i++)
      process.env[`${GATEWAYS[type].prefix}_API_KEY_${i}`] =
        `${type}-spare-${i}`;
    const used = new Set<string>();
    globalThis.fetch = async (input, init) => {
      const r = request(input, init);
      if (r.url.endsWith("/models")) return catalog();
      assert.equal(r.url, gatewayBase(type) + "/chat/completions");
      assert.equal((await r.body()).response_format.type, "json_object");
      used.add(r.key);
      return answer();
    };
    for (let i = 0; i < (type === "logfare" ? 1 : 4); i++) {
      const result = await chatWithFallback(prompt, {
        json: true,
        maxTokens: 100,
      });
      assert.equal(result.provider, `${type}-configured`);
      assert.equal(result.model, "gateway-reported-fixture");
    }
    assert.equal(
      used.size,
      type === "logfare" ? 1 : 4,
      `${type} authorized key pool`,
    );
  }
  clear();
  enable("radox", "invalid-model", "not-active,fixture-text");
  let inference = 0;
  globalThis.fetch = async (input, init) => {
    const r = request(input, init);
    if (r.url.endsWith("/models")) return catalog();
    inference++;
    assert.equal((await r.body()).model, "fixture-text");
    return answer();
  };
  assert.equal((await chatWithFallback(prompt)).provider, "radox-configured-2");
  assert.equal(
    inference,
    1,
    "Invalid model does not cool down every model at the gateway",
  );
  clear();
  enable("radox", "unauthorized");
  process.env.RADOX_API_KEY_1 = "radox-valid-spare";
  globalThis.fetch = async (input, init) => {
    const r = request(input, init);
    if (r.key.endsWith("unauthorized-key"))
      return Response.json({ error: "fixture denial" }, { status: 401 });
    if (r.url.endsWith("/models")) return catalog();
    assert.equal(r.key, "Bearer radox-valid-spare");
    return answer();
  };
  assert.equal(
    (await chatWithFallback(prompt)).provider,
    "radox-configured",
    "401 tries another authorized key",
  );

  clear();
  enable("radox", "retired", "fixture-retired,fixture-active");
  globalThis.fetch = async (input, init) => {
    const r = request(input, init);
    if (r.url.endsWith("/models"))
      return Response.json({
        data: ["fixture-retired", "fixture-active"].map((id) => ({
          id,
          type: "text",
          context_window: 32000,
        })),
      });
    return (await r.body()).model === "fixture-retired"
      ? Response.json({ error: "retired" }, { status: 400 })
      : answer();
  };
  assert.equal(
    (await chatWithFallback(prompt)).provider,
    "radox-configured-2",
    "A bad model does not disable sibling models",
  );

  clear();
  enable("aihubmix", "quota-text");
  enable("unorouter", "quota-text-fallback");
  let softFailures = 0;
  globalThis.fetch = async (input, init) => {
    const r = request(input, init);
    if (r.url.endsWith("/models")) return catalog();
    if (r.url.startsWith(gatewayBase("aihubmix"))) {
      softFailures++;
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                "Sorry, to prevent abuse of free resources, accounts that have not been recharged can only try 10 times.",
            },
          },
        ],
      });
    }
    return answer();
  };
  assert.equal(
    (await chatWithFallback(prompt)).provider,
    "unorouter-configured",
  );
  assert.equal(
    (await chatWithFallback(prompt)).provider,
    "unorouter-configured",
  );
  assert.equal(
    softFailures,
    1,
    "HTTP 200 quota warnings cause fallback and provider cooldown",
  );

  clear();
  enable("llm7", "capacity");
  let release!: () => void,
    inFlight = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async (input, init) => {
    const r = request(input, init);
    if (r.url.endsWith("/models")) return catalog();
    if (r.url.startsWith(gatewayBase("llm7"))) {
      inFlight++;
      await gate;
    }
    return answer();
  };
  const pendingCalls = [chatWithFallback(prompt), chatWithFallback(prompt)];
  try {
    for (let n = 0; n < 100 && inFlight < 2; n++)
      await new Promise((resolve) => setTimeout(resolve, 2));
    assert.equal(inFlight, 2);
    enable("unorouter", "capacity-fallback");
    assert.equal(
      (await chatWithFallback(prompt)).provider,
      "unorouter-configured",
      "Saturated providers shed load to another provider",
    );
  } finally {
    release();
  }
  await Promise.all(pendingCalls);

  clear();
  enable("llm7", "stream");
  enable("unorouter", "fallback");
  let streamCalls = 0;
  globalThis.fetch = async (input, init) => {
    const r = request(input, init);
    if (r.url.endsWith("/models")) return catalog();
    streamCalls++;
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"id":"fixture","choices":[{"delta":{"content":"Partial answer"}}]}\n\n',
            ),
          );
          setTimeout(
            () => controller.error(new Error("Fixture disconnect")),
            5,
          );
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );
  };
  const events = [];
  for await (const event of chatStreamWithFallback(prompt)) events.push(event);
  assert(events.some((e) => e.t === "Partial answer"));
  assert(events.some((e) => e.error?.includes("connection ended")));
  assert.equal(
    streamCalls,
    1,
    "No replay to another gateway after visible output",
  );

  clear();
  enable("radox", "quota");
  enable("unorouter", "quota-fallback");
  process.env.RADOX_API_KEY_1 = "quota-must-not-hop";
  let quotaCalls = 0;
  globalThis.fetch = async (input, init) => {
    const r = request(input, init);
    if (r.url.startsWith(gatewayBase("radox"))) {
      quotaCalls++;
      return Response.json(
        { error: "fixture quota" },
        { status: 429, headers: { "retry-after": "65" } },
      );
    }
    return r.url.endsWith("/models") ? catalog() : answer();
  };
  assert.equal(
    (await chatWithFallback(prompt)).provider,
    "unorouter-configured",
  );
  assert.equal(
    (await chatWithFallback(prompt)).provider,
    "unorouter-configured",
  );
  assert.equal(
    quotaCalls,
    1,
    "429 cools down gateway, including catalog; no quota key hopping",
  );

  // Route authorization is tested against real isolated sessions and MFA state, never hosted accounts.
  Object.assign(process.env, {
    DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-gateways-")),
    DATA_BACKEND: "sqlite",
    MONGODB_URI: "",
    APP_ROLE: "all",
    ADMIN_EMAILS: "gateway-admin@example.test",
    ADMIN_MFA_ENFORCE: "1",
    ADMIN_MFA_KEY: Buffer.alloc(32, 9).toString("base64"),
    WORKER_MODE: "external",
  });
  clear();
  enable("aihubmix", "admin");
  const auth = await import("../lib/auth/server"),
    mfa = await import("../lib/auth/admin-mfa");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  const { GET } = await import("../app/api/admin/providers/route");
  const admin = await auth.register(
    "Admin",
    "gateway-admin@example.test",
    "fixture-long-password",
  );
  await markEmailVerified(admin.id);
  const cookie = (
    await auth.startSession(admin, new Request("https://www.syaahii.in"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const req = (query = "", signedIn = true) =>
    new Request("https://www.syaahii.in/api/admin/providers" + query, {
      headers: signedIn ? { cookie } : {},
    });
  assert.equal((await GET(req("", false))).status, 403);
  assert.equal(
    (await GET(req())).status,
    403,
    "Eligible admin still needs MFA",
  );
  const user = (await auth.currentUser(req()))!;
  const setup = await mfa.beginMfa(user, req(), "fixture-long-password");
  await mfa.confirmMfa(user, req(), setup.id, mfa.totp(setup.secret));
  const configuration = await GET(req());
  assert.equal(configuration.status, 200);
  assert(
    !JSON.stringify(await configuration.json()).includes("aihubmix-admin-key"),
  );
  assert.equal((await GET(req("?provider=antseedstats"))).status, 400);
  assert.equal((await GET(req("?provider=aihubmix&offset=-1"))).status, 400);
  globalThis.fetch = async () =>
    Response.json({
      data: Array.from({ length: 55 }, (_, i) => ({
        id: `fixture-${i}`,
        type: "text",
      })),
    });
  const page = await (await GET(req("?provider=aihubmix"))).json();
  assert.equal(page.models.length, 50);
  assert.equal(page.nextOffset, 50);
  const last = await (await GET(req("?provider=aihubmix&offset=50"))).json();
  assert.equal(last.models.length, 5);
  assert.equal(last.nextOffset, null);
  enable("logfare", "secret-redaction");
  globalThis.fetch = async () => {
    throw new Error("Bearer logfare-secret-redaction-key private details");
  };
  const failed = await GET(req("?provider=logfare"));
  assert.equal(failed.status, 502);
  assert(!JSON.stringify(await failed.json()).includes("secret-redaction-key"));
  clear();
  enable("llm7", "approval-guard");
  delete process.env.LLM7_DOWNSTREAM_APPROVED;
  assert.equal(eligibleProviders().length, 0, "embedded use requires downstream approval");
  assert.equal(gatewaySetup().find(p => p.type === "llm7")!.status, "downstream approval required");
  clear();
  process.env.UNOROUTER_FREE_ONLY = "true";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/models")) return Response.json({data:[{id:"free-accessible"},{id:"unknown-price"}]});
    assert.equal(url, "https://api.unorouter.com/api/pricing/catalog");
    assert.equal(new Headers(init?.headers).get("authorization"), null, "public metadata never receives a credential");
    return Response.json({models:[
      {model_name:"free-accessible",type:"text",is_free:true,online:true,own_purpose:{consent_required:false}},
      {model_name:"not-in-account",type:"text",is_free:true,online:true},
    ]});
  };
  const enriched = await gatewayCatalog("unorouter", "metadata-fixture-only");
  assert.equal(enriched.length,2,"metadata cannot add catalog access");
  assert.equal((await gatewayModel("unorouter","metadata-fixture-only","free-accessible")).advertisedFree,true);
  await assert.rejects(gatewayModel("unorouter","metadata-fixture-only","unknown-price"),/not verified as free/);
  await assert.rejects(gatewayModel("unorouter","metadata-fixture-only","not-in-account"),/active catalog/);
  console.log(
    "PASS gateways: six adapters, explicit opt-in, bounded key pools, catalog isolation/validation, media/training guards, structured output, 401 failover, 429 cooldown, per-model isolation, bounded in-flight requests, 200 quota rejection, interrupted stream safety, MFA-protected paginated catalog and secret redaction. Fixtures only; no live inference.",
  );
}
main()
  .finally(() => {
    globalThis.fetch = originalFetch;
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
