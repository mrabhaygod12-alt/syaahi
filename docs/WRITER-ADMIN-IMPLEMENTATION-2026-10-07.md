# Writer brief: implementation and verification ledger

The attached writer brief is being implemented in the existing Next.js frontend,
Render backend and persistent database. This ledger records shipped behavior;
unchecked items are not completion claims.

## Routing and account boundaries

- [x] Writer login starts at `/writer/welcome`.
- [x] Writer visits to legacy pricing, billing, support, profile, payments and
      reading routes resolve to their writer equivalents.
- [x] One-time student checkout URLs resolve to writer membership for an active
      writer. Writer pricing remains Free and Max ₹399/month.
- [x] Student private workspace paths resolve to writer welcome for an active writer.
- [x] Shared presentations, public author profiles and reviewed articles remain public.
- [x] Writer enrollment is required; visiting a page never enrolls a student.
- [x] Stale account/profile responses cannot overwrite a later account refresh.
- [x] Return paths reject external origins, encoded separators and control characters.
- [x] Global decorative dropdown arrows are absent; native selects retain keyboard operation.

## Admin routes and authorization

Actual routes: `/admin`, `/admin/users`, `/admin/publications`, `/admin/payments`,
`/admin/support`, `/admin/growth`, `/admin/security`.

- [x] Backend-derived roles: administrator, editorial, support and billing.
- [x] No default administrator. Bootstrap uses explicitly configured `ADMIN_EMAILS`,
      `SUPPORT_ADMIN_IDS`, `PAYMENT_ADMIN_IDS` and existing active payment-admin records.
      A stored role override can withdraw those bootstrap privileges.
- [x] Server-rendered route protection and backend authorization, including scoped
      admin pages and legacy payment/support endpoints.
- [x] Production requires a second factor. Enrollment needs the current password
      or a trusted Google session created within five minutes.
- [x] RFC 6238 authenticator codes, encrypted secrets, eight hashed single-use recovery
      codes, replay rejection and 15-minute elevation bound to one session.
- [x] Enrollment, OTP consumption, session elevation and audit commit atomically.
- [x] Account search/status filters, name edits, role changes, reversible removal,
      suspension and restoration; access/role changes revoke affected sessions.
- [x] Last-root protection, including concurrent administrator demotions.
- [x] Account detail includes credit balance, saved subscription, payment orders,
      story metadata and support links.
- [x] Privileged audit retention: 180 days. Audit records exclude passwords, factor
      secrets, recovery codes and support message content.
- [x] Students and writers can view and revoke their own devices/sessions.
- [ ] Admin user invitation/create workflow, expanded activity details and pagination.
- [ ] Authenticator replacement and recovery-code rotation with fresh verification.

For production, keep `ADMIN_MFA_KEY` stable: 32 random bytes encoded as base64,
server-only. An existing backend proxy secret of at least 32 characters is the
fallback derivation source. Changing this key invalidates decryption of stored
factors; plan a controlled migration before rotation. No production credentials,
roles, passwords or customer subscriptions were changed by these tests.

## Support

- [x] Student/writer ticket isolation, create, reply, resolve, reopen and close.
- [x] Conversation and queue entry commit together in SQLite/MongoDB transactions.
- [x] Create retries are idempotent; conflicting owners/workspaces are rejected.
- [x] Admin filters search before the 100-row result limit.
- [x] Priority, active-agent assignment, five statuses, public replies and private notes.
- [x] Revision conflicts require reload; internal notes/assignment IDs never appear
      in ordinary-user responses.
- [x] Note-error reports use the same transactional support store.
- [ ] Validated attachments, contact-request consolidation and consented outbound updates.

## Publishing and discovery already present

- [x] Private rich-text drafts, autosave/conflict protection, owned media, previews,
      submitted/changes-requested/published/removed states and editorial review.
- [x] Public author profiles, follow, saved reading lists, responses/highlights,
      reports and qualified reading analytics.
- [x] Public writer feature/pricing/comparison pages, server-rendered articles,
      canonical metadata, sitemap, story feed, product facts and machine-readable overview.
- [x] Student pricing: ₹9/₹39/₹79 one-time packs; ₹399 monthly. Existing contractual
      subscriptions are retained; retired offers cannot start new recurring purchases.
- [x] Source-bound AI SEO/AEO/GEO suggestions with explicit author approval;
      validated exact excerpts, private saved reports, revision checks and server-rendered
      approved search metadata. Editing content clears metadata for fresh review.
- [x] Direct draft links load the owned story by ID, including older than the recent
      50-story list. Cross-account IDs return 404.
- [x] Published-story private revisions retain the original public version until
      editorial approval. Approved changes reuse the original URL and publication date.
- [x] Author unpublish/republish, private revision deletion and pending-revision
      isolation. A pending revision must be finished or discarded before withdrawal.
- [x] Requested publication times, editorial-approved scheduling, durable worker
      execution, cancellation and editor return-to-author. Later moderation blocks a
      scheduled revision from resurrecting removed content.
- [x] Concurrent editorial decisions use compare-and-swap; parent/revision writes
      commit together. Page-view increments cannot overwrite content or moderation.
- [x] Private topic preferences, muted topics, opt-in reading history and diversified
      For you/Latest/Following feeds; related public stories are rendered on article pages.
- [ ] Author-muting controls in the UI and pagination beyond the bounded feed pool.
- [ ] Friendly author URLs and verified custom-domain lifecycle.
- [ ] Newsletter/subscriber lifecycle and publication teams.

No search rank, AI answer inclusion, Medium parity, automatic payouts, live payment
capture or immunity from every attack is asserted.

## Validation for this increment

- `test:workspace-routing`: writer/student destinations, safe return URLs and public paths.
- `test:admin-security`: SQLite and MongoDB; RFC vectors, encrypted secrets, OTP/recovery
  replay, session-specific elevation, revocation, role updates, blocked login,
  private-note redaction, optimistic conflicts and atomic writes. SQLite audit-outage
  injection verifies enrollment rollback.
- `test:admin-routing-browser`: production Next.js build, real test MFA enrollment,
  account edit, support reply/private note, unauthorized page/API denial, routing
  matrix and stale-response isolation; 390px, 768px and 1440px overflow checks.
- Existing authentication, consent/support, security and growth suites pass.
- Production build passes. Screenshots: ignored `output/admin/` artifacts, synthetic
  accounts only. Live verification must target the exact deployed commit.

- `test:writer-discovery`: SQLite and MongoDB ownership, verifiable excerpts,
  report reuse, explicit approval, stale revisions, concurrent edits and review locks.
- `test:writer-discovery-browser`: real production UI approval and persistence,
  old draft direct links, 390/768/1440px layout, public SSR metadata and private-field
  redaction. AI responses are synthetic fixtures, not a live provider claim.
- Routing/admin increment `93534b3` passed GitHub CI and exact-revision public
  verification on both frontend and Render backend on 2026-10-07.
- Discovery increment `295e9a0` passed GitHub CI and exact-revision frontend/Render
  smoke verification on 2026-10-08.
- `test:writer-publishing`: SQLite and MongoDB; revision approval, stable URLs,
  concurrent reviews/workers, cancellation, ownership, atomic transitions and
  protection against scheduled publication after moderation.
- `test:writer-publishing-browser`: production UI plus locally enrolled MFA editor,
  requested schedule, approval, author cancellation, stable public content,
  withdrawal/republishing and 390/768/1440px layouts. Synthetic accounts only.
- `test:workspace-upgrade` now follows the confirmed Max ₹399 recurring catalogue
  and asserts that retired Starter subscriptions cannot be newly created. Its old
  ₹39 recurring fixture was stale; one-time packs remain covered by pricing tests.

Scheduled publication requires the existing persistent worker (`npm run worker`)
or in-process worker. In external-worker mode, a paused worker delays publication;
the UI shows the persisted scheduled state until execution succeeds. Times are
stored as UTC; datetime inputs and displays use the user's device timezone.

Design/security sources: [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238),
[OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

## Writer editor reliability and reading increment — 2026-10-09

- Stable, owner-bound draft creation identifiers make identical retries idempotent.
  Conflicting retries and stale saves require a reload; no write is blindly replayed.
- Lost POST responses are reconciled by reading the owned draft and comparing the
  submitted content. Failed saves retain the editor content, show a clear status and
  offer a manual retry. Successful retries resume autosave.
- Publication scheduling no longer prevents saving text. Time validation still
  applies to review submissions, and editorial approval remains required.
- Image upload preserves the selected insertion position between paragraphs.
  The editor pauses editing during the image dialog to protect that position.
- The action bar and formatting ribbon stay below the fixed header while scrolling.
  Page width, a measured text-width ruler, paragraph indentation and wrapping titles
  improve long-story editing on mobile, tablet and desktop. Page width is a local
  viewing preference; paragraph indentation is saved in the document.
- Authentication uses a validated server origin, optionally configured at runtime
  with APP_ORIGIN. Google account linking requires server-controlled provider
  metadata and a confirmed email; user-editable identity claims cannot grant access.
- Recommendations use a bounded pool of 240 reviewed stories, up to 24 results,
  author diversification and capped popularity. History is excluded by default.
  Related reading shows up to six public articles with no private draft fields.
- Render's configured administrator eligibility was saved and deployed with the
  owner's explicit confirmation. The browser was signed into a different account,
  so the intended administrator's login/MFA flow remains unverified in production.

Validated: production build and typecheck; editor reliability on SQLite/MongoDB;
OAuth identity, auth and security suites; publishing and recommendations on both
databases; recommendation browser journeys; existing writer browser journeys in
Chromium/WebKit; and a real frontend-to-backend production proxy browser test.
The latter covers a 33k-character draft, committed write with lost response,
multipart image upload between paragraphs, indentation persistence, failed-save
retry, expired schedule draft save, review submission and sticky layouts at
390/768/1440px. Test accounts/media are synthetic. No customer article was edited
or published, no payment was executed, and live Google consent was not exercised.

## Writer connections and public activity — 2026-10-09

- [x] `/writer/following` and profile Connections tabs provide cursor-paginated,
      owner-scoped follower/following lists. Active follows and verified writer profiles
      are filtered before pagination; recent unfollows cannot hide older active follows.
- [x] Connection lists are private by default. The profile editor explicitly opts
      into public display; only public writer names, slugs, bios and photos appear.
      Student identities, account emails and internal owner IDs remain redacted.
- [x] Public story cards and article actions show database-derived likes, visible
      comments and approximate views. Likes and bookmarks persist across reloads.
- [x] Article menus provide share, responses, reports and existing-credit tips.
      Authors additionally receive stats, publication management and a private revision
      action; public content stays intact until the revision is reviewed.
- [x] Writer stats include connection counts and latest-50-story likes/responses.
      The UI distinguishes approximate views from qualified reading signals.
- [x] Account changes cancel or ignore stale engagement/follow/response results;
      old author controls cannot reappear in another reader's session.
- [x] Engagement actions appear immediately after the article. Response failures
      show a retry state instead of claiming that the discussion is empty.
- [x] View tracking records a successful response before marking the session viewed.
- [x] Public feature pages, product facts and the Medium comparison describe the
      delivered capabilities and remaining gaps consistently.

Validation: `test:writer-connections-activity` on SQLite and MongoDB; existing social,
writer-platform and creator-publication regressions; production social-workspace
browser tests at 390/768/1440px, including real profile opt-in, follow/unfollow,
like/save/comment persistence, author revision creation and stale-account response
isolation. Screenshots use synthetic accounts in ignored `output/writer-social/`.
The recommendation privacy regression now compares both cases at one fixed time;
the previous CI failure was a millisecond-dependent score comparison.

Still pending: profile pinning, newsletter/subscriber delivery, publication teams,
expanded audience analysis, user invitations, support attachments and the other
unchecked items above. No full parity with Medium is claimed.

## Atomic report moderation — 2026-10-09

- Report resolution and article takedown commit in one database transaction.
  Conflicting decisions cannot both succeed or leave an article removed while
  its report says dismissed. The removal event and moderator are recorded together.
- Stale report decisions return HTTP 409 with a reload instruction. Validation
  failures remain actionable; infrastructure failures return a safe reference ID
  through the shared API handler, without database diagnostics in the response.
- `test:writer-moderation` covers SQLite and MongoDB: forced database-write failure
  and rollback, dismiss/takedown races, duplicate takedown, two reports on one
  article, retained views, server authorization and API conflict/error responses.
  Existing publishing and creator-publication regressions pass. Faults are injected
  only into synthetic test databases; no production article/report was changed.
