# Release implementation tracker — 5 October 2026

Scope: implement the 24 student and 16 presentation recommendations in STUDENT-PRESENTATION-UPGRADE-AUDIT-2026-10-05.md, plus shared monthly billing, authentication, navigation, search visibility and abuse protection. This is a live checklist, not a completion claim.

## Payment reliability

- Implemented locally: fixed-price, merchant-isolated monthly plan registry; missing provider plans are reused/created under a durable lock; provider prices are validated before subscription creation.
- Implemented locally: authenticated catalogue preparation without starting a customer subscription or payment; legacy one-time pack checkout retired by default, historical payment verification retained.
- Verified: catalogue concurrency, cached reuse, wrong-price rejection, merchant isolation and provider authentication failure tests; workspace regression suite; production build.
- Hosted evidence: Render has merchant key/webhook environment names but no three monthly plan ID variables. Hosted merchant authentication and captured-payment settlement remain unverified.

## Student acceptance checklist

Pending unless marked complete with implementation and verification evidence:

1. Session/workspace reliability (OAuth retry context fixed in 3c2c63c; broader checks pending).
2. Server-backed Today dashboard.
3. Creation wizard and explicit credit confirmation.
4. Account composer drafts and conflict recovery.
5. Multiple owned sources and provenance.
6. OCR review and corrections.
7. Timestamped lecture sources.
8. Precise evidence links.
9. Outline objectives and prerequisites.
10. Stable practice/exam attempts and authoritative scoring.
11. Typed answer normalization and review.
12. Longitudinal practice mastery.
13. Cross-lesson due review queue.
14. Account activity and timezone streak.
15. Saved exam planner.
16. Explicit reminder channels and deduplicated delivery.
17. Private content search.
18. Note history and restore.
19. Expiring group invites and anchored discussions.
20. Accessible reading, keyboard and reduced motion.
21. Audio chapters and durable listening progress.
22. Opt-in private offline reading and review reconciliation.
23. Estimates, ledger and refund visibility.
24. Source retention, export/delete and cache revocation.

## Presentation acceptance checklist

1. Responsive thumbnail/canvas/properties studio.
2. Durable outline approval before charged generation.
3. Validated editable objects and undo/redo.
4. Six additional layouts.
5. Versioned brand kits.
6. Owned document and lesson imports.
7. Evidence mapped to supplied sources.
8. Durable progress and safe resume.
9. Targeted paid regeneration and failure refund.
10. Stable-ID slide operations and server limits.
11. Common preview/export geometry and actual export visual QA.
12. Chart/table grid editing and signed-value baseline.
13. Presenter mode, private notes and rehearsal.
14. Versions, duplication, expiring shares and comments.
15. Authenticated bounded export centre.
16. Deterministic quality checks.

## Additional release gates

New student dashboard/navbar with About; student/writer routing; SEO/AEO/GEO with accurate public structured data; bounded queues and abuse monitoring; honeypot with private sanitized incident records. No claim of an attack-proof application or guaranteed search placement.

Each feature needs saved state, owner/role checks, recovery behavior and meaningful verification before its checklist item is closed. Pushes can ship independently verified groups; unfinished groups remain listed here.
