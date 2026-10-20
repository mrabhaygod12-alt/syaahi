# Source-backed presentation studio rebuild

The user directive dated 19 October 2026 owns this implementation. New creation moves to a versioned, source-backed manifest; saved decks retain read/export compatibility. No existing user content is deleted. Arbitrary model JavaScript, HTML, shader programs and coordinates are never executed.

## Delivery checkpoints

- [x] Strict manifest, exact source-span grounding, full bounded source context, narrative and visual dispatcher.
- [x] Saved query/result research trace, server-side evidence/credit allocation, resumable generation and mandatory quality gate.
- [x] Rebuilt dark source / stage / director studio, creation, plan, library, visual gallery, editor, presenter, shared view.
- [x] Lazy renderer adapters, authored camera curve, deterministic seeded motion, shader validation, measured frame/buffer reporting and device fallback.
- [x] Pixel/CSS brand palette extraction, owned logo/scene assets, source inspector, interactive drill-down, device narration and optional neural service/timestamps.
- [x] Standalone interactive HTML, editable PPTX, PDF/PNG, queued Remotion landscape/vertical export with owned downloads.
- [x] Remove legacy creation/editor paths and old generation implementation; retain archived-data rendering/export and the explicit rejection adapter.
- [x] Security, billing, ownership, rendering, keyboard/mobile and export regression tests and production build. Push/hosted acceptance are reported separately with the exact revision.

## Claims and infrastructure boundaries

Exact quotation verification confirms provenance, not that a source is true or its context is complete. No software can promise zero hallucinations, zero crashes, constant FPS on every device, or zero CPU overhead. UI badges and reports must describe measured checks only. New source-backed content fails closed when citations do not match.

Long context uses complete bounded extracted text, not vector retrieval. Model and account limits still apply; never silently truncate a source or advertise an unverified 2M-token capacity. Uploaded scans without OCR must produce a clear error. Research must report providers and failed attempts, and must respect public-source extraction restrictions.

All graphics engines load on demand. Disabled WebGL/WebGPU, reduced motion and low-resource devices must retain readable vector output. Large particle counts are an opt-in quality setting, not a throughput guarantee. Private sources and notes stay out of public deck exports unless explicitly selected.

Production video/narration/vision features depend on configured resources and applicable service licenses. Existing Free Render hosting is not silently upgraded or represented as a 4K rendering cluster. Operator configuration and live account verification must be reported separately from tested code.

## Implemented contract, 20 October 2026

1. `presentation-plan-task` persists source selection and a brief before asynchronous extraction. Claims are copied verbatim, 24–240 characters and up to 24 words, then canonical source ID, exact offsets and document page markers are verified. A separate narrative pass selects existing fact IDs. Extraction/storyboard schema repair is bounded to one attempt each. Transient provider failures get at most two delayed task retries; account/provider quota cooldowns remain authoritative.
2. Complete bounded source snapshots (up to 1.2 million extracted characters) go to the evidence pass; this is not a claim of 2M-token support. Narrative uses verified evidence. PDFs retain physical page markers; DOCX/TXT imports fail explicitly when unreadable or oversized. Scanned PDFs require readable extraction; OCR is not fabricated. Discovery records two fixed-domain Wikipedia queries and Crossref abstract discovery. Excerpts/abstracts are explicitly labelled; this is not unrestricted web Deep Research.
3. Evidence depth, membership and wallet balance jointly allocate 5–30 scenes. Up to 10 scenes cost five credits; each further group of up to five adds two. The server validates the exact reservation, optimistic revision and owner. Initial failures refund only the actual reservation. A failed edit recheck cannot mint credits. Repairing an already-paid deck remains free; retrying an initially refunded deck requires explicit approval of a new reservation.
4. Every v3 delivery passes source integrity, 7:1 heading/4.5:1 secondary contrast, Chromium text bounds and approved GLSL compilation or explicit vector fallback. Optional Gemini screenshot judgement fails closed when enabled and unavailable. Reports distinguish executed, fallback and skipped checks.
5. Main editor includes autosave, outline ordering, notes, source Q&A, inspectable quotes, saved history, theme/logo extraction, camera/timeline, actual measured frame delivery and known buffer allocation (not fabricated total VRAM). Presentation mode retains a Three.js world/camera across scene changes. Theatre drives an authored camera curve; exploded inspection can use a bounded, precomputed Rapier simulation. WebGPU particles use seeded/time-derived positions, with explicit device-loss fallback.
6. Three.js, Babylon, OGL, Pixi, Two, GLSL, Curtains and p5 adapters were exercised in production-browser fixtures. Pixi uses its documented static CSP adapter; JavaScript `unsafe-eval` remains disabled. Spline accepts private owned `.splinecode` data; missing/unreadable scenes fall back. This does not certify an arbitrary third-party scene or unrestricted remote scene assets. A supported WebGPU device remains necessary for that adapter; no universal GPU claim is made.
7. PDF/PNG/PPTX use deterministic vector illustrations. Interactive HTML is a self-contained offline file with keyboard/fullscreen controls and a shader/vector fallback; it is not the complete multi-library editor or a full 3D-world offline bundle. The site retains its existing installable PWA shell and deliberately does not silently cache private sources/API responses. Remotion video uses deterministic vector scene rendering, including a genuine vertical reflow; it does not capture the interactive Three.js world. Device voice is available independently of Kokoro. Neural word/RMS synchronisation is implemented for configured, schema-validated Kokoro responses; narrated audio is not currently muxed into MP4.
8. Video tasks snapshot the approved revision, limit duration/daily usage, persist progress and cancellation, and stream owned expiring downloads. GridFS/local storage is private. Expired video/narration data is removed in bounded worker batches. A database rendering lease serializes new presentation quality/PDF/video work across web/worker processes; this does not claim automatic horizontal infrastructure provisioning or unlimited throughput.
9. Studio library queries project metadata and one preview instead of loading full source/history records. Scene/narration quotas use database counts rather than fetching binary payloads. Research planning permits two pending tasks and twenty new plans per account/day. Public citations omit source URLs/query tokens; private source links remain owner-only.
10. Page attribution uses server-created document offset spans, not page-looking strings inside untrusted text. A pasted `[page 999]` marker cannot become a verified document page.

## Verification evidence

- TypeScript check and production build passed during implementation; final release checks and hosted revision are recorded below after push.
- SQLite and MongoDB: exact source/page integrity, bounded repair, dynamic budgets, CAS/ownership, idempotent reservation/refund, failed-quality repair without free-credit creation, regeneration rejection/refunds, shared-source privacy, PPTX/PDF/PNG and shared rendering lease.
- Production Chromium: source paste → queued planning → edited/saved cited storyboard → explicit credit approval → generated stage → autosave/reload; source inspector, source-passage Q&A, private sharing, PPTX download, keyboard presentation, retained world canvas and mobile text-bound/overflow checks at 320/390/768/1440px.
- Renderer matrix exercised Three, Babylon, OGL, Pixi, Two, approved GLSL, Curtains and p5. Missing Spline asset fallback was tested. A user-supplied Spline file and hardware WebGPU/low-end Android remain device-specific checks; they are not represented as verified by the software Chromium matrix.
- Actual Remotion 3840×2160/60 FPS two-frame MP4 smoke, 1080×1920 portrait frame, configured neural/vision response contracts, response bounds and invalid word-timing rejection. Full-length hosted 4K throughput and real Kokoro/Gemini vision deployment are not claimed.
- Existing student workspace, legacy slide output, monthly checkout catalog, defensive security and production CSP/browser regression tests passed during implementation. Production dependency audit reported zero advisories.
- The scheduled recovery workflow's pre-existing interview failure was reproduced: its legitimate-write fixture omitted the Origin required by CSRF hardening. The fixture now includes its trusted origin and explicitly asserts a foreign-origin write remains blocked; production protection was not relaxed. The interview test and SQLite/Mongo workspace upgrade regressions passed.
- Real provider smoke extracted the live About page (4,244 characters), then stopped: Groq HTTP 429, Gemini HTTP 503, APInex HTTP 402. No successful live-model generation is claimed for this run. Credentials, quota/billing and model availability require operator resolution; unconfigured gateways were not silently activated.

## Release

The delivery message records the pushed revision, CI status and revision-matched hosted smoke result. Those rollout checks are separate from fixture/provider and hardware-specific tests above. No paid compute change was made.

### Accepted application release

- Application commit: `998e7428f18af0c29d84150f9b19a89a15633c1e`, pushed to `main`.
- Full GitHub CI passed: [run 39384938983](https://github.com/mrabhaygod12-alt/syaahi/actions/runs/39384938983), including production build and the new studio browser journey.
- Render reported this commit live at 07:17:41 UTC on 20 October 2026. Public frontend responses also carried this exact revision.
- Hosted public smoke at 07:18:34 UTC: **63/63 passed**, including the new routes' unauthenticated access boundaries, health, public content and billing-catalog shape. This is not an authenticated live-generation or payment-settlement claim.
- The live browser loaded the new source hub and visual-direction gallery. Full authenticated flows were exercised with controlled local/CI fixtures; existing live providers still returned the errors documented above.
- The public smoke script checks server metadata for account-bound client workspaces. Their actual hydrated layout is checked by the browser suite; a missing client-only CSS class in raw HTML is not treated as an application outage.
- A subsequent dependency-bot merge changed only the `setup-node` workflow version. The final verification-script/documentation commit does not change application behavior.
