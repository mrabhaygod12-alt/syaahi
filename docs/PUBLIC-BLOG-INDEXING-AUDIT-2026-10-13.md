# Public blog indexing audit — 13 October 2026

## What the supplied report actually shows

`Chart.csv`, `Table.csv` and `Metadata.csv` are a Google Search Console **Excluded by ‘noindex’ tag** export, not a Google Analytics traffic report. The chart records five affected URLs on each reported day, 4–9 October. Its URL table is:

| URL                        | Last crawled | Intended visibility                     |
| -------------------------- | ------------ | --------------------------------------- |
| `/write`                   | 4 October    | Private writer editor; keep noindex     |
| `/signup`                  | 3 October    | Account creation; keep noindex          |
| `/dashboard?topic=Biology` | 29 September | Private student workspace; keep noindex |
| `/refer`                   | 28 September | Personal referral wallet; keep noindex  |
| `/payments`                | 28 September | Personal payment records; keep noindex  |

None is a published article, creator profile or the public Blog index. Removing these five protections would expose account/workspace pages to search and would not fix article discovery. This export alone cannot establish which blogs Google has indexed, their ranking, or the cause of any other exclusion. The user’s CSVs are preserved unchanged and excluded from the commit.

## Implemented changes

- The public `/blog` index and existing static `/blog/[slug]` articles explicitly declare `index, follow`. Static articles carry article author/publication metadata; missing article slugs declare noindex before returning 404. Private layouts and account pages retain their noindex rules.
- Previously `/sitemap.xml` reused the latest-48 full-article feed, so older published posts could disappear from discovery. It now traverses a separate public index in pages of at most 200 records, ordered by stable story ID rather than date ties or offset.
- `GET /api/publications/index` reads only slug, creator slug and publication/update dates. MongoDB projection and SQLite JSON-field projection avoid transferring bodies, document trees, version history, owner identity or moderation notes. Both storage backends have a status/ID query index.
- Only published parent articles with valid public slugs are eligible. Drafts, review submissions, schedules, private revision children, unpublished/removed articles and cross-posts with foreign canonical publishers are excluded. An empty page of excluded duplicates still advances the cursor.
- Sitemap entries use actual persisted article dates, canonical absolute URLs and deduplicate creator URLs. Static study posts use their recorded publication date. Deploy time and page views do not become artificial article modification dates.
- Frontend traversal uses the authenticated backend proxy and `no-store`; takedowns are not retained in a frontend cache. Backend outage or a repeated continuation cursor causes a visible failure, rather than a successful empty sitemap. Traversal is bounded to 250 pages and the single sitemap refuses more than 50,000 URLs; a sitemap index is future work before that threshold.

## Verification

`scripts/test-publication-index.ts` passes against isolated SQLite and MongoDB fixtures. It covers 260 original published articles beyond the old 48 cap; an initial scan page containing only foreign canonical duplicates; bounded pagination; exact public DTO fields; parent/revision/status privacy; actual dates and invalid-date fallback; removal after unpublish; sitemap creator deduplication; authenticated frontend requests; outage and cursor-loop rejection; explicit public Blog metadata; and retained noindex on the five report routes.

Production deployment, rendered-header checks and Search Console access are separate checks performed by the parent task. Unit results do not prove that Google has recrawled or indexed an article.

## What Search Console can confirm after deployment

1. Submit or refresh `https://www.syaahii.in/sitemap.xml` in the verified property’s Sitemaps report.
2. Inspect representative **published** `/guides/...` and `/blog/...` URLs: use the live test to confirm availability, allowed indexing and the declared canonical. Compare Google’s last crawl and selected canonical.
3. Request indexing for important newly published articles. Leave the five private report URLs excluded; their report count can correctly remain five.
4. Watch later indexing and performance reports. Do not infer current Google state from the older export or promise a ranking position from technical changes alone.

Google documents that noindex works through either a page meta tag or response header, and that Googlebot must be able to crawl the URL to observe it. The current site therefore does not add a robots.txt crawl block for these private-page exclusions. [Google: noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

Sitemaps should list canonical public URLs and accurate significant modification dates; a single sitemap is limited to 50,000 URLs or 50 MB. Sitemap submission is a discovery hint, not an indexing guarantee. [Google: building and submitting sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

For a few URLs, URL Inspection can request recrawling; large batches are better discovered through a sitemap. Requests do not guarantee immediate inclusion and repeat requests do not accelerate it. [Google: requesting a recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
