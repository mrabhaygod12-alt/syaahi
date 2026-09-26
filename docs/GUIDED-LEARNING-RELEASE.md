# Guided learning and workspace repair — 25 September 2026

## Research and scope
Reviewed https://www.turbo.ai/for-students and the user's supplied guided-learning screenshots. Public features include notes, quizzes, flashcards, audio and collaboration. The supplied screenshots informed a goal-first contents page and explanation/example/checkpoint teaching flow. This release does not claim complete feature parity or access to Turbo's private implementation.

## Changes
- Sidebar uses the icon-only Syaahi lockup; duplicate horizontal room tabs removed, responsive rail retained.
- Chat no longer displays routing/model badges; ask APIs omit model/provider metadata and return safe errors.
- Composer defaults to Auto page planning. The planner chooses 1–24 distinct sections from topic/source breadth. Students review and edit the outline and credit cost before generation. Explicit page targets remain available. Failed planning falls back visibly to an editable single section, without padding invented headings.
- Learn generates a separate explanation, illustrative worked example and four-choice understanding checkpoint per available note section. Goal selection influences generation.
- Authenticated `/api/learn` checks lesson membership, validates model JSON, caches teaching by source-content hash/goal/language, grades answers server-side and atomically stores individual progress using the existing SQLite/Mongo state layer. Changes to note content invalidate prior teaching/progress. Checkpoint answers are omitted until submission; feedback is returned after an attempt.
- Listen uses the existing speech API for owners; Ask Syaahi opens grounded chat. Voice still requires configured Gemini credentials and quota.
- Landing exam cards, study cards and retention cards use scroll-up reveals with reduced-motion support. Fixed mobile overflow from intrinsic placeholder sizing and removed unsupported comparison/privacy promises.

## Verification
- Production Next build and TypeScript check.
- Existing ledger and study suites.
- `npx tsx scripts/check-learning.ts`: isolated SQLite database, real HTTP auth/learning routes, foreign-user denial, stale-content rejection, malformed teaching JSON rejection, answer redaction, incorrect answer safety, browser teaching/checkpoint/reload persistence, 390/768/1440px overflow and logo/navigation checks.
- Teaching content in the browser/API regression suite is a deterministic cache fixture. This does not measure live model quality or verify deployed provider availability. Voice generation was not re-tested against a paid/live provider in this release.
- Local screenshots: `output/qa/learning-*.png` (ignored). Private investor PPT remains excluded from Git.

## Deployment
Both Vercel frontend and Render backend must deploy this commit because `/api/learn` is new. Existing API proxy middleware includes this route automatically. No manual database migration is required: study state uses the existing persistence layer. Production auth-protected lesson content was not inspected using a customer's session.

## Tutor, completion and reference-note update
- Ask Syaahi opens a dedicated lesson tutor drawer. The server loads the authorized section and cached teaching step; goal, explanation/example/checkpoint context and bounded history accompany the question. Checkpoint mode requests hints rather than the answer. Conversations are separated by lesson content version and section.
- Completed sections show an animated completion ring, real persisted attempt count, feedback and next-section/contents controls. Completed checkpoints no longer accumulate attempts on replay. Reduced-motion preferences disable celebratory animation; the drawer supports Escape, focus containment and focus restoration.
- Added selectable **Study notebook** PDF template, inspired by the user-provided one-page Algorithms PDF: blue handwriting, maroon underlined headings, plain warm paper and boxed flowcharts. Rendering uses the same document engine in preview and export, with pagination retained. This is a typographic approximation, not an exact copy of the reference person's handwriting.
- Generated and visually reviewed `output/pdf/study-notebook-sample.pdf`: one A4 sheet, no body overflow. Reference and output PDF images inspected locally; private sample remains outside Git.
- Updated browser/API regression covers tutor drawer opening/closing and persisted two-attempt completion. Production build, study suite and ledger suite pass. An optional `LIVE_TUTOR=1` run successfully exercised the real tutor provider path with synthetic study material and confirmed no model/provider response metadata. This is a functional smoke check, not a broad teaching-quality assessment.
