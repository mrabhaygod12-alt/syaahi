# Release implementation tracker — 5 October 2026

Scope: the 24 student and 16 presentation recommendations in STUDENT-PRESENTATION-UPGRADE-AUDIT-2026-10-05.md, plus shared monthly billing, authentication, navigation, search visibility and abuse protection. The original audit remains the requirements baseline; this file records implementation evidence and outstanding acceptance work.

## Payment reliability

- Pushed and deployed in cf8e916: fixed-price, merchant-isolated monthly plan registry; missing provider plans are reused/created under a durable lock; prices are checked before subscription creation. Starter, Pro and Max use one shared wallet for both workspaces.
- Hosted authenticated writer billing check returned **Monthly checkout is ready. No subscription or payment was started.** Live merchant authentication and all three monthly catalogue mappings are verified. Screenshot: output/live-audit/monthly-catalog-ready.jpg.
- Legacy one-time pack sales are disabled by default. Historical receipts, signature verification, settlement and webhook replay handling remain available; existing paid subscriptions were not cancelled.
- Public deployment check passed 13/13 for cf8e916. A captured payment and its resulting live credit grant remain unverified; the readiness check never charges anyone.
- Baseline studio release 8842696 passed GitHub CI and 17 strict public checks, with matching frontend/backend revisions and all three monthly plans available. Follow-up source/reading/quiz changes are tracked below.
- Study intake release 7413582 also passed GitHub CI and all 17 strict live checks. A fresh authenticated writer readiness check confirmed merchant setup without creating a subscription or payment. Writer Membership remained in the writer workspace. Evidence: output/live-audit/monthly-catalog-ready-7413582.png.

## Student acceptance status

| Item | Implemented / verified | Remaining acceptance work |
| --- | --- | --- |
| 1 · Sessions | OAuth retry context, writer/student routes, verification/session regressions; password reset uses a hashed, single-use 30-minute token and atomically revokes existing sessions. Reset replay/concurrency tests pass on SQLite and Mongo. | Hosted reset-email delivery and broader authentication accessibility checks. |
| 2 · Today | New responsive dashboard with owned lessons, continuation, due count, weak-question evidence, exam tasks and ledger. Authenticated browser checks pass at 320/390/768/1440px. | Expanded dataset usability review. |
| 3 · Creation | Input → Outline → Credits navigation, restored stage, keyboard heading focus, explicit approval, request-ID replay and rejection of changed retry payloads. Browser refresh and SQLite/Mongo checks pass. | Accessible validation summary across every error path. |
| 4 · Drafts | Account drafts, optimistic revisions, device fallback, stale-device rejection and downloadable conflict recovery. | Automatic reconnect synchronization and explicit choice between conflicting drafts. |
| 5 · Sources | Upload text appends rather than overwrites; presentation imports enforce owned source access. | Student source chips, per-source removal and durable provenance registry. |
| 6 · OCR | Bounded browser preview with crop/quarter-turn rotation; server auto-orientation and actual pixel crop tested. Scan preparation, transcription hash and reviewed state persist with the draft/lesson. Unclear text must be reviewed before planning. | Live OCR-provider Hindi/English fixtures; browser transcription uses a fixture response. This is descriptive provenance, not a claim of verified accuracy. |
| 7 · Lecture timing | Real VTT cues preserve timestamps; source room links to exact video offsets. Unit check covers VTT parsing; unanchored AI digests are labelled. | Live caption fixtures across languages and timestamp-aligned uploaded audio. |
| 8 · Evidence | PDF passage labels link to physical pages; document reader honors page deep links. | Claim-level evidence drawer and unsupported-label validation. |
| 9 · Outcomes | Editable objectives and prerequisites follow stable section identities through outline reordering, account drafts, saved jobs and resumed generation; notes display them. Planner requests matching section goals, with manual editing/fallback. | Generated-content mismatch checks and hosted model review. |
| 10 · Attempts | Server-owned practice/exam attempts, first-answer lock, delayed exam feedback, saved resumption and authoritative scoring. Question IDs survive display reordering and invalidate on scoring changes. Rebuild is blocked during matching unfinished attempts. | Broader question-format browser fixtures; atomic protection against the narrow attempt-start/rebuild race. |
| 11 · Typed answers | Unicode/case/space/punctuation normalization; bounded generated answer variants and rubric version. Malformed variants cannot alter scoring. No semantic essay-grading claim. | Hosted generated-answer review and learner challenge flow. |
| 12 · Mastery | Recent attempts and recurring weak-question counts are real saved evidence. | Longitudinal topic mastery and incomplete-evidence labels. |
| 13 · Review | Cross-lesson due queue and replay-safe ratings; browser and backend tests pass. | Offline reconciliation, historical card-version reconciliation. |
| 14 · Streak | Account days derived from saved completion/review/quiz events in a validated timezone. | Migration of earlier device-only activity and DST-boundary fixtures. |
| 15 · Exams | Saved dates, time budgets, task completion and rescheduling; invalid calendar dates rejected. | Capacity-aware allocation and automatic topic dependencies. |
| 16 · Reminders | Separate opt-ins, timezone browser reminders, email provider idempotency key and durable claim/history. Browser notification does not silently opt into email. | Production service uses embedded worker; email reminders stay disabled until an external scheduler is configured and delivery tested. |
| 17 · Search | Authenticated search of owned note/source/card content, 30-result bound; cross-account isolation test passes. | Indexed pagination for more than the latest 100 lessons. |
| 18 · History | Saved section snapshots, compare and revision-checked restore; practice/audio invalidated after restore. | Browser history/restore fixture and simultaneous editor conflict flow. |
| 19 · Groups | New invitations expire in seven days; shared-with-you library preserved; revocation/access checks pass. | Paragraph anchors, invitation expiry UI and collaboration activity feed. |
| 20 · Reading | Account-saved reading/print mode, bounded font/width/line-height/tone/focus controls, optimistic conflict protection, escaped structured text and MathML. Browser checks cover 320/390/768px, 200% zoom, persistence and one-based section links. | Full accessibility audit and assistive-technology review. |
| 21 · Audio | Existing real script/TTS/download flow preserved. | Chapter audio, versioned assets and cross-device listening position. |
| 22 · Offline | Service worker continues to cache only the public offline fallback. | Explicit private offline downloads, TTL/delete/logout clearing and replay-safe offline review. |
| 23 · Credits | Account ledger with real references, confirmation in credits and tested deck/regeneration refunds. Identical lesson retries reserve once; changed request payloads are rejected. | Reserved-versus-consumed reconciliation view for note generation. |
| 24 · Retention | Owned source listing/delete, access tombstones and explicit explanation that generated text remains in lessons. | Extracted-source export and derived cache/search revocation. |

## Presentation acceptance status

| Item | Implemented / verified | Remaining acceptance work |
| --- | --- | --- |
| 1 · Studio | Source panel, stable thumbnails, common 16:9 canvas, properties, mobile panel switcher; saved selected slide and browser layout checks. | Wider UX review on touch/tablet. |
| 2 · Outline | Free owned planning, edit/reorder, explicit Save outline, durable reload, revision check and five-credit approval before generation. Idempotent generation/charging tests pass. | Autosave before navigating away. |
| 3 · Objects | Validated geometry, font/color/alignment, text/image objects, undo/redo, local edit recovery; foreign object images rejected. | Drag/resize handles and advanced object grouping. |
| 4 · Layouts | Twelve layouts have English/Hindi browser-rendered fixtures with owned images, blank table cells and signed chart data. Normal samples fit all 24 rendered slides; deliberately dense custom text demonstrably clips. | Full long-content fixtures across all supported languages, fonts and templates. |
| 5 · Brands | Owned, version-checked brand kits with saved colors/fonts and reversible application. | Logo placement presets. |
| 6 · Imports | Owned lessons/PDFs and supplied text, up to six sources with a shared 18,000-character limit; cross-account imports denied. | Token-aware source balancing. |
| 7 · Evidence | Known-source IDs filtered, imported-source citations and source drawer; fabricated source IDs rejected on edit. | Claim-level support verification. |
| 8 · Progress | Persisted stages, leases, partial slides, worker recovery and indexed pending selection. | Progress ETA and cancellation UX. |
| 9 · Regeneration | One saved slide, one-credit explicit approval, stable retry ID, durable lease, race rejection, applied-event recovery and one-time failure refund. Both storage backend tests pass. | Hosted AI regeneration smoke check. |
| 10 · Slides | Stable IDs, add/duplicate/remove/reorder, stale-edit rejection and server plan limits; paid history survives downgrade. | Large history usability review. |
| 11 · Preview/export | Common object geometry, private assets, actual PNG/PDF/notes generation and native editable PPTX. English/Hindi PPTX fixtures for all twelve layouts imported/rendered with Artifact Tool; selected Hindi/English text, columns, process, table, image, quote and chart slides visually inspected. Browser/audience/export language tags and Hindi font choice now agree. | PowerPoint comparison remains outstanding. Artifact Tool's imported signed chart omits one negative-bar category label despite the label being present in the native chart data; do not claim full chart parity. Recipient fonts can change wrapping. |
| 12 · Data | Rectangular table grids retain empty cells; finite signed charts use a zero baseline; rendered negative chart inspected. | More data-density fixtures. |
| 13 · Presenting | Keyboard presenter view, separate audience window that receives no speaker notes, timer and saved rehearsal records. Audience privacy and rehearsal browser check pass. | Per-slide timing and optional speaking feedback. |
| 14 · Collaboration | Bounded snapshots, optimistic restore, duplication, seven-day revocable links, authenticated comments and owner moderation. Public APIs exclude private source text, notes, owner identity and history; comment replay/revocation tests pass. | Share expiry UI polish. |
| 15 · Exports | Owned saved deck required; rate limit, single active visual renderer, timeout, blocked external requests; PPTX/PDF/PNG/notes controls. | Export job history and retry queue. |
| 16 · Quality | Deterministic contrast/copy/box/font/source/image warnings plus actual browser text-clipping checks. Resize and font-load events refresh warnings; shrinking text or enlarging its box clears them. No fabricated quality score. | Claim-level support checks and broader multilingual font fixtures. Browser measurements do not certify PowerPoint rendering. |

## Security and search visibility

- Sanitized daily salted scanner identity, bounded trap records, seven-day Mongo expiry and temporary abuse blocks. Unknown/untrusted local addresses are never globally blocked. Admin incidents API requires configured admin access. Regression tests cover origin checks, streamed body bounds, forged sessions and unauthorized admin access.
- A honeypot supports existing controls; it is not an attack-proof guarantee or a replacement for infrastructure WAF controls.
- Canonical public URLs, private-page noindex, public-only sitemap, factual software/breadcrumb structured data and updated product facts in llms.txt. Existing SEO regression tests pass. No search/AI-answer placement guarantee is made.

## Verification evidence

- npm run check; production Next build in .next-validation.
- test:student-studio on SQLite and --mongo: quiz scoring, private content search, draft conflicts, streak, review replay, imports/assets, single-charge generation, history, regeneration refunds, private revocable sharing, actual exports, sanitized honeypot, single-use recovery/session revocation.
- test:student-studio-browser: real authenticated dashboard review, quiz refresh, durable outline and deck edits, audience-note exclusion, saved rehearsal, responsive widths and no page errors.
- Existing study/auth/security/proxy/workspace/SEO regression suites passed. Follow-up production build, typecheck, SQLite/Mongo student-studio tests, browser tests, monthly catalogue, referrals/rewards, provider configuration, consent/support, office and proxy checks passed locally. Browser follow-up covers crop/review controls, reading persistence/private access, saved wizard stages and 200% zoom. Live OCR/model output and live payment capture are separate checks.
- Local screenshots and actual exported files: output/live-audit/studio/. These are test fixtures, not customer content.

Unfinished acceptance work is explicitly listed above. Do not represent the full 40-item audit or live payment capture as complete.
