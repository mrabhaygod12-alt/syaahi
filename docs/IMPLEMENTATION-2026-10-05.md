# Release implementation tracker — 5 October 2026

Scope: the 24 student and 16 presentation recommendations in STUDENT-PRESENTATION-UPGRADE-AUDIT-2026-10-05.md, plus shared monthly billing, authentication, navigation, search visibility and abuse protection. The original audit remains the requirements baseline; this file records implementation evidence and outstanding acceptance work.

## Payment reliability

- Pushed and deployed in cf8e916: fixed-price, merchant-isolated monthly plan registry; missing provider plans are reused/created under a durable lock; prices are checked before subscription creation. Starter, Pro and Max use one shared wallet for both workspaces.
- Hosted authenticated writer billing check returned **Monthly checkout is ready. No subscription or payment was started.** Live merchant authentication and all three monthly catalogue mappings are verified. Screenshot: output/live-audit/monthly-catalog-ready.jpg.
- Legacy one-time pack sales are disabled by default. Historical receipts, signature verification, settlement and webhook replay handling remain available; existing paid subscriptions were not cancelled.
- Public deployment check passed 13/13 for cf8e916. A captured payment and its resulting live credit grant remain unverified; the readiness check never charges anyone.

## Student acceptance status

| Item | Implemented / verified | Remaining acceptance work |
| --- | --- | --- |
| 1 · Sessions | OAuth retry context, writer/student routes, verification/session regressions; password reset uses a hashed, single-use 30-minute token and atomically revokes existing sessions. Reset replay/concurrency tests pass on SQLite and Mongo. | Hosted reset-email delivery and broader authentication accessibility checks. |
| 2 · Today | New responsive dashboard with owned lessons, continuation, due count, weak-question evidence, exam tasks and ledger. Authenticated browser checks pass at 320/390/768/1440px. | Expanded dataset usability review. |
| 3 · Creation | Explicit outline/credit confirmation and reuse of generation request IDs. | Separate stage navigation and accessible validation summary. |
| 4 · Drafts | Account drafts, optimistic revisions, device fallback, stale-device rejection and downloadable conflict recovery. | Automatic reconnect synchronization and explicit choice between conflicting drafts. |
| 5 · Sources | Upload text appends rather than overwrites; presentation imports enforce owned source access. | Student source chips, per-source removal and durable provenance registry. |
| 6 · OCR | Existing extracted-text review remains editable. | Crop/rotate preparation and uncertainty review. |
| 7 · Lecture timing | Real VTT cues preserve timestamps; source room links to exact video offsets. Unit check covers VTT parsing; unanchored AI digests are labelled. | Live caption fixtures across languages and timestamp-aligned uploaded audio. |
| 8 · Evidence | PDF passage labels link to physical pages; document reader honors page deep links. | Claim-level evidence drawer and unsupported-label validation. |
| 9 · Outcomes | Learning-goal controls preserved. | Per-section objectives/prerequisites and mismatch checks. |
| 10 · Attempts | Server-owned practice/exam attempts, first-answer lock, delayed exam feedback, stable question keys, saved resumption and authoritative scoring. Tests cover modes, replay and cross-account denial. | Broader question-format browser fixtures. |
| 11 · Typed answers | Unicode/case/space/punctuation normalization and saved variants; no claim of semantic essay grading. | Generation and validation of acceptable variants/rubrics. |
| 12 · Mastery | Recent attempts and recurring weak-question counts are real saved evidence. | Longitudinal topic mastery and incomplete-evidence labels. |
| 13 · Review | Cross-lesson due queue and replay-safe ratings; browser and backend tests pass. | Offline reconciliation, historical card-version reconciliation. |
| 14 · Streak | Account days derived from saved completion/review/quiz events in a validated timezone. | Migration of earlier device-only activity and DST-boundary fixtures. |
| 15 · Exams | Saved dates, time budgets, task completion and rescheduling; invalid calendar dates rejected. | Capacity-aware allocation and automatic topic dependencies. |
| 16 · Reminders | Separate opt-ins, timezone browser reminders, email provider idempotency key and durable claim/history. Browser notification does not silently opt into email. | Production service uses embedded worker; email reminders stay disabled until an external scheduler is configured and delivery tested. |
| 17 · Search | Authenticated search of owned note/source/card content, 30-result bound; cross-account isolation test passes. | Indexed pagination for more than the latest 100 lessons. |
| 18 · History | Saved section snapshots, compare and revision-checked restore; practice/audio invalidated after restore. | Browser history/restore fixture and simultaneous editor conflict flow. |
| 19 · Groups | New invitations expire in seven days; shared-with-you library preserved; revocation/access checks pass. | Paragraph anchors, invitation expiry UI and collaboration activity feed. |
| 20 · Reading | Focus states, mobile layouts, keyboard quiz controls and reduced motion. | Reader font/line-width presets and full accessibility audit. |
| 21 · Audio | Existing real script/TTS/download flow preserved. | Chapter audio, versioned assets and cross-device listening position. |
| 22 · Offline | Service worker continues to cache only the public offline fallback. | Explicit private offline downloads, TTL/delete/logout clearing and replay-safe offline review. |
| 23 · Credits | Account ledger with real references, confirmation estimates and tested deck/regeneration refunds. | Reserved-versus-consumed reconciliation view for note generation. |
| 24 · Retention | Owned source listing/delete, access tombstones and explicit explanation that generated text remains in lessons. | Extracted-source export and derived cache/search revocation. |

## Presentation acceptance status

| Item | Implemented / verified | Remaining acceptance work |
| --- | --- | --- |
| 1 · Studio | Source panel, stable thumbnails, common 16:9 canvas, properties, mobile panel switcher; saved selected slide and browser layout checks. | Wider UX review on touch/tablet. |
| 2 · Outline | Free owned planning, edit/reorder, explicit Save outline, durable reload, revision check and five-credit approval before generation. Idempotent generation/charging tests pass. | Autosave before navigating away. |
| 3 · Objects | Validated geometry, font/color/alignment, text/image objects, undo/redo, local edit recovery; foreign object images rejected. | Drag/resize handles and advanced object grouping. |
| 4 · Layouts | Agenda, quote, timeline, image, recap and case added to six existing layouts and generation schema. | Render fixtures for every layout with long multilingual text. |
| 5 · Brands | Owned, version-checked brand kits with saved colors/fonts and reversible application. | Logo placement presets. |
| 6 · Imports | Owned lessons/PDFs and supplied text, up to six sources with a shared 18,000-character limit; cross-account imports denied. | Token-aware source balancing. |
| 7 · Evidence | Known-source IDs filtered, imported-source citations and source drawer; fabricated source IDs rejected on edit. | Claim-level support verification. |
| 8 · Progress | Persisted stages, leases, partial slides, worker recovery and indexed pending selection. | Progress ETA and cancellation UX. |
| 9 · Regeneration | One saved slide, one-credit explicit approval, stable retry ID, durable lease, race rejection, applied-event recovery and one-time failure refund. Both storage backend tests pass. | Hosted AI regeneration smoke check. |
| 10 · Slides | Stable IDs, add/duplicate/remove/reorder, stale-edit rejection and server plan limits; paid history survives downgrade. | Large history usability review. |
| 11 · Preview/export | Common object geometry, private assets, actual PNG/PDF/notes generation and native editable PPTX. PNG visually inspected; PPTX ZIP format verified. | Actual PPTX rendering/PowerPoint comparison remains outstanding; fonts/chart styling may differ. |
| 12 · Data | Rectangular table grids retain empty cells; finite signed charts use a zero baseline; rendered negative chart inspected. | More data-density fixtures. |
| 13 · Presenting | Keyboard presenter view, separate audience window that receives no speaker notes, timer and saved rehearsal records. Audience privacy and rehearsal browser check pass. | Per-slide timing and optional speaking feedback. |
| 14 · Collaboration | Bounded snapshots, optimistic restore, duplication, seven-day revocable links, authenticated comments and owner moderation. Public APIs exclude private source text, notes, owner identity and history; comment replay/revocation tests pass. | Share expiry UI polish. |
| 15 · Exports | Owned saved deck required; rate limit, single active visual renderer, timeout, blocked external requests; PPTX/PDF/PNG/notes controls. | Export job history and retry queue. |
| 16 · Quality | Deterministic contrast/copy/box/font/source/image warnings. No fabricated quality score. | Real measured overflow across multilingual fonts. |

## Security and search visibility

- Sanitized daily salted scanner identity, bounded trap records, seven-day Mongo expiry and temporary abuse blocks. Unknown/untrusted local addresses are never globally blocked. Admin incidents API requires configured admin access. Regression tests cover origin checks, streamed body bounds, forged sessions and unauthorized admin access.
- A honeypot supports existing controls; it is not an attack-proof guarantee or a replacement for infrastructure WAF controls.
- Canonical public URLs, private-page noindex, public-only sitemap, factual software/breadcrumb structured data and updated product facts in llms.txt. Existing SEO regression tests pass. No search/AI-answer placement guarantee is made.

## Verification evidence

- npm run check; production Next build in .next-validation.
- test:student-studio on SQLite and --mongo: quiz scoring, private content search, draft conflicts, streak, review replay, imports/assets, single-charge generation, history, regeneration refunds, private revocable sharing, actual exports, sanitized honeypot, single-use recovery/session revocation.
- test:student-studio-browser: real authenticated dashboard review, quiz refresh, durable outline and deck edits, audience-note exclusion, saved rehearsal, responsive widths and no page errors.
- Existing study/auth/security/proxy/workspace/SEO regression suites passed. Latest changes must pass required release checks again before push.
- Local screenshots and actual exported files: output/live-audit/studio/. These are test fixtures, not customer content.

Unfinished acceptance work is explicitly listed above. Do not represent the full 40-item audit or live payment capture as complete.
