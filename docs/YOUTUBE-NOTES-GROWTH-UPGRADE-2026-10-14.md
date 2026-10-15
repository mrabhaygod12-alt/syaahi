# Syaahii notes, growth and operations upgrade

Implemented 14 October 2026. This document distinguishes shipped code, tested behavior and dependencies that need an operator or provider.

## Source pipeline

`POST /api/youtube` verifies the account and origin, applies rate limits, canonicalizes a supported YouTube ID and saves a private ingestion job. The API returns its ID immediately. `GET /api/youtube/:id` checks ownership and returns bounded progress or the reviewed source result.

Stages: queued → reading → assessing → done. The dashboard lists recent owned imports with Resume/Review source and Stop controls. Cancellation invalidates the worker lease; in-flight requests may finish, but subsequent stages cannot write over the stopped state. Unusable sources go to `needs_input`; transient suitability/provider failures have bounded retries and backoff. An atomic six-minute lease prevents competing workers from processing the same job. Expired leases can be reclaimed, and stale workers cannot overwrite a newer lease. Repeated preparation of the same video resumes its owned job. Completed extraction is reused for 24 hours. MongoDB source-job records expire after seven days; expired records are unavailable through the owned API on either storage backend.

Captions are attempted first. The existing Gemini public-video reader is Plan B when captions are absent. Its output is labelled **AI-extracted digest**, never a verbatim transcript. Source suitability is checked before lesson generation. Private, blocked, unavailable, live or over-60-minute videos may require a permitted recording or pasted transcript. No title-only substitute is generated. Source-reading jobs do not reserve lesson credits; approval of the lesson outline remains separate.

Hosted worker mode was inspected: it is currently embedded on a free Render web service. The existing worker processes video jobs along with note jobs, presentations and editorial publishing. External mode requires a running worker. Embedded mode only runs while the web process is awake: a sleeping free web service cannot provide continuous background processing. The prepared `render.yaml` has a dedicated worker, but importing it would create paid services. No paid hosting change was made.

## Notes and student workspace

New lessons use **Illustrated study atlas** as the default PDF template. Its deterministic renderer provides numbered sections, pastel definition and takeaway cards, process diagrams, comparisons and readable code. The same document renderer supplies previews and PDFs; content paginates rather than shrinking to fit. The default web view is a readable, responsive atlas; print preview is a separate option. Saved reading preferences remain respected. Existing lessons retain their saved template. Other notebook styles remain available.

Notes have an active-recall prompt, source-aware assistant entry point, quiz/flashcard links and an account-saved Reviewed checkbox. The university dashboard has a compact icon navigation rail, cleaner hierarchy, restrained surfaces and responsive layouts. This remains a study application, rather than an image-only imitation of a handwritten reference sheet.

## Authentic reviews

`/feedback` accepts 1–5 stars and 40–800 characters with explicit public-name/content consent. Eligibility requires a verified email and a completed lesson or published story. No client-provided `verified` flag is trusted.

Validation pass one rejects honeypot submissions, links/markup, invalid lengths and repeated spam. Pass two checks account/product use, copied content and editorial approval. Reviews are pending by default; both positive and negative feedback are eligible. An editor cannot approve their own review. Revision checks prevent stale moderation/edit requests. Editing a published review withdraws it from public display until another approval. Decisions retain an audit history.

`/admin/reviews` and its API use existing editorial permissions and production MFA. `/api/reviews` exposes only approved name, rating, text and timestamp; emails, ownership, moderation notes and fingerprints stay private. The homepage widget uses this public projection. It does not invent testimonials, totals or aggregate-rating schema.

## Admin control room

The Studio Django reference was visually inspected in its public preview. Syaahii uses an original implementation of its navigation/header/card direction, adapted to actual platform controls: users, editorial review, payments, support, growth, reviews and security. No proprietary template code or artwork was copied.

The overview shows bounded queue counts, private video queue size, worker mode/heartbeat and eligible AI configuration. **Configured is not a live health attestation.** Root operational diagnostics remain behind admin/MFA guards. Sidebar controls work on mobile and search filters real authorized routes.

## AI provider routing

Groq is the highest-priority configured provider; adapters already existed for Gemini, Mistral, Cerebras, OpenRouter and opt-in gateways. Having an adapter does not establish working account credentials or free access.

Radox uses its documented OpenAI-compatible endpoint, with explicit opt-in and an active model catalog check before inference. JSON and streaming are capability-gated. Unknown model IDs are rejected. Reported gateway identity is retained without treating it as independently verified Anthropic/OpenAI identity.

Configure on the backend **and worker**:

```dotenv
ENABLE_RADOX=true
RADOX_API_KEY=<operator-entered server secret>
RADOX_MODEL=<exact active ID from /v1/models>
# Optional conservative context cap; checked against the actual catalog:
RADOX_MAX_CONTEXT=8192
```

Never use `NEXT_PUBLIC_` for these credentials. Only the primary Radox key is used; additional Gmail accounts are not rotated to multiply free allowances. [Radox terms](https://radoxai.com/terms) prohibit that practice and explain that gateway names may differ from upstream names. Its [model documentation](https://radoxai.com/docs/models) defines active IDs/capabilities. Allowances and access can change or require payment.

Local neutral smoke on this date: Groq `openai/gpt-oss-120b` returned HTTP 200 with usable text; Gemini returned HTTP 503 or timed out; APINex returned HTTP 402. These are local configured-credential checks, not proof of hosted health or comparative model quality. No Radox key was supplied/configured locally, so live Radox inference was not verified. `npm run audit:providers` prints status/model information without secret values or user material.

## SEO, AEO and GEO

New public pages `/ai-generated-notes` and `/youtube-video-to-notes` target the actual product/query intent. They contain answer-first descriptions, source constraints, visible FAQs, matching FAQ/software/breadcrumb JSON-LD, canonical URLs and internal product links. They are included in the sitemap, footer and optional `llms.txt` summary. Public page metadata explicitly permits indexing; private feedback, account and draft routes remain excluded.

The homepage adds an interactive learning bento, a lecture-link entry, a four-step workflow and approved-user reviews. Important features are visible public HTML; a crawler need not sign in to understand the product. Provider secrets and private learning sources are never SEO content.

Search ranking and AI citations cannot be guaranteed. [Google's guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) favors helpful, reliable content; metadata and schema do not create an automatic #1 result. After deployment, submit the canonical sitemap in Search Console, inspect these two URLs and track indexed status plus query impressions/clicks. Compare weekly activation and paid conversion with existing consent-aware growth metrics. Do not infer success from a few manual searches or add fabricated proof.

## Footer and logout

All shared public and application shells display `© [year] Syaahii Pvt. Ltd. All rights reserved.` through one reusable component. The legal name is operator-configurable; no CIN, incorporation number or address was invented.

Successful server logout survives denied local-storage operations. The account context clears on a confirmed sign-out event. Account/profile buttons give immediate progress and actionable errors rather than unhandled promise rejections. Network failure is not falsely reported as a revoked session.

## Verification

`test:video-reviews` covers SQLite and MongoDB ownership, duplicate jobs, lease races/recovery, digest labels, unavailable sources, retry backoff, review eligibility/spam/consent, negative feedback, re-review, public-field privacy, admin denial and cookie/session revocation. `test:radox` uses isolated fixtures for opt-in, catalog validation, JSON capability, reported identity and one-key behavior; it makes no live-access claim.

The browser suite exercises the real production build with isolated fixture accounts, including MFA-protected moderation, responsive routes at 320/390/768/1440 pixels, PDF pagination, saved Reviewed state and logout with blocked storage. Fixture reviews and accounts are never inserted into production.
