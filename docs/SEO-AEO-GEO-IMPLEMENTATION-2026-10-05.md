# Syaahi public discovery, SEO, AEO and GEO

Reviewed: 5 October 2026. Official product domain: https://www.syaahii.in. This records shipped work and checks still requiring search-provider access or measurement.

## Finding and approach

The product has learning, presentation and publishing capabilities, but its public explanation has historically emphasized notes. Authenticated writer and studio pages do not substitute for readable public product documentation. The fix is to publish accurate, server-rendered material for each workflow, connect it with internal links and keep prices and capabilities consistent across pages and machine-readable summaries.

The web search sample for `site:syaahii.in`, `"syaahii.in" writing` and `"syaahii.com"` returned no results in the tool used for this review. That is a limited discovery observation, not proof of Google's indexing state, a competitor's ranking, ownership or any particular AI's knowledge. The competitor domain could not be inspected through the web tool; this release makes no unsupported affiliation or competitor-quality claims.

Google states that normal crawlability, useful textual content, internal links and accurate structured data also apply to its AI search features. It does not require an additional AI file or special schema, and inclusion is not guaranteed. Source: [Google AI features](https://developers.google.com/search/docs/appearance/ai-features). Structured data must reflect visible, relevant content and cannot invent reviews, affiliations or authority. Source: [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

## Implemented public content

| Public URL                   | Purpose and evidence                                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/syaahi`                    | Official product identity, creators, three product areas, shared-account boundaries, pricing and honest limits.                                                                          |
| `/writing`                   | Writer landing with explicit writing/publishing metadata and links to deeper documentation.                                                                                              |
| `/writing/features`          | Rich editor, revisions, separate profiles, review, following, public responses, private reading notes, statistics and canonical links.                                                   |
| `/writing/pricing`           | Exactly Free and Max ₹399/month, with captured-payment, renewal, cancellation and shared-wallet explanations.                                                                            |
| `/writing/medium-comparison` | A sourced capability comparison: canonical links, publication teams, newsletters, detailed audience reporting and follower/subscriber distinction. Missing Syaahi features are labelled. |
| `/ai-presentations`          | Public narrative pipeline, preview/edit/export flow, six layouts, nine themes, supported imports and evidence limits.                                                                    |
| `/product-facts.json`        | Reviewed public facts and current prices from the same catalogue used by checkout. No account data or configuration secrets.                                                             |
| `/llms.txt`                  | Optional public product summary, with equal learning/writing/presentation coverage and current pricing. It is not a ranking or model-training control.                                   |
| `/feed.xml`                  | XML-escaped summaries and bylines from approved public stories only. Private drafts and notes are excluded. A backend outage reports unavailability instead of a misleading empty feed.  |

Pages provide a useful first answer before detailed workflow text. FAQ answers are visible in HTML and match their JSON-LD. They do not promise FAQ rich-result eligibility. The comparison uses Medium's official documentation; it does not claim complete feature parity.

## Technical changes

1. Canonical URLs identify the `www.syaahii.in` origin, with permanent redirects from the apex and known Vercel alias retained.
2. Organization and website identity include the official domain, product name, creator attribution and concrete learning/publishing description.
3. Separate application entities describe the public presentation and writing products; no invented ratings, reviews or user counts.
4. Breadcrumbs are visible and match structured breadcrumb items.
5. Product text renders on the server and remains accessible without JavaScript.
6. Internal links connect product guide, writer features/pricing/comparison, presentation guide, community and trust pages.
7. Sitemap includes the public product pages and approved public writing/profile URLs. Private studio routes, auth and checkout pages stay excluded. Stories canonicalized to another origin are excluded from this sitemap.
8. Private presentation workspace metadata is `noindex`; its indexable explanation is `/ai-presentations`.
9. Reviewed story RSS is linked from the community and publication footer, with feed discovery metadata.
10. Public facts use the active billing catalogue. Student and writer offers cannot drift into contradictory hard-coded marketing prices.
11. Search Console and Bing verification metadata support `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` when an owner supplies their verification tokens. No property was verified merely by adding this code.
12. Existing public image access checks, API crawl exclusion, escaping and owner-protected source/notes boundaries remain intact.
13. Public pages have meaningful headings, responsive cards, accessible native FAQ disclosures and no horizontal overflow in tested widths.
14. Public smoke verification checks the new routes, facts, prices, retired checkouts and exact frontend/backend revisions.

## Approved pricing change

The user confirmed monthly renewal for all four student prices and Free + ₹399/month for writers.

| Student tier | INR/month | Credits per captured payment | Slide limit |
| ------------ | --------: | ---------------------------: | ----------: |
| Try          |         9 |                            3 |           6 |
| Starter      |        39 |                           15 |           8 |
| Popular      |        79 |                           36 |          12 |
| Max          |       399 |                          360 |          15 |

Free retains the verified-account welcome allowance. A deck costs five credits, so the Try allowance alone cannot purchase a deck from an empty wallet; the pricing card explains this. Writer Free provides core drafting/review tools; writer Max uses the same ₹399 plan and shared account wallet. The historical ₹179 Pro offer is rejected for new subscription creation, but its stored prices, credits, receipts and existing subscription terms are retained for reconciliation. One-time pack checkout remains retired.

Provider catalogue preparation can create/reuse plan definitions without creating customer subscriptions or charging anyone. Actual payment settlement still requires a separate captured-payment test; this release does not claim one.

## Evidence and measurement still required

- Verify ownership of the canonical domain in Search Console and Bing Webmaster Tools, submit the sitemap and inspect a sample from each public product area. This requires the owner's provider session or verification token.
- Check indexed canonical selection, crawl coverage and rendered HTML in the providers' inspection tools. A local HTML test cannot certify indexing.
- Record a baseline for branded searches, writer/publishing queries and presentation queries by country/device. Track impressions, clicks, conversions and actual AI citations; avoid treating fluctuating anecdotal answers as a ranking score.
- Measure Core Web Vitals with field data. Local overflow and rendering tests do not establish LCP/INP/CLS performance for real visitors.
- Expand approved original articles and public workflow examples with genuine author expertise and actual product evidence. Avoid mass-generated thin keyword pages or invented backlinks.
- Seek genuine external references to the correct domain and keep creator profiles consistent. No unsolicited outreach was sent.
- Validate structured data with provider tools and monitor errors after crawl. Syntactically valid JSON-LD does not guarantee a rich result.
- Review sitemap/publication pagination as the public catalogue grows, and add accurate modification timestamps when the publication model supplies them. No fake freshness timestamps are emitted.
- Add genuine localized public pages before claiming multilingual SEO or publishing hreflang alternatives.
- Periodically update the facts when a capability changes; do not advertise newsletter delivery, author payouts or paywalls until their real operational flows are implemented.

Verification commands: `test:seo`, `test:monthly-catalog`, `test:public-discovery-browser`, `test:payment-pages`, production build and the exact-commit public deployment smoke checker. Test screenshots are in `output/live-audit/public-discovery/`. Live rollout evidence belongs in the implementation tracker.
