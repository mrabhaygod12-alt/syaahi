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

## Measured local capacity smoke check (26 September 2026)
- SQLite and Mongo replica-set tests: six concurrent requests, active-job limit two, exactly two admitted, four rejected, balance 21 -> 19. Rejected reservations roll back.
- Local production server, SQLite, one authenticated account, GET /api/credits: 100 requests in batches of 20; zero failures; p50 17 ms, p95 31 ms in this run. This measures a local read endpoint only, not AI throughput or production user capacity.
- WORKER_CONCURRENCY (1–4, default 2), PAGE_CONCURRENCY (1–3, default 2), MAX_ACTIVE_JOBS_PER_USER (1–20, default 3), MONGO_POOL_SIZE (5–100, default 20). Mongo wait queue timeout is 5 seconds.
- Dedicated worker explicitly starts even when WORKER_MODE=external is inherited; web instances still do not start an embedded worker in external mode.
- Scale workers only within provider quota. Approximate simultaneous generation calls = worker instances × worker concurrency × page concurrency; repair and metadata calls add overhead. Match Atlas connections and Render memory to replica count.
- Public YouTube video fallback is implemented against Google's documented file_data/file_uri interface. Live caption-less video success was not established in this release; private/restricted/unreadable videos and unknown duration can still require an uploaded source.
