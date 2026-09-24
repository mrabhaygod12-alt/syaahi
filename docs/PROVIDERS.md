# Provider integration and access

Reviewed against public documentation on 24 September 2026. Public catalog entries do not prove account access, upstream model identity or permanent free capacity.

## APInex

The [official setup page](https://apinex.bond/docs) specifies `https://api.apinex.bond/v1`, correcting the previous application base URL. Its [catalog](https://apinex.bond/models) lists `free/glm-5.3-flash`, `free/deepseek-v4.1-flash` and `free/mimo-v2.6-pro` as free entries; they are now available in the application catalog. `free/muse-spark-1.3` and several other entries are subscription-only despite the free prefix, so they are not in the free route.

The setup page advertises 5 RPM on the free tier and 30 RPM for subscribers. Account terms and current response headers take precedence. Model names are APInex's assertions. No independent upstream identity verification has been performed.

Configure `APINEX_API_KEY` (or authorised `_1` through `_6` slots) and explicitly set `ENABLE_APINEX=true` after reviewing its privacy and service terms. Secrets belong on Render, never in the frontend bundle. A credential-bearing live probe was blocked by automatic approval review in this session, so live APInex inference is unverified.

## OpenCode Zen

[Zen documentation](https://opencode.ai/docs/zen/) lists `space-bunny-free`, `mimo-v2.6-flash-free` and `big-pickle` on the chat-completions endpoint. These are limited-time offerings. The application supports these exact IDs via `https://opencode.ai/zen/v1`; set `OPENCODE_API_KEY` and `ENABLE_ZEN_API=true` only for eligible account access.

The prior account probe returned a client-only free-tier denial. No client impersonation or restriction bypass is implemented. A current live probe was not completed. Free access must not underwrite a guaranteed commercial margin. Review each model's data-use terms; several free providers can use submitted content for improvement.

## Routing and reliability

Groq and direct Gemini remain the primary routes. Only configured and enabled integrations are eligible. The router limits actual calls to five attempts within its overall budget; skipped unavailable providers no longer consume an attempt. Provider cooldowns respect quota failures. Credential slots are not a quota multiplier.

Before production promotion, run a small non-sensitive evaluation covering factual correctness, diagrams, structured answers, refusal/error behaviour, latency and account billing. Keep a paid-capacity budget and a user-visible queue when free allowances are exhausted.
