# Additional AI gateways: integration, evidence and activation

Reviewed 18 October 2026. A catalog entry is a gateway claim, not proof of upstream identity, account access, quality or continuing free availability. No new gateway credentials were supplied or used in this change. No paid generation, account creation, training consent or wallet funding was performed.

## What is implemented

Five optional text adapters now join the existing server-side router: AIHubMix, UnoRouter, Logfare, Antseed and the extended Radox integration. Notes, the presentation generation pipeline and the study assistant already use this router, so they share the adapters. This does not replace the deterministic slide templates, grounding or handwritten layout engine with arbitrary model-generated HTML.

Configuration is explicit and disabled by default. Choose up to four exact active text model IDs per gateway; each is checked against that credential's current `/models` response before inference. An inactive or media-only model cannot silently be sent a text request. Training-opt-in models are excluded even if the gateway reports account access. Missing context metadata imposes an 8K safety cap, and missing JSON/streaming/price metadata stays unknown rather than becoming an invented capability.

Up to four authorized credentials total are supported per gateway, except Logfare's single regular key. `API_KEY_1` through `API_KEY_4`, or a legacy base key plus three slots, are supported. Duplicates are removed. Normal calls distribute across that bounded pool; 401/403 can try another authorized credential. A 429 cools down the entire gateway, including its other models and keys, before fallback to another eligible provider. Credentials never multiply account quotas. Never create extra accounts to bypass limits.

Catalog requests have a ten-second timeout, a 2MB response limit, a 4,000-entry cap and a five-minute cache isolated by gateway, endpoint and hashed credential. Concurrent discovery with the same credential coalesces. Both discovery and gateway inference reject redirects. Streaming never switches providers after visible output; an interruption is reported instead of replaying the prompt.

Administrators with the users scope and a verified MFA session can inspect configuration and paginated catalogs at `/admin` via `/api/admin/providers`. This reports key counts and variable names, never values. Inspection reads metadata only; it does not run inference or prove quality. AntSeedStats is linked as analytics, not registered as an inference endpoint.

## Provider findings

| Provider     | Verified interface and useful candidates                                                                                                      | Free-access limitations / media evidence                                                                                                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AIHubMix     | OpenAI-compatible `https://aihubmix.com/v1`; free catalog lists `gemma-4-26b-a4b-it-free`, `gemini-3.8-flash-free` and other candidates.      | Current quota JSON distinguishes a 10-weighted-request unpaid trial from the general 100-request/day allowance; model weights and account eligibility matter. Image `gemini-3.1-flash-image-preview-free` and video `wan3.0-video-free` are advertised. Account inference is unverified.                       |
| UnoRouter    | OpenAI-compatible `https://api.unorouter.com/v1`; configure exact IDs from the authenticated catalog.                                         | Official pages distinguish free and paid models. A public unauthenticated catalog request returned 401. Image/video API eligibility and exact media IDs remain unverified.                                                                                                                                     |
| Radox        | `https://radoxai.com/v1`; authenticated discovery supplies active IDs, capabilities and model pricing.                                        | Free token allowance is not unlimited free inference. Labels may differ from upstream names. Multiple-account quota circumvention is prohibited. No verified image/video API contract was found in this review.                                                                                                |
| Logfare      | `https://logfare.ai/v1`; public catalog exposed `gemma-4-26b`, `logfare/auto`, and image entries including `flux-2-dev` and `sdxl-lightning`. | One regular active key; regenerating replaces it. Request logging and evaluation policies require review. Premium training-consent models are excluded by this application. Image/audio APIs are documented; `/v1/videos/generations` is documented as a long request, but no active video model was verified. |
| Antseed      | Your own gateway, normally local `http://localhost:8379/v1`, or a protected deployed HTTPS gateway; exact peer-pinned IDs are supported.      | Free offers can work without funding, while other routes require USDC. Automatic selection can include paid peers. Image APIs and two asynchronous video queue formats are documented; access, provider prices and quality need account validation.                                                            |
| AntSeedStats | Network activity and provider analytics.                                                                                                      | Not an inference service or an API-key destination for Syaahi prompts.                                                                                                                                                                                                                                         |

Primary evidence: [AIHubMix developer docs](https://aihubmix.com/developers), [free catalog](https://aihubmix.com/models/free), [current quota JSON](https://aihubmix.com/call/free_quota_config), [OpenAPI](https://aihubmix.com/openapi.json); [UnoRouter platform docs](https://unorouter.com/en/docs/platform), [catalog](https://unorouter.com/en/models); [Radox discovery](https://radoxai.com/docs/models), [terms](https://radoxai.com/terms); [Logfare API](https://logfare.ai/docs), [terms](https://logfare.ai/tos); [Antseed API](https://antseed.com/docs/gateway/api/), [model selection](https://antseed.com/docs/gateway/models/), [quickstart](https://antseed.com/docs/quickstart/); [AntSeedStats](https://antseedstats.com/).

The public Logfare catalog and AIHubMix quota JSON were retrieved without authentication. Those reads do not validate any account's ability to generate content. Catalogs and limits change; inspect them again before choosing IDs. Treat named Claude/GPT/Gemini offerings on gateways as gateway labels until upstream identity is independently established.

## Configure on Render

Use the backend environment, never `NEXT_PUBLIC_*` variables, source control or chat. `.env.example` contains the full disabled configuration. Example (keys deliberately omitted):

```dotenv
ENABLE_AIHUBMIX=true
AIHUBMIX_API_KEY_1=<authorized-server-side-key>
AIHUBMIX_API_KEY_2=<optional-authorized-key>
AIHUBMIX_API_KEY_3=<optional-authorized-key>
AIHUBMIX_API_KEY_4=<optional-authorized-key>
AIHUBMIX_MODELS=<exact-free-text-id>,<optional-second-id>
AIHUBMIX_MAX_CONTEXT=8192
```

Equivalent prefixes are `UNOROUTER`, `RADOX`, `LOGFARE` and `ANTSEED`. Legacy `RADOX_MODEL` remains accepted, alongside `RADOX_MODELS`. Logfare uses only `LOGFARE_API_KEY` and additionally requires `LOGFARE_DATA_POLICY_ACK=true` after policy review. This flag never opts the account or students into model training. Select a fixed non-training Logfare model: `logfare/auto` and `logfare/random` are excluded because their hidden routing could select a training-consent model on an already opted-in account.

Antseed also requires `ANTSEED_BASE_URL=https://your-protected-gateway.example/v1`. Localhost port 8379 is permitted only outside production. A gateway on a laptop is not reachable through Render's localhost. Production requires an HTTPS hostname without credentials, query strings or custom ports. Deploy/fund/configure that gateway separately. Apply a free-only policy or an explicit spend cap at that gateway and select peer-pinned models where appropriate.

Keep a conservative context cap until the account advertises and passes larger inputs. Free prices cannot be inferred solely from a model name or free-tier account. Use the provider's model restrictions, zero-spend policy and quota dashboard where offered. This change does not introduce a billing guarantee or a shared cross-instance quota ledger; application routing cooldowns and discovery caches are process-local. Multiple backend instances must share a provider quota gateway/limiter before scaling throughput.

Enable one provider at a time. Inspect its catalog in `/admin`, select a small number of relevant text IDs, then run a neutral low-token inference smoke only after checking eligibility and billing. `npm run audit:providers` performs real requests against configured providers; it is not a free catalog-only check. Do not run it with production student material. Compare correctness, source attribution, Hindi/English, strict PPT JSON, empty/truncated responses, latency, failure modes and actual charges before changing primary priorities. Groq and direct Gemini priorities remain intact.

## Planned image/video upgrades (not shipped here)

1. **Study illustrations first:** a separate image adapter and async job kind for cover illustrations, conceptual sketchnote decorations and PPT visuals. Render actual educational text, equations and citations with our deterministic layout engine; do not trust generated image text for factual notes.
2. **Provider contracts:** AIHubMix supports image generation and asynchronous `/v1/videos` create/status/content operations. Logfare documents images and a long synchronous video request, so a worker must isolate it. Antseed supports image generation and provider-specific video queues at `/api/v1/video/*` or `/fal/v1/video/*`, outside its `/v1` text base. Implement distinct adapters instead of assuming one common video API.
3. **Durable processing:** persist owner, provider job ID, model, prompt hash, state and retry eligibility. Use idempotency and conservative retry rules; after an ambiguous provider timeout, query job status before issuing a second generation. Include cancellation, expiry and per-user concurrency caps.
4. **Asset validation:** validate MIME type and decoded dimensions, cap bytes/duration, strip metadata, store private originals and publish only reviewed derivatives. Fetch output URLs through SSRF-safe download handling, never arbitrary client URLs or forwarded credentials.
5. **Budget and consent:** meter actual usage, keep separate media credit reservations/refunds, block paid routes unless explicitly budgeted, honor Retry-After and record data-use consent. Do not enable media models merely because they appear in a catalog.
6. **UX:** show a queued job card with progress and retry, accessible mobile previews, attribution and regeneration controls. Keep video optional until cost, queue reliability and moderation pass real account tests.

## Verification

`npm run test:gateways` uses synthetic local responses for all five adapters. It exercises disabled defaults, four-key/single-key limits, strict gateway configuration, metadata normalization, per-credential cache separation, oversized/malformed catalogs, media/access/training guards, JSON capability, 401 failover, 429 cooldown, interrupted SSE behavior, real isolated admin/MFA authorization, paginated inspection and secret redaction. CI runs it alongside the Radox and existing presentation/student/admin tests.

The production admin browser regression covers catalog pagination, errors and layout at 320/390/768/1440px using synthetic metadata. No test claims newly configured live-provider inference or a quality benchmark.
