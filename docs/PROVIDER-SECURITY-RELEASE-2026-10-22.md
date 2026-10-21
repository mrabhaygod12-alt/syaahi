# Provider activation and security remediation — 22 October 2026

## Actual account tests

One key each was supplied for UnoRouter, Radox and AIHubMix; keys are outside the repository and were configured through the Render Environment UI before pushing code. No keys were supplied for Logfare/LLM7; no Antseed gateway was supplied. Four-key authorized pools are supported except Logfare (one current regular key). Shared account quotas are not multiplied by rotating keys; quota/429/402 cooldowns apply to the provider, and model rejection applies only to that model. Per-process provider concurrency defaults to two, with bounded response bodies and request deadlines. This is graceful overload handling, not an unlimited traffic guarantee. Multiple processes still require infrastructure capacity planning and shared budgets.

| Provider | Actual evidence | Activation |
|---|---|---|
| UnoRouter | Keyed models 200; intersection with official free pricing catalog; diffusiongemma-26b-a4b-it:free valid JSON completion and full local six-slide research → storyboard → slots → editorial → PPTX/PDF/PNG export passed | Enabled; conservative 8192 context because keyed metadata does not declare it |
| Radox | Keyed catalog 200, completion 402 insufficient_quota | Key/model prepared, disabled |
| AIHubMix | Keyed catalog 200, free model metadata available; completion returned HTTP 200 containing an unpaid-account trial quota warning | Key/models prepared, disabled; router rejects this warning as quota failure |
| Logfare | Public catalog read; training-opt-in models excluded | Key and data-policy acknowledgement pending |
| LLM7 | Public catalog read; upstream terms require prior written approval for embedded/downstream access | Adapter disabled; key and LLM7_DOWNSTREAM_APPROVED=true required after approval |
| Antseed | Existing configurable gateway adapter | Requires operator gateway and funding/access; not a free hosted inference endpoint |

Radox's 10M monthly allowance is an account token quota, not per-request context. Model names and context values are provider declarations, not proof of underlying upstream identity or successful capacity. AIHubMix public metadata is restricted to IDs actually returned for the key. Unknown/paid models cannot enter free-only pools. Consent-required models are excluded. Fixed public metadata calls receive no API credential. Media models stay outside the text router; no image/video generation capability is claimed solely from a catalog listing.

UnoRouter live evidence: ignored local `output/unorouter-presentation-live.log`, `output/live-audit/hybrid-live/deck.pptx`, `deck.pdf`, and slide PNGs. It used a public About source and a local fixture wallet, not a customer's account or live billing. The extraction token budget now scales to requested passages instead of requiring an unconditional 8000-output budget, allowing honest use of smaller-context fallback models.

Official references: https://unorouter.com/en/docs/platform/platform-api , https://radoxai.com/docs/models , https://radoxai.com/pricing , https://aihubmix.com/developers , https://aihubmix.com/api/v1/models , https://logfare.ai/docs , https://github.com/chigwell/llm7.io/blob/main/TERMS.md , https://antseed.com/docs/gateway/api/ . Availability and quotas may change.

## Screenshot report: what was fixed and what remains

- **F1 revision/header fingerprinting:** revision headers now expose 12-character deployment correlation IDs instead of full commit SHAs. An empty X-Render-Origin-Server response header is configured. Hosted verification must establish whether the platform still appends its own header; a CDN transform may still be required.
- **F2 anonymous generation:** non-sample guest generation is capped at 3 per IP/day and a shared default global 20/day budget. Cached university samples remain available; generation coalescing and existing throttles remain.
- **F3 analytics:** existing 204 anonymous endpoint behavior was already a no-op without a measurement cookie, and event names were allowlisted. A timestamped HMAC consent proof now prevents fabricated plain cookies from authorizing ingestion. Extra fields/invalid events are rejected. This is pollution resistance, not proof a browser event represents a human.
- **F4 wildcard DNS:** no DNS change was made. Removing wildcard records requires the DNS owner to confirm intended subdomains. Application-level unknown-host behavior is not a DNS fix.
- **F5 enumeration:** incorrect passwords and unknown emails return identical 401 messages; duplicate signup returns a generic receipt without a session. A correct password for an unverified account may still show a verification-required message, without echoing the submitted email. Correct-password writer enrollment remains supported.
- **F6 brute force:** per-IP/email five-attempt/15-minute login throttle supplements the existing IP throttle; unknown users perform a dummy password derivation.
- **F7 health:** minimal public `{ok:true}` liveness remains for deployment health probes. It does not expose dependencies/credentials.
- **F8 Supabase project reference:** a public OAuth project URL/publishable key is not an authentication credential. No private key is exposed by this flow.
- **F9 verification:** when local password credentials match, authoritative Supabase getUser confirmation for the same email can synchronize local verified status. Browser-submitted JWT/email claims are never accepted as evidence. Native signup resend is a fallback when the application mail transport is absent/fails. End-to-end external inbox delivery still needs operational verification; no claim that every mail delivery issue is solved.

Test evidence: auth, security/boundaries, new report regressions, OAuth identity, security remediation, gateways, growth in SQLite/Mongo, writer platform in SQLite/Mongo and hybrid presentations in SQLite/Mongo passed. The new report tests verify native identity mismatch/unconfirmed rejection and forged analytics consent. Build/browser/deployment results are recorded in the final release response. No system can guarantee every possible web attack is impossible.

Later AI Ink live rewrite probes on the same UnoRouter account timed out. The earlier full presentation pass remains valid evidence of that run, not continuous availability. Production provider health must be observed after deployment; no unlimited or always-available inference promise is made.

## Dependency follow-up

The production audit identified `follow-redirects` 1.16.0 (through Razorpay/axios and also the Mongo test harness). Updated the lockfile to patched 1.16.1 for GHSA-q3jh-wrc6-jgq8 and GHSA-8r9p-f939-6h3c. A local two-server redirect regression verified that array-form Authorization/Cookie and regex-special custom credential headers are stripped across origins. `npm audit --omit=dev` reports zero known vulnerabilities after the update; this does not certify the absence of application vulnerabilities.

The captured-payment/ownership regression passed. The separate configured Razorpay checkout smoke reached the provider but returned 401 merchant authentication; no customer payment was made. Merchant credential/configuration repair is still required and is not attributed to the dependency patch.
