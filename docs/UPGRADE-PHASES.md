# Syaahi phased upgrade programme

This is the implementation record for the 56 recommendations. Items below are a roadmap, not a claim that all features are delivered.

## Phase 1 — source trust and practice quality (shipped: 8ae8259)
YouTube host validation; educational-content assessment; public video digest fallback when captions are unavailable; honest source labels and review; settings/source-version-specific practice cache; coverage-based flashcard quantity; duplicate/malformed item filtering; private provider diagnostics.

## Phase 2 — usable product demonstration (implemented and browser-tested)
Working landing sample with notes/lesson/quiz/flashcards; scroll transitions with reduced-motion support; real-state loading; referral wallet loading/access states and clearer reward journey; dashboard guidance.

## Phase 3 — operating capacity (next)
Configurable bounded worker/pool settings; external worker startup validation; admission limits; load-test harness and recorded results. Capacity requires measured infrastructure and provider quota; no 100,000-user guarantee.

## Further learning phases — pending
Diagnostic onboarding, prerequisites, adaptive hints/misconceptions, teach-back grading, source-linked citations/timestamps, subject-specific layouts and diagram validation, selective regeneration, exact step resume, mastery separate from completion, spaced revision improvements, mistake cards, question banks and adaptive difficulty, shared concept structure, provider quality evaluations.

## Product validation — requires real-world evidence
A student pilot, retention data, verified syllabus coverage, unit economics and real testimonials cannot be manufactured by code. Keep marketing tied to shipped features and publish measured results only.

Phase 2 checks: production build; working demo quiz and flashcard; responsive study and landing checks at 390/768/1440px; referral verification/transfer HTTP and mobile browser checks. The existing verification endpoint accepts email bearer tokens, so the regression checks invalid-token rejection rather than requiring a pre-existing same-user session.
