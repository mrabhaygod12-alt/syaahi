# Approved redesign and security hardening

Implementation record for the approved `REDESIGN-PROPOSAL.md`, 16 October 2026. This document describes code and test scope; deployment evidence must be recorded separately after pushing the commit.

## Delivered in this change

- New handwritten notebook web view, default pastel sketchnote rendering, optional blue-pen and Cornell compositions, shared PDF styles and saved appearance with owner and revision checks. Existing saved templates and accessible reading preferences remain readable.
- Simpler student Home, primary study navigation, settings under More tools, Continue learning and actual notebook text excerpts. These excerpts are real saved text, not first-page raster thumbnails.
- Shared login/signup/recovery/verification shell. Course setup moves out of signup. Verification respects the authoritative account workspace. Authentication handlers, required consent, enrollment and MFA remain enforced.
- Compact application footer, calmer profile forms and shared practice typography. Public pages retain the full footer. Shared styles improve route families; this is not an individual redesign or exhaustive visual review of all 108 page files.
- Responsive illustrative laptop/phone walkthrough, native scroll progression, keyboard controls and reduced-motion fallback.
- Optional post-lesson feedback prompt and feedback categories. AI wording assistance uses only the user's written feedback, requires eligibility, returns a proposal and never submits it automatically. Applying a proposal requires renewed public consent.
- Bounded lesson loads, visible progress-save failures, redacted crash states and actionable not-found pages.
- Removed three unreferenced legacy promotional components and the unused workspace template setter. Legacy templates and user CSV reports are deliberately retained.

The exact shared design rules are in `DESIGN_SYSTEM.md`. The proposal's larger source drawer, dedicated planner side-panel, real library page thumbnails and every remaining route-specific polish item are not claimed complete by this change. Existing source, planner, chat, pricing, writer and admin functions remain available and are covered by their regression suites where applicable.

## Request and security boundaries

| Area           | Protection and practical limit                                                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request bodies | Actual streamed-byte validation, declared-length validation and upload deadlines. Auth and review submission JSON: 64KiB; other JSON: 2MiB; multipart: 12MiB. Deadlines: 10s JSON, 30s multipart. Route-specific validation can be stricter.             |
| Overload       | Per-process admission cap, default 32, configurable through `API_MAX_IN_FLIGHT` from 4 to 256. Rejects excess work with 503 and Retry-After. Health bypasses the cap. This counts handler execution, not the lifetime of an outgoing streaming response. |
| CSRF           | Existing Origin/fetch-metadata checks plus Referer-origin validation when Origin is absent. Cookie policies and existing protected-route checks remain active.                                                                                           |
| XSS            | Typed/escaped notebook content, template/font/paper allowlists, sandboxed print frame and CSP restrictions. Inline scripts remain allowed for existing Next hydration and print infrastructure; this is not a nonce-based strict CSP.                    |
| Isolation      | Notebook appearance is owner-only, rejects stale writes and derives variation seed server-side. Existing role checks, writer enrollment, admin MFA, SSRF protections and upload rules remain active.                                                     |
| Errors         | Responses carry request IDs and avoid leaking stack traces or credentials. Infrastructure failures use a retryable service response. UI preserves last loaded notes when a refresh fails. Writes are not blindly retried.                                |

No software change can guarantee that every web attack is eliminated. These controls reduce specific risks; body limits do not establish protection against every memory-safety flaw in Node, Chromium or native dependencies. Keep runtimes and native dependencies patched.

## Hosting and capacity recommendations

1. Production Render was last observed on a sleeping Free instance with an embedded worker. This commit does not purchase capacity or change that plan. An always-on API and separate worker are the first operational improvement when a paid deployment is authorised.
2. The existing `render.yaml` describes paid API/worker services. Review cost and environment-group configuration before applying it. Do not treat its existence as proof those services are running.
3. Horizontal balancing requires hosting replicas/ingress, shared Mongo state, shared job leases and controlled load testing. The new admission cap is load shedding, not a load balancer. In-process provider breakers and counters are not global across replicas.
4. Test representative long videos, PDF exports and simultaneous generations before selecting capacity. Monitor queue age, p95 latency, error rate, provider quotas, worker heartbeat and memory; do not infer capacity from unit tests.
5. Validate database backup retention and perform a restore drill. Confirm firewall/WAF rules and alert delivery in the actual hosting account. These operational settings were not changed or comprehensively audited here.
6. Consider strict CSP nonces in a separate architecture change, including Next hydration, static exports, Razorpay, OAuth popups and sandboxed print tests. Do not remove inline allowances without that work.
7. Keep payment webhooks signed and idempotent, admin MFA required, secrets out of client bundles and account enrollment explicit. Radox live activation remains dependent on the user's configured key and exact active model ID.

## Validation record

New `test:redesign` covers SQLite and Mongo style persistence, foreign-owner denial, stale writes, malicious style values, escaped content, all three compositions, reading preference compatibility, feedback-assist eligibility/privacy/no-auto-publication and admission release behavior. `test-request-budget` covers a stalled stream, actual oversized chunks, invalid declared lengths and preservation of the handler-readable body.

Browser fixtures cover notebook reading/print, PDF pagination, save/reload, 320–1440px layouts, auth, student navigation, growth onboarding and genuine review moderation. Fixture screenshots are not live customer output. CI runs the broader existing payment, writer, presentation, learning and admin suites.

The local production-dependency audit on 16 October reported zero known advisories. That is an advisory snapshot, not proof of vulnerability absence. No intrusive attack or load test against the live service was performed.

## References

- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP denial-of-service guidance](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [W3C animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
