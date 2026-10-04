# Separate student and writer experiences — 4 October 2026

This release follows the [project audit and 54 recommendations](WRITER-PLATFORM-AUDIT-2026-10-04.md). The supplied Word screenshots guided the selection of useful article tools. This is a working repository update; a Git push does not establish that both hosted services deployed successfully.

Implementation began on 4 October; final local verification completed on 5 October 2026.

## What changed

Student and writer experiences now share account authentication, one subscription and one credit wallet while using separate navigation, profile presentation, support channels and destinations. Becoming a writer still requires explicit signup with the existing account's credentials. Membership never grants writer enrollment or another signup allowance.

The public homepage renders its landing content statically. Recent reviewed stories load separately from the public API; a slow or unavailable backend leaves useful discovery links visible without blocking the hero or requiring JavaScript to reveal the page.

The generic streaming skeleton is now scoped to private workspaces, keeping it off public landing pages. Student/writer route checks still run before their private views mount.

| Entry or route                                                                                    | Result                                                                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Writer signup/login, including a student dashboard return URL                                     | `/writer/welcome`, a dedicated writing welcome page                    |
| `/writer`                                                                                         | Discover reviewed stories; Home remains distinct from the welcome page |
| Student dashboard/header/footer/pricing                                                           | Learning tools and plans; no writer workspace controls                 |
| Writer opens `/dashboard`, `/generate`, `/lesson/...`, `/presentations`, `/interview` or `/refer` | Writer welcome page before the student view mounts                     |
| Writer opens old `/pricing`                                                                       | `/writer/membership`                                                   |
| Writer opens old `/support`                                                                       | `/writer/support`                                                      |
| Writer opens old `/profile`                                                                       | `/writer/settings`                                                     |
| Writer opens old `/account/billing`, `/subscribe/...` or `/payments/...`                          | Corresponding writer billing, checkout or receipt page                 |
| Public `/writing`, `/community`, `/creators/...` and `/guides/...`                                | Editorial navigation; creator links remain public                      |

Return URLs reject external origins, double-slash addresses, backslashes and control characters. Writer service pages verify the account and enrollment before showing their working controls. Account routing uses the server session rather than trusting a local-storage display cache. The old dashboard's second session request was removed to avoid competing redirects.

## Delivered improvements

1. Writer login opens its own welcome page.
2. Welcome actions create a story, resume an actual editable draft or discover stories.
3. Student dashboard has no writer switch.
4. Student navigation has no Write & publish menu.
5. Student footer has no writer workspace links.
6. Student pricing describes learning features.
7. Old pricing links retain writer context.
8. Old support links retain writer context.
9. Old account-profile links open writer settings.
10. Old checkout and receipt links retain writer context.
11. Writer membership has Free, Starter, Pro, Max and a quote-based Team contact.
12. Writer checkout uses the existing consent-gated subscription API.
13. Writer billing uses actual subscription state and the existing cancellation operation.
14. Writer receipts use owner-checked payment state.
15. Writer support creates, reloads, replies to, resolves and reopens persisted tickets.
16. Ticket channels are assigned from the trusted API path, never a submitted workspace field.
17. Student and writer ticket lists stay separate; older tickets default to student.
18. Incorrect-channel ticket access returns 404; authorised staff retain their common inbox.
19. Authentication submits immediately with honest progress text and a bounded request.
20. The unconditional 90-second health preflight and its startup warning are gone.
21. Login requests are not automatically replayed; closing the dialog aborts its active request.
22. Google callback destinations use the same workspace routing rules.
23. The compact public navbar uses direct links and a responsive menu.
24. The mobile menu supports Escape, outside-click closing and focus return.
25. Root landing now has a new hero, learning scene, writing scene, community cards, tool cards, interactive study sample, principles, FAQ and signup section.
26. CSS perspective, layered paper, an orbit and a shaded sphere create the 3D-style scenes.
27. Scroll reveals, text entrances, progress and restrained floating motion vary by section.
28. Reduced-motion preferences disable the animation; landing content remains readable without JavaScript.
29. `/writing` has its own visual landing and explicit writer entry action.
30. Writer Home/Library/Stories retain actual feed, bookmark and draft lifecycle data.
31. Library removal updates the persisted bookmark and visible list.
32. Stats includes an actual approximate story-open chart, with bounded-data labels.
33. Writer profile has a cover, independent photo/bio/About and four persisted accents.
34. Public creator profiles have their own cover, identity, Stories/About tabs and sharing action.
35. Public community has actual title/author/topic filtering and topic controls.
36. Public account menus display the writer's name and photo rather than the student profile.
37. Insert now supports symbols, safe equations, an automatic contents block and YouTube video links, alongside the existing images, links, tables, dividers and code.
38. Design now supports three article themes, five fonts, paragraph spacing, three paper colors, borders and four accents.
39. Design settings persist in the draft document and survive reload, preview and public rendering.
40. Contents uses actual document headings and working preview/public anchors.
41. Equations use bounded LaTeX and KaTeX with trusted commands disabled.
42. Videos use validated IDs and load the privacy-enhanced iframe only after the reader chooses Play.
43. Structured document validation accepts the new blocks and sanitizes design settings through allowlists.
44. Homepage FAQ structured data matches the displayed answers; existing application audience metadata is retained.
45. Editorial footers also expose privacy preferences.

## Full-stack behavior

No new duplicate account or wallet database is created. Writer identity/design uses existing workspace records and story documents in SQLite or MongoDB. Profile updates retain revision-conflict checks and validated image processing. Draft APIs retain owner checks, image ownership, private review state, revision protection and publication approval. Public profile projection excludes private account data.

`/api/writer/support` uses the protected shared support handler with a writer channel. The channel is also written to the ticket index for listing; ticket messages remain in the existing user study-state store. Old support tickets remain readable through the student channel. No database migration or destructive rewrite is required.

Billing pages use existing APIs rather than separately minting balances or trusting browser payment-success callbacks. A recurring mandate alone grants no credits: the server must verify captured monthly payment. Writer and student views display the same account entitlement.

## Local verification

- `npm run check` and an isolated production build (`NEXT_DIST_DIR=.next-validation`), including all new routes.
- `test:writer-platform`: SQLite and a real temporary MongoDB replica set, enrollment, shared balance, profile/image persistence, public redaction, document sanitization/design/new blocks, stale writes, ownership and support-channel isolation.
- `test:writer-browser`: real local sessions and APIs, popup switching, same-email enrollment, writer welcome, independent profile, editor autosave/reload/preview/submission, membership destinations, support conversation persistence, library removal, appearance and Chromium/WebKit phone layouts.
- `test:workspace-browser`: actual image upload, private image access, draft persistence, shared-account workspace sign-in, writer checkout consent and student presentation limits.
- `test:mobile-nav`: Chromium/WebKit at 320, 390 and 844 pixels, compact menus, public page layout, scroll reveals, reduced motion, no-JavaScript landing content, consent, structured data and security headers.
- `test:payment-pages`: isolated Razorpay browser fixture for consent, dismissal, callback status and mobile layout; no charge.
- Integrity, auth verification, security, proxy, SEO, workspace, creator publication, public guide, payment status and currency regression suites.

QA screenshots are generated under ignored `output/qa` and `output/writer-redesign`; they contain isolated test accounts, not production users.

## Limits and deployment checks

The optional live `test:razorpay` request returned provider HTTP 401 for the configured credentials. The UI and server accounting checks passed, but live merchant checkout remains blocked by credential/provider configuration. No customer charge was made. Actual Google-provider login, email delivery, hosted billing webhooks and deployment state are not proved by local tests.

Removing the sign-in preflight removes an unnecessary delay and warning; it does not make a sleeping hosted backend always available. Authentication still reports real timeout/connection errors instead of granting access without a verified session. An always-on backend configuration is needed if startup latency persists in production.

CSS animation is 3D-style, not a video or WebGL runtime. The editor implements useful blog features, not all Microsoft Word tools. Video availability depends on YouTube and the uploader's embed settings. Publishing still requires editorial approval; following, personalised ranking, paid-story paywalls and cash writer payouts are not implemented. Stats remains a bounded approximate-open view, not completed-read analytics.

Frontend and API need coordinated deployment so `/api/writer/support` and the new document node types exist on the backend before writers use them. Smoke-test real writer login, membership, profile, support and published-document rendering after deployment.
