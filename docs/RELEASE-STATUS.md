# Syaahi release status

## Latest change: signup and referral wallets

New signup allowance is 19 credits (6⅓ tokens), replacing the historical five-section offer. Existing users retain their balances. An eligible verified signup gives the inviter five reward credits. Password users verify by a one-hour emailed link; Google uses its confirmed identity. Reward credits transfer atomically into study balance; repeated login, verification and transfer retries do not mint extra credits. Both SQLite and MongoDB tests cover these rules and the 20-reward monthly cap. Resend sender/key configuration and actual email delivery still need deployment verification.

Manish Kumar Singh is now visible in the introductory creator section, with the supplied DevOps Engineer & Researcher role. APInex's endpoint and free catalog are corrected; Zen has additional documented chat-compatible free models. Current live access to these gateways remains unverified; see PROVIDERS.md. Historical bullets below describe the earlier release where applicable.

Verified locally, 24 September 2026. Working software and external configuration are distinguished below.

## Implemented

- Responsive interface, unified composer, navigation/footer, subjects, interview coaching, docs/policies, animated walkthrough and creator About page.
- Topic/material planning, editable outline, screenshot extraction, PDF/DOCX/PPTX/text input, YouTube captions and microphone recording.
- Handwritten-style notes with flow, cycle, layer, decision and concept graphics, formulas, tables and preserved code. Preview and PDF share a renderer; long sections continue rather than stretch.
- Saved notes, revision conflict detection and reviewable AI rewrite proposals.
- Grounded chat, Gemini-recorded voice questions and Gemini voice playback.
- Mixed quizzes, focus/difficulty, explanations, saved attempts and weak-area review. Typed answers use exact text matching, not essay grading.
- Saved folders and flashcard due dates. Scheduling uses simple intervals, not FSRS.
- Gemini audio studio: short/deep scripts, five voices, delivery style, speed controls and real WAV downloads. Gemini transcription was verified against generated speech.
- Viewer/editor invitations, revocation, private-source redaction, comments, shared lesson discovery and periodic refresh with stale-write protection.
- Password accounts, Google OAuth code path, mandatory Terms/Privacy acknowledgement, saved consent version and HttpOnly sessions.
- Private support tickets, configured staff inbox/replies, resolve/reopen. Email notifications are not enabled.
- One token covers three generated sections. Integer page-unit accounting preserves existing allowances. Packs: ₹9/1 token, ₹39/5, ₹79/12, ₹179/30. Continuation sheets are free.
- Verified-capture payment ledger, referral eligibility/replay protection, reward counts and monthly allowance display.
- SQLite local mode; MongoDB transactions for cloud accounts/jobs/billing/state; cloud request throttles; worker leases; Vercel/Render proxy guard and deployment files.
- Central API errors with request references and private-response cache prevention. Provider keys stay server-side; six credential slots do not multiply quotas.

## Passed checks

- Production build and TypeScript checks.
- Ledger tests: competing reservations, lease ownership, duplicate page commits, refunds, resume and payment identity/replay.
- Actual local MongoDB replica-set transactions: competing jobs/leases, restart, duplicate payment capture, referrals, authentication and study state.
- Sharing tests: unrelated-account rejection, viewer/editor permissions, stale edits, independent progress, source redaction, comments and revocation.
- Referral tests: self-referral rejection, verified first purchase and one-time rewards.
- Consent/support tests: refusal without acceptance, saved version, ticket isolation, staff replies and resolution.
- Office extraction: paragraphs/entities, numeric slide ordering and invalid archive rejection.
- Proxy tests: direct backend refusal, configured rewrite and replacement of forwarding headers.
- Live Groq lesson/chat/practice/interview calls; Gemini screenshot extraction, WAV generation and transcription. Gemini initially returned temporary overload; subsequent transcription passed.
- Browser checks: public routes, desktop/mobile overflow, note editing, quiz, flashcard review, consent signup and support conversations. Recording UI uses a synthetic microphone and stubbed transcription; real Gemini transcription is tested separately.
- Original 20-section Bash notes reflow into 51 A4 sheets with selectable text. Visual contact-sheet review found no stretching. Content accuracy was not independently reviewed; some continuation sheets have spare space.
- Source scanned against configured local secret values. Runtime databases, environment files, private exports and QA artifacts are excluded from Git.

## External configuration required

Google login needs Supabase and Google provider configuration. Razorpay needs merchant credentials and webhook/checkout testing. Atlas, Vercel, Render and Cloudflare provider dashboards are operator managed. Support needs trusted operator account UUIDs and a real commercial contact. Follow DEPLOY.md.

## Turbo parity limits

Research covers Turbo’s public pages, not exhaustive private-app testing. Syaahi has Markdown editing rather than a full Google Docs-style editor. Collaboration uses periodic refresh and conflict rejection, not live cursors or simultaneous character merging. The app is an installable responsive website, not separately published native apps. The book/AP library is unpopulated; competitors’ copyrighted books are not copied. Multiple-file synthesis, word-level lecture timestamps and semantic essay grading remain future work.

## Security and capacity

Zero attacks cannot be guaranteed. NIST CSF mapping is an assessment, not certification. Capacity for 100,000 simultaneous users is not demonstrated. Cloud upload limits, live checkout, recovery/email verification, backups, monitoring, coordinated provider budgets and incident procedures remain launch gates. The support inbox currently displays the latest 100 tickets; larger operations need pagination and retention policies.
# Vercel frontend cutover — 27 September 2026

The retired static-host deployment file, runtime branches and old private environment template have been removed. Commit `86d003b` fixes Vercel's `.next` output mismatch. The Vercel-mode production build and protected API proxy check pass locally. Render API `/api/health` returned HTTP 200.

The provider dashboards and custom-domain cutover are not fully verified from this workspace. Current DNS check: GoDaddy nameservers (`ns45.domaincontrol.com`, `ns46.domaincontrol.com`) are authoritative; `www.syaahii.in` resolves to Vercel edge IPs, while the apex `syaahii.in` does not resolve. HTTPS at `www` did not complete from this workstation. Add both names in Vercel Project Domains, use the exact records it displays in GoDaddy, and wait for HTTPS before switching OAuth/payment callbacks. Render's private environment and Vercel's project environment still need to be confirmed in their dashboards.
