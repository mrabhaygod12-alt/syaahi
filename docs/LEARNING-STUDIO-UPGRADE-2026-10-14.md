# Source-aware learning and practice studio

This increment improves the existing university learning workflow. It uses Syaahi’s authenticated lesson jobs, goal-specific teaching cache, per-account study state, and SQLite/Mongo storage. It does not claim access to NotebookLM or Turbo’s private generation pipeline.

## Changes

- Guided lesson overview shows saved learning outcomes, prerequisites, section count, and passed checkpoints. Understand, worked example, and checkpoint steps have direct navigation and links back to the supporting note section.
- Changing a goal or note revision clears stale teaching UI and ignores late responses. Existing goal-specific progress and saved phase resume remain authoritative on the server.
- Practice controls expose 5–30 questions, 6–36 flashcards, style, difficulty, and optional concept focus. The selected settings persist with the generated practice set.
- Model output identifies supplied, zero-based note sections. Invalid or invented section references are removed; items with no valid supporting section are rejected. Displayed links use the actual saved section titles, not model-created URLs. These links identify supplied material, rather than proving that every generated explanation is factually correct.
- Quiz attempts persist the current question. A completed attempt can create a server-selected missed-only attempt. Questions outside that subset cannot be answered or selected. Scoring uses the selected subset, while a full attempt remains available afterwards.
- Duplicate starts resume a single active attempt; first practice answers remain locked; exam feedback stays hidden until submission; submitted result replay does not duplicate history.
- A generation request cannot replace practice while an unfinished attempt exists, including when the caller omits `regenerate`. A result based on notes that changed during generation cannot replace current practice. Saved practice and attached card images update the lesson revision for other open devices.
- Flashcards expose count/difficulty before generation, topic filtering, supporting notes on the answer side, and the existing persisted spaced review schedule. Model-created image URLs/data are discarded; owned learner image uploads remain separate.
- The lesson, quiz, and card surfaces share responsive, accessible controls and explicit light/dark theme tokens. This is a learning workspace improvement, not complete feature parity with a competing product.

## Validation

Passed in this workspace:

- `npx tsx scripts/test-learning-studio.ts`
- `npx tsx scripts/test-learning-studio.ts --mongo`
- `npm run test:study`
- `npm run test:student-studio`
- `npx tsc --noEmit --incremental false`
- `git diff --check`

`scripts/test-learning-studio-browser.ts` provides a production-build check for guided phase resume, saved cursor, hints, supporting links, missed-only retry, flashcard scheduling, and 320/390/768/1440px layout screenshots. Run it after rebuilding `.next-validation`; it deliberately uses local fixtures rather than live user accounts or paid provider calls.

## Limits

- An accepted partial set is shown with the actual counts and a quality warning. Rejected model items are not silently padded with invented questions.
- Source links are to saved note sections. They are not an independent fact-check of original uploaded material.
- Quiz attempts remain study results rather than proctored exams. Short answers use the existing exact accepted variants, not semantic essay grading.
- Browser/build/deployment verification is coordinated separately for the final shared revision. No deployment was performed by this scoped worker.
