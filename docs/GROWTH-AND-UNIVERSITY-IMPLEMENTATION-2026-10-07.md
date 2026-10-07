# University activation and growth release — 7 October 2026

This release follows the requested UG/PG focus, particularly CSE, IT, BCA/MCA, data science, AI/ML and cybersecurity. Physics and biology remain available as subjects; they no longer lead the homepage samples.

## Implemented

| Request                | Working implementation                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clear first impression | Direct topic/PDF-to-revision-note hero, actual rendered original sample, single preview CTA, secondary writer entry. Lightweight scroll reveals, paper perspective and reduced-motion support.                                                                                                                                                               |
| Try before signup      | Anonymous topic preview API; English/Hindi original algorithms, DBMS and OS examples; bounded AI generation for other topics. Five requests/minute per requester, shared production daily budget, deduplication, limited cache, strict output validation and provider deadline. No account credit charge.                                                    |
| University onboarding  | Email signup and editable dashboard preferences: UG/PG, department, subject, study track, language, daily goal and in-app updates. Google signup choices carry to the authenticated dashboard. Topic/language are preserved from preview through signup into the composer. Existing source review, editable outline and explicit credit confirmation remain. |
| Empty subject pages    | Four actionable starter topics for every subject, even without curated packs. No invented pack content.                                                                                                                                                                                                                                                      |
| Examples and proof     | Original bilingual CS sample gallery, immediate readable content, on-demand print renderer, skeleton, real PDF downloads and before/after samples. No fake student quotes, counters, institutions or results.                                                                                                                                                |
| Retention              | Persisted daily self-reported minutes, saved exam-date countdown, quiz accuracy, evidence-based weak topics, due flashcards, existing optional reminder settings and dismissible lesson-ready dashboard updates. Repeated daily saves set a total instead of adding duplicate minutes.                                                                       |
| Sharing                | User-triggered WhatsApp/Telegram actions on revocable lesson links; existing referral wallet promoted; small clickable Made with Syaahi PDF footer.                                                                                                                                                                                                          |
| India/mobile           | Hindi public landing and global entry link; Hindi/English previews and note preferences. Existing six generation languages, PWA install and Razorpay UPI support remain. Dropdown arrows removed globally, preserving native controls and keyboard support.                                                                                                  |
| Blog-to-product        | Contextual prefilled-topic entry, related posts and original downloadable university revision planner/CS recall worksheet. Downloads do not require email collection.                                                                                                                                                                                        |
| Trust                  | Source references remain with lessons. Owner-authorized error-report API creates a persistent support ticket, with a link to track/reply. Private sources are not made public by preview or reporting.                                                                                                                                                       |
| Measurement            | Opt-in first-party funnel/cohort measurement, optional Vercel Analytics, replay-safe events, Mongo/SQLite transaction protection, 90-day expiry, admin-only aggregate report at `/admin/growth`. Two consented preview CTA labels. No note text, topics, source URLs, email or payment secrets in growth events.                                             |

## Confirmed pricing change

- Student: Free, **₹9 / 3 credits**, **₹39 / 15 credits**, **₹79 / 36 credits**, each **one-time**, and **Max ₹399/month / 360 credits per captured invoice**.
- Writer: exactly **Free + Max ₹399/month**.
- New recurring checkouts are restricted to Max. Historical subscriptions and already purchased credits are preserved; no customers were cancelled or charged during verification.
- Provider signatures, captured amount/currency verification, owner checks and idempotent settlement remain authoritative. Public pricing, documentation and machine-readable product facts use the same offer policy.

## Validation

- Production build and TypeScript check.
- Growth API tests against SQLite and a Mongo replica set: saved UG/PG preferences, isolation, goal replay, bilingual samples, mocked provider adapter/cache deduplication, schema rejection, concurrent measurement, consent, admin denial and owner-only support reporting.
- Production-browser tests: 320, 390, 768 and 1440px public routes; dashboard templates, preferences surviving reload, goal saves, Hindi output labels, topic continuity, reduced motion and real PDF bytes.
- Security, auth verification, student studio, monthly catalogue, payment-status and public SEO/discovery regressions.
- Local optional Razorpay **test-key** order smoke returned 401; no payment was captured. Separately, hosted authenticated catalogue preparation returned **Monthly checkout is ready. No subscription or payment was started.** This verifies hosted catalogue authentication, not an actual captured-payment journey.

## Operational work, not fabricated product features

Real reviews/campus names require permission and evidence. Social videos, teacher collaborations and community announcements require actual assets and authorized human outreach; none were sent automatically. GA4/Clarity/Hotjar were not installed without project IDs or tracking approval; consented first-party analytics is operational instead. Browser viewport tests are not real low-end Android/4G tests. Search/AI indexing and ranking are external outcomes, not guaranteed by metadata.

The separately supplied writer/admin brief adds further work: comprehensive admin user lifecycle, MFA, support assignment/internal notes, scheduled/revised publishing and writer SEO/AEO/GEO assistance. This growth release is not a claim that those additional phases are complete.

## References

- [Google: AI search features](https://developers.google.com/search/docs/appearance/ai-features)
- [Clarity: consent mode](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode)
- [Medium: scheduling](https://help.medium.com/hc/en-us/articles/216650227-Schedule-to-publish)
- [Medium: profile/publication differences](https://help.medium.com/hc/en-us/articles/360051364454-Differences-between-a-profile-and-a-publication)
- [Medium: custom domains](https://help.medium.com/hc/en-us/articles/115003053487-Setting-up-a-custom-domain-for-your-profile-or-publication)
- [Cornell: third normal form](https://cvw.cac.cornell.edu/RelationalDBs/design-create/third_normal_form)
- [MIT xv6: locking and deadlocks](https://mit-pdos.github.io/xv6-riscv-book/lock.html)

Examples are original concise teaching samples, with external further-reading links. They are not copied publisher material or claims that a guest AI preview researched the source.
