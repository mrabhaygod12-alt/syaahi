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
- [x] The writer shell verifies the profile owner against the active account before
      mounting private pages; a mismatched HTTP 200 response exposes no profile controls.
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
- [x] Authenticator replacement and recovery-code rotation with fresh verification.

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
- [x] Private author-muting controls, validated public writer handles/URLs and unmute.
- [ ] Pagination beyond the bounded feed pool.
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

Still pending: newsletter/subscriber delivery, publication teams,
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

## Private feed controls and rendering reliability — 2026-10-10

- Writer settings can add up to 30 public writers to a private muted list using a
  Syaahi profile URL or handle. Server validation rejects unavailable/unverified
  profiles. Save/reload and unmute persist on both databases; muting neither unfollows
  the writer nor hides their public pages.
- Loading failures and revision conflicts offer an explicit reload. Account changes
  abort pending lookups/saves and hide the previous account's form. Empty feeds link
  to reading preferences rather than incorrectly asking established authors to write
  their first story.
- Public story dates and counts use a fixed locale/timezone across server and browser.
  Asynchronous account context updates use a transition while the refresh loading gate
  stays immediate. CI reported a hydration mismatch; browser regression coverage now
  includes a different device locale/timezone and repeated navigation at 4x CPU slowdown.
- Validated: recommendation persistence/privacy on SQLite and MongoDB; production
  recommendation/social browser journeys, mobile/tablet/desktop layouts, admin routing
  and public discovery. Screenshots remain synthetic and excluded from Git.
- `58ac6fd` passed CI and exact-revision frontend/Render checks. The atomic moderation
  increment's backend tests passed, but its CI run exposed the browser hydration failure
  addressed here; its failed run is not recorded as successful verification.

## Ordered profile pins — 2026-10-11

- Writers can pin up to three approved, currently published stories, reorder them
  and unpin from their profile. The article author menu can pin an older story that
  is outside the latest-50 picker. Duplicate pin actions are idempotent.
- Pin records are owner-scoped and use a separate saved revision. Concurrent changes
  return 409 and require reload; no draft, submitted revision or another author's
  article can be pinned. Public DTOs expose only a pinned label on visible stories,
  never internal pin IDs, account IDs or review records.
- Public pages and creator APIs retrieve older pins directly, check current publication
  status and omit withdrawals/takedowns. Approved articles appear once in the selected
  order. Public creator responses are not cached with stale publication visibility.
- The private profile preview uses the same public order and refreshes after pin changes.
  Pending profile/pin requests are cancelled when their owner changes.
- The picker filters published, owned stories before its result limit, projects only
  summary fields and uses supporting SQLite/MongoDB compound indexes.
- Validated: `test:writer-pins` on SQLite/MongoDB, ownership/approval gates, the three-pin
  limit, idempotency, ordering, retrieval beyond the 100-story public pool, withdrawal/
  removal filtering, private-field redaction, concurrent writes and API authorization/
  origin checks. Production browser coverage includes pin/reorder/unpin persistence,
  server-rendered public ordering, conflict reload, the author article menu and
  390/768/1440px layouts. Screenshots are synthetic in `output/writer-social/profile-pins-*`.
- Rendering/preference increment `7ddde4e` passed full GitHub CI. Frontend and Render
  reported that exact revision. One proxy health request timed out during the smoke
  run; subsequent direct and proxied health checks both returned HTTP 200 with MongoDB
  available. No payment or customer content was changed during verification.
- Ordered pins increment `f6e2595` passed full GitHub CI and exact-revision public
  smoke checks on frontend, proxied backend and direct Render, including MongoDB health.

## Profile save recovery and safe errors — 2026-10-11

- Profile input uses explicit validation errors. Invalid objects, field types, photos,
  website URLs and appearance values return actionable HTTP 400 responses; stale edits
  return 409. Unexpected infrastructure errors go through the shared 503 handler with
  a support reference, rather than exposing raw database diagnostics as validation errors.
- Every save compares the stored revision inside the database mutation. Direct callers
  without a supplied revision still compare the initially loaded snapshot, including
  edits delayed by photo processing. Conflicting writes cannot silently overwrite a profile.
- The editor uses the revision belonging to the displayed form. Conflicts retain unsaved
  text, block another write and offer a manual reload with discard confirmation. Service
  errors retain the form and display the support reference; writes are never replayed
  automatically. Appearance updates can reload after a conflict without overwriting
  a newer profile detail. Pending requests/photo reads are aborted when the form closes.
- Validated: writer-platform and connections suites on SQLite/MongoDB; profile validation,
  explicit/implicit concurrent saves, database-write fault injection with rollback and
  response redaction; typecheck and production build. Production browser journeys cover
  real competing-tab conflicts, reload, injected service-response recovery, support
  references, persisted profile changes and theme-conflict recovery.
- Profile recovery increment `9a55149` passed full GitHub CI and exact-revision public
  smoke checks on frontend, proxied backend and direct Render with healthy MongoDB.

## Draft, publishing and media service boundaries — 2026-10-11

- Draft create/save/delete, publication changes, editorial reviews, image uploads and
  public content reports expose only deliberately typed validation/conflict messages.
  Unexpected database errors return HTTP 503 with a support reference through the shared
  handler. Existing validation messages and 409 conflicts remain actionable.
- Invalid JSON shapes, malformed canonical URLs and malformed document formatting return 400. Empty saved revisions cannot bypass the draft API's conflict guard. Invalid images
  show a concise format/size message rather than image-processor diagnostics.
- Editor and publication controls display safe support references. Lost/uncertain write
  responses still use a read-only reconciliation; known 4xx rejections do not trigger that
  read or an automatic write retry. Unsaved text remains in the editor on failure.
- `test:writer-service-errors` injects failures into synthetic SQLite/MongoDB databases
  for create/save, revision deletion, withdrawal/revision creation, editorial approval,
  upload and report writes. Tests verify safe 503 references, rollback, retained public
  visibility, no partial parent/revision updates and successful explicit recovery.
  This suite now runs in CI. Existing publishing, moderation, discovery, social, editor
  reliability and writer-platform regressions pass on their supported databases.
- Production build and browser regressions pass: editor through a real local
  frontend/backend proxy, JSON 503 reference and explicit save retry, committed write
  with lost response, inline image position, saved indentation and sticky tools;
  MFA-authorized publishing/withdrawal; social/profile journeys. Layouts are checked at
  390/768/1440px. All accounts, images and database outages are synthetic.
- Draft/publishing increment `257663f` passed full GitHub CI. Its first deployment
  smoke check found the new frontend while Render still served the preceding revision;
  both backend health endpoints were healthy. That run is not counted as exact-revision
  deployment verification.

## Active writer account isolation — 2026-10-12

- The writer shell verifies that the loaded profile belongs to the active account
  before mounting private pages. A mismatched HTTP 200 response shows a retry message
  without exposing another profile's edit or pin controls. Private page state remounts
  for a different profile owner.
- Validated: typecheck, production build, editor proxy browser regression and the
  social workspace browser journey. The latter injects a different owner's profile,
  checks that private controls remain absent, then reloads the correct profile.
  Existing account-switch, locale/timezone, slow-CPU and 390/768/1440px checks pass.
- This increment's CI run exposed an intermittent private-profile hydration error,
  despite its local browser pass. It is not recorded as a successful CI run. The
  following increment adds background transitions for asynchronous profile/access
  results and a dedicated fast-response/slow-device production browser regression.

## Administrator factor maintenance and privacy — 2026-10-12

- Administrators can regenerate eight single-use recovery codes or replace their
  authenticator. Both operations require a current password or a trusted Google
  session no older than five minutes, plus a fresh enrolled factor. An existing
  elevated session alone cannot authorize a change; future-dated OAuth sessions
  are rejected. Codes remain hashed and authenticator secrets encrypted at rest.
- Replacement setup is session-bound and expires after ten minutes. The existing
  authenticator remains active until confirmation. A replacement can be cancelled;
  confirmation invalidates the old factor/codes and administrator elevation in other
  sessions. Recovery-code rotation also expires other administrator elevations.
- Factor changes, code consumption, session elevation and their audit records commit
  together. Concurrent reuse succeeds once. Audit outages roll back every change.
  MFA APIs expose typed validation errors and safe 503 references for infrastructure
  or encryption faults, without database/decryption diagnostics.
- Security UI offers explicit status reload, error references, code copy/hide and
  labelled verification forms. Requests abort on unmount. The admin shell verifies
  its access response's owner, hides private pages while accounts refresh and remounts
  them for a different account, clearing previously displayed factor setup/codes.
- Validated: `test:admin-mfa-lifecycle` on SQLite/MongoDB, including atomic audit
  fault injection, replacement/rotation, expiry, cancellation, wrong-session setup,
  code replay/concurrency, old-code and other-session invalidation, encrypted storage,
  audit redaction and old/future Google-session rejection. Existing admin-security,
  security-boundary and workspace-routing suites pass.
- Production build/typecheck and expanded admin browser journeys pass: actual
  synthetic MFA rotation/replacement, service-reference retry, wrong-owner access
  rejection, account-switch removal of private controls and 390/768/1440px layouts.
  Synthetic screenshots are in ignored `output/admin/factor-maintenance-*` files.
  Writer social journeys and twelve repeated private navigations with instantaneous
  account/profile responses, a different locale/timezone and 4x CPU slowdown pass.
- Factor-change reauthentication follows the [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html#changing-mfa-factors).
  Live target-account MFA and out-of-band factor-change notifications remain
  unverified/unimplemented; no production authenticator was enrolled or replaced.

## Writing studio and university Blog — 2026-10-12

- Editor now has an explicit AutoSave toggle (on by default), visible Save draft,
  Ctrl/Cmd+S, and a distinct private, read-only reader preview with title, byline,
  formatted body and uploaded images. Returning restores the selected ribbon tab.
  Automatic saving waits four seconds after editing; failures keep unsaved content
  and offer an explicit retry. Conflicts and uncertain responses retain the existing
  ownership/version/reconciliation protections.
- Design adds illustrated theme cards, persisted article margins and an optional
  device default for new drafts. Review offers structural/accessibility/source checks,
  word counts, browser spellcheck and version history. View offers paper/web layout,
  focus, heading navigation, ruler/grid toggles, responsive text zoom and printing.
  This is a continuous web article canvas, not a complete desktop Word implementation.
- Draft JSON import preserves structured headings, references, design and article
  byline in a new story. Images still require an owned upload. Imports cannot replace
  saved stories or import ownership/review state.
- Optional per-article bylines persist in both databases, retries and private revisions;
  publishing updates the credited name without changing the account profile or owner.
  The admin review shows both article credit and the writer account name.
- Student navigation and the learning workspace link to `/blog`. Its server-rendered
  index combines the latest 48 approved public writer stories with existing study
  guides, searchable topics, cover images, pagination, canonical article links and
  Blog structured data. Submitted/draft/removed stories stay private; a backend outage
  is labelled while existing study guides remain available.
- Four original ~800-word, source-checked articles and four original workflow images
  are prepared under `docs/articles/2026-10-12`, credited to Chandan Pandey as requested.
  `scripts/prepare-editorial-articles.ts` builds importable JSON and PNGs from the text
  and SVGs. All four live submissions are verified below; editorial approval is pending.
- Validated: production build/typecheck, editor reliability and publishing on both
  SQLite/MongoDB, writer-platform, routing/SEO, the real local frontend/backend proxy
  journey (autosave toggle/manual save/import, byline, read-only preview, design
  persistence, service retries, submission/public Blog boundary and all ribbon tabs
  at 390/768/1440px), plus the existing Chromium/WebKit writer browser journey.
- Initial CI caught MongoDB converting an absent optional byline in saved-version
  arrays into null. Version snapshots now omit absent bylines rather than passing
  undefined to BSON. The existing fault-injection suite verifies exact state retention.

## Live submissions and Following hydration — 2026-10-12

- All four requested articles were imported, illustrated and submitted through the
  live writer UI with Chandan Pandey as their per-article byline. The OpenAI draft and
  image survived an autosave/reload check. During deployment, one Claude draft save
  received a 502; text remained in the page and explicit retry recovered the draft.
  The later submission succeeded. The fourth saved draft reopened after the user
  signed in again and submitted successfully. No approval gate was bypassed.
- Live submission identifiers and verification state are recorded in
  `docs/articles/2026-10-12/live-submissions.json`. An administrator must review them
  at `/admin/publications` before they become public and appear on the Blog.
- Private story cards now show the per-article byline when present, matching the
  reader preview, admin review and approved public pages. The proxy browser journey
  checks the credited name in the actual In review list after submission.
- Live visual verification found that dark workspace colors leaked into the light
  paper preview: pale body/summary text and a dark review notice reduced readability.
  Article paper now defines its own ink/surface tokens. The production proxy browser
  checks actual rendered text contrast (at least 4.5:1) in light/dark workspaces at
  390/1440px, including body, summary, image caption, byline and review state.
- CI passed the editor proxy and publishing checks, then exposed an intermittent
  HTML hydration error on `/writer/following`. Unlike the other private workspace
  pages, Following passed a server-created child tree into the asynchronous account
  gate. The page now constructs the child tree within the client boundary, following
  the profile/library/stories pattern. Account and ownership gates remain enforced.
- Production build/typecheck, the social workspace browser journey and an expanded
  24-navigation stress test across Profile/Following/Stories pass locally, including
  immediate account/profile responses, wrong-owner gates, different locale/timezone
  and 4x CPU slowdown. Final CI and exact-commit deployment verification remain to run.
