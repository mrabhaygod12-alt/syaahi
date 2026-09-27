# Syaahi master plan: research, implementation, and release gates

## 24 September implementation update

Turbo’s public home and student pages were rechecked. Current delivery status is in RELEASE-STATUS.md. New work includes mandatory versioned Terms consent, private support tickets and staff replies, Gemini speech-to-text and voice playback, audio studio controls, animated walkthrough transitions and referral allowance metrics. Full private-product parity is not claimed.

Updated: 22 September 2026. Owner and creator: Chandan Pandey.

## 1. Research scope and evidence

Reviewed Turbo’s public [home page](https://www.turbo.ai/), [student feature page](https://www.turbo.ai/for-students), and [AI notetaker page](https://www.turbo.ai/ai-note-taker). These describe uploads, recording, editable notes, chat, practice, audio, organisation, and collaboration. They are product claims, not an independent test of Turbo’s private application. No private API, source code, or proprietary content was accessed. Syaahi implements its own workflows and presentation.

The student page additionally describes spaced repetition, difficulty controls, answer explanations, downloadable audio, shared editing, and a book library. The notetaker page describes timestamps, writing suggestions, and folders. A feature is not considered delivered here merely because a button or endpoint exists.

## 2. Product direction

Build a dependable learning workspace around the sequence: bring material → inspect evidence → approve an outline → read visual notes → test recall → revisit weak concepts. Notes should resemble a carefully prepared notebook while remaining clearly identified as AI-assisted study material. Use semantic graphics, readable handwriting, short explanations, and worked examples. Never squeeze a raster screenshot to fill a page.

The differentiation should be earned through source visibility, editable plans, reliable graphics/PDFs, transparent token accounting, multilingual notes, and failure recovery. Do not advertise “world first”, guaranteed marks, perfect accuracy, unlimited free infrastructure, or certified security without evidence.

## 3. Feature matrix and acceptance criteria

| Area                                          | Current implementation at research checkpoint                                                 | Required completion check                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Topic, PDF, screenshot, audio, YouTube intake | Implemented; screenshot OCR, research, and invalid PDF rejection tested                       | Verify permissions, file limits, extraction errors, and source review                          |
| Live lecture recording                        | Missing from the new composer                                                                 | Explicit microphone action, timer, stop/cancel, upload, transcript review                      |
| Document/presentation intake                  | PDF supported; DOCX/PPTX not yet supported                                                    | Extract safely with limits; report unsupported content                                         |
| Notes and visual diagrams                     | Shared HTML renderer, handwriting, formulas, code, flow/cycle/layer/decision/concept graphics | Model output must produce meaningful visual directives; render every visual without clipping   |
| Page target and editable outline              | Implemented                                                                                   | Distinguish outline sections from physical continuation sheets                                 |
| Rich note editing                             | Markdown editing implemented                                                                  | Revision conflict checks, saved content, clear errors; rich-text parity remains separate       |
| AI writing suggestions                        | Missing                                                                                       | Show a proposed rewrite, retain original until explicit apply                                  |
| Source-grounded chat                          | Implemented, live-tested                                                                      | Source labels must mean consulted material, not fabricated proof                               |
| Quiz                                          | MCQ, feedback, hints, saved sets                                                              | Difficulty/topic selection, explanations, saved attempts, weak-area review                     |
| Flashcards                                    | Flip and session self-rating                                                                  | Durable due dates, daily review queue, repeated-review idempotency                             |
| Audio lessons                                 | Device read-aloud recap                                                                       | Grounded configurable script; downloadable audio requires an eligible TTS provider             |
| Folders and search                            | Lesson search; older local folders superseded                                                 | Server-owned folders, assignment, cross-device persistence                                     |
| Shared lessons                                | Missing                                                                                       | Explicit access grants, role enforcement, revocation, safe read-only share links               |
| Live collaboration                            | Missing                                                                                       | Conflict-safe edits and refresh; CRDT cursors are a distinct later milestone                   |
| Comments and discussion                       | Missing                                                                                       | Membership checks, author attribution, deletion rights, rate limits                            |
| Book/study-guide library                      | Empty curated library                                                                         | Add only licensed or original material with attribution; no copying Turbo’s library            |
| Mobile                                        | Responsive web interface and installable shell                                                | Real-device checks; offline screen must not promise offline AI                                 |
| Account and Google login                      | Password accounts; Google pending credentials/integration                                     | OAuth state/PKCE, callback allowlist, verified identity, no unsafe email merging               |
| Payments                                      | Razorpay order, verification, signed webhook, replay-safe wallet                              | Test-mode checkout with actual merchant keys, refund operations, webhook delivery              |
| Referral rewards                              | Missing                                                                                       | One inviter per new account; reward only after qualifying verified purchase; no self-referrals |
| About creator                                 | Pending                                                                                       | Supplied biography and image, working social links, reduced-motion support                     |
| Cloud deployment                              | Local single-host app                                                                         | Vercel frontend, Render API/worker, Atlas transactions, explicit credentials and monitoring   |

Statuses above are a baseline, not a promise that every missing item has already shipped. Final verification results belong in RELEASE-STATUS.md.

## 4. Implementation sequence

### Stage A — study experience first

1. Finish graphic-note generation and compare preview/PDF output.
2. Add recording and broader document intake.
3. Persist folders, quiz attempts, and spaced-repetition reviews.
4. Add AI rewrite proposals with explicit apply and revision protection.
5. Add sharing, collaborator roles, comments, and conflict-safe updates.
6. Improve audio scripts and clearly distinguish browser speech from downloadable audio.
7. Audit empty/loading/error states, forms, dropdowns, and mobile navigation across every route.

### Stage B — accounts and business rules

1. Add Google OAuth through Supabase, keeping local development usable.
2. Use an integer page-unit ledger: 1 token = 3 generated note sections. Reserving a one-section job costs one third of a token. Continuation PDF sheets remain free. Never silently erase old balances during the change.
3. Publish lower proposed packs with exact tokens, maximum section allowance, and rupee price. Confirm unit economics against paid fallback inference, extraction, support, payments, and hosting before a public sale.
4. Referral rewards become eligible after a referred account’s first verified captured payment. Record the reward once. Refunds and fraud require operator review and reward-reversal tooling before broad promotion.
5. Finish the creator/About page and implementation-accurate policy pages.

### Stage C — deployment after functional checks

Vercel serves the Next.js frontend and public pages. Browser requests use same-origin /api paths forwarded to Render. Render runs the API and dedicated workers. MongoDB Atlas holds accounts/session mappings, jobs, wallets, reservations, orders, referrals, study state, and collaboration permissions. Supabase supplies Google identity; it does not need to duplicate application records in Postgres. Cloudflare can provide DNS, TLS edge controls, WAF and rate limiting for a custom domain; it is not the application database or worker host.

Keep domain code under lib, UI under components/app pages, and route handlers under app/api. Deployment configuration chooses frontend versus backend roles. Heavy Chromium/PDF work runs on Render, not Vercel request functions. A fully independent Express rewrite is unnecessary to establish service separation; boundaries and deployment tests matter more than folder names.

## 5. AI provider architecture

Use official configured providers first. Text generation and practice use the same bounded fallback router. Vision extraction and audio transcription require models that actually support those modalities. Validate structured outputs before saving. Never treat generated URLs as permission to fetch arbitrary hosts.

Observed live: Groq GPT-OSS 120B generated a complete lesson, practice and chat; Gemini Flash access and screenshot transcription worked. OpenCode Zen’s free endpoint returned an explicit restriction to OpenCode clients. Do not spoof a client or assume that an IDE’s free access is a production API entitlement.

| Provider         | Candidate model identifiers                                     | Treatment                                                                 |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Groq             | openai/gpt-oss-120b; openai/gpt-oss-20b; whisper-large-v3-turbo | Text and transcription; organisation quotas apply                         |
| Google Gemini    | gemini-3.8-flash                                                | Text and screenshot extraction tested; project quota and data terms apply |
| Mistral          | mistral-small-latest                                            | Optional configured account, benchmark before promotion                   |
| Cerebras         | gpt-oss-120b                                                    | Optional, conservative context until account probe                        |
| OpenRouter       | openrouter/free                                                 | Variable eligible model; log actual returned identity                     |
| NVIDIA NIM       | deepseek-ai/deepseek-v4-flash                                   | Evaluation opt-in; review production entitlement                          |
| OpenCode Zen     | big-pickle and changing promotional models                      | Disabled by default following access rejection                            |
| Anthropic Claude | Paid API models                                                 | No recurring free-production assumption                                   |

Six keys from one project do not imply six independent quotas. Key rotation may support authorised failover and credential replacement, but must not bypass provider restrictions. Keep keys server-only, redact logs, group cooldowns by provider/quota owner, and measure model quality before routing real user material.

Provider references: [Groq models](https://console.groq.com/docs/models), [Groq limits](https://console.groq.com/docs/rate-limits), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Zen](https://opencode.ai/docs/zen/), [Mistral](https://docs.mistral.ai/models), [Cerebras](https://inference-docs.cerebras.ai/models/overview), [OpenRouter](https://openrouter.ai/docs/faq), [NVIDIA](https://docs.api.nvidia.com/nim/docs/product), [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).

## 6. Reliability and security design

- Authenticate private endpoints on the server; check resource ownership or explicit collaborator role on every operation.
- Use password hashes or verified OAuth identities, opaque HttpOnly sessions, expiry and sign-out invalidation.
- Reserve page units atomically with job creation; consume on committed sections; refund unfinished work once. Claim jobs with renewable leases and reject stale writers.
- Verify checkout signatures and raw webhook signatures. Fetch/validate captured payment identity, amount, currency and ownership. Unique payment and reward keys prevent replay grants.
- Bound files, extracted text, output size, retries, provider timeouts, PDF concurrency and expensive endpoint frequency.
- Escape model output; sandbox previews; block renderer network requests. Treat source documents as untrusted evidence, never instructions.
- Enforce explicit sharing. Revocation must affect API reads, edits, comments, and exports. Keep unshared material out of public library/search.
- Test backups/restores, establish retention and incident response, and monitor queue age, provider errors, extraction failures and payment mismatches.

### NIST interpretation

The user’s “NOST” request is interpreted as NIST CSF 2.0. Map evidence to Govern, Identify, Protect, Detect, Respond, and Recover. The framework is a risk-management structure, not a certificate earned by adding security headers. Current tests support specific controls; organisational policy, independent review, incident exercises, production monitoring and restoration evidence remain release work. Do not label the app “NIST certified”. [NIST CSF](https://www.nist.gov/cyberframework)

## 7. Capacity: what 100,000 users means

Registered users, daily active users, concurrent sessions, and simultaneous generations are different workloads. Start with explicit assumptions: for example, 100,000 accounts, 10,000 daily learners, 500 concurrent readers, and a separately bounded generation queue. This is a planning scenario, not a measured result.

Measure request latency, Mongo connection usage, transaction conflicts, queue throughput, worker memory, PDF memory, and provider quotas. Scale API readers separately from AI/PDF workers. Use admission control, per-account quotas, backpressure and a queue-wait estimate. Add a distributed queue and rate limiter when process-local limits become insufficient. Free inference tiers and free sleeping hosts cannot establish a dependable 100,000-user service level.

Release load gates: authenticated read stress; concurrent reservation/payment replay tests; worker crash recovery; burst intake; PDF concurrency; database restore; provider outage; cross-account access; collaboration conflict/revocation. Record actual throughput and latency rather than estimating them as completed capacity.

## 8. Definition of done

A feature is complete only when its UI, API, durable state, authorisation, validation, error handling, and meaningful test all work together. External integrations are “implemented, configuration required” until exercised with real service configuration. Public marketing should reflect that distinction. Push only reviewed source and public assets; exclude local secrets, user databases, extracted uploads, private PDFs and QA sessions.
