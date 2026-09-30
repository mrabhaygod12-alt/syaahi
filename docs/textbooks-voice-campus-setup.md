# Textbooks, voice practice and campus pilots

## Deployment configuration

Frontend (Vercel): keep `APP_ROLE=frontend`, `BACKEND_URL` pointing to the Render API, and the matching `BACKEND_PROXY_SECRET`. Public guide pages now fetch published content from that backend; they do not require frontend database credentials.

API and worker: use the same MongoDB database. Run the persistent worker with `npm run worker` and `WORKER_MODE=external` on the API. The worker processes generation jobs, textbook embedding batches, and configured reminders. A sleeping/free API or stopped worker cannot provide continuous availability.

## Textbook retrieval

Text PDFs are limited to 10 MB, 500 physical pages, 3 million extracted characters and 2,500 chunks. Scanned PDFs need OCR first. Select a chapter page range and enter a specific topic in the workspace. Keyword retrieval (BM25) works without an embedding service. Citations identify physical PDF pages, which may differ from printed page numbers.

For hybrid retrieval, configure **both API and worker** with:

- `QDRANT_URL`: HTTPS endpoint for your Qdrant instance.
- `QDRANT_API_KEY`: its private access key when required.
- `GEMINI_EMBEDDING_API_KEY`: dedicated Gemini embedding credential.
- Optional `GEMINI_EMBEDDING_MODEL`: defaults to `gemini-embedding-001`, 768 dimensions.

The worker embeds 16 chunks per batch with a durable cursor. Notes can use BM25 while vectors are being prepared or if semantic search fails. Embedding calls incur provider usage. Vector search currently requires MongoDB mode and the standalone worker; local SQLite mode uses BM25.

Keep the embedding model fixed for existing documents. To change models, delete old documents while the old configuration is still active, let vector cleanup finish, then change the model and upload again. Deleting a textbook immediately removes application access and extracted text. Vector cleanup waits at least two minutes and retries through the worker; retain the old vector service credentials until cleanup completes. Existing generated lessons retain their saved citations/text.

## Live voice practice

Set `GEMINI_LIVE_API_KEY` (or existing server `GEMINI_API_KEY`) and optionally `GEMINI_LIVE_MODEL` on the API. The default is `models/gemini-3.8-live`. Confirm model access in your Google project. No permanent key belongs in a `NEXT_PUBLIC_*` variable.

The browser asks for microphone permission, receives a single-use constrained token, and connects directly to Gemini. Test on HTTPS with microphone permission. Verify the first question, spoken answer transcription, interruption, ordered audio playback, Stop, navigation away, permission denial and network failure. Microphone tracks must stop in every exit path. The interface ends sessions after 15 minutes; the provider can end them earlier. Automatic reconnection is not implemented yet.

After stopping, learners can explicitly consent to saving the transcript privately. `/interview/sessions` lists up to 20 saved sessions; individual pages reopen transcripts, request coaching, delete sessions, and print/save a PDF through the browser. No raw audio is saved. Limits are 300 transcript turns and 40,000 characters per session. Saving again after a network error is idempotent; it cannot overwrite a different transcript. The learner must delete an old session when the 20-session limit is reached.

Coaching uses the existing configured text AI providers and evaluates transcript structure, relevance, clarity and evidence. It does not assess accent, emotion or hiring suitability. Report failures preserve the saved transcript. A review lease prevents concurrent duplicate requests and expires after three minutes if the process crashes. Deleted sessions are not recreated by a late coaching response. Print layouts exclude navigation and action controls.

Protocol references: [ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [WebSocket setup](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket).

## Campus and institution pilot applications

Applicants use `/campus` or `/enterprise` with a verified account. `/admin/campus` is restricted to the existing `ADMIN_EMAILS` allowlist. Every decision requires a note and records the administrator and time. Applicants see their own status, not internal review notes.

These are pilot applications, not organisation provisioning, paid employment, commissioned ambassador payouts, or university endorsement. Application contact is manual; no automatic acceptance email is promised. Institution seat billing and access provisioning remain future work.

## Validation

- `npx tsx scripts/test-textbook-campus.ts`: 500-page retrieval fixture, citations, account isolation, deletion, consent and review history.
- `npm run test:creator-publications`: guide lifecycle and idempotent credit tips in SQLite.
- `npm run test:mongo`: replica-set transactions, concurrent tip replay, reactions and private textbook access, alongside existing auth/billing tests.
- `npm run check` and `npm run build`.
- `npm run test:public-guides`: public field allowlist and frontend/backend reads.
- `npm run test:voice-browser`: simulated voice handshake, audio input, microphone cleanup and mobile campus layout.
- `npm run test:voice-sessions`: save consent, replay safety, account isolation, report validation, review leases and deletion.

Provider credentials, real microphone conversations and deployed Qdrant connectivity require a deployment smoke test. Automated mocks do not prove provider availability.
