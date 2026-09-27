# Syaahi search visibility

## Audit: 28 September 2026

The live homepage, robots.txt and sitemap returned HTTP 200. Apex and Vercel
aliases redirected to https://www.syaahii.in/. All 38 sitemap pages returned 200.
However, 23 public pages inherited the homepage canonical and title. Other pages
repeated the brand twice in their titles. These are technical search signals we
can fix; they do not establish Google's actual exclusion reason.

The fix adds self-canonicals and unique metadata to the affected pages, removes
the inherited root canonical, fixes title duplication, connects Organization,
WebSite and product structured data, improves the visible homepage introduction,
and adds noindex to internal/account pages. Blog sitemap entries follow the
published blog collection. No artificial ratings, traffic or ranking claims.

## Search Console: do this after deployment

1. Open the verified **syaahii.in** domain property.
2. In **Sitemaps**, submit **https://www.syaahii.in/sitemap.xml**. Check that its
   status is **Success**; submitting alone is not proof of indexing.
3. In **URL inspection**, paste **https://www.syaahii.in/**. Read the indexing
   result, then choose **Test live URL**. Confirm it can be fetched and indexed.
4. Choose **Request indexing**. Repeat for `/about`, `/features`, `/examples`,
   `/pricing` and the most useful subject page within Google's submission quota.
5. Inspect both **User-declared canonical** and **Google-selected canonical**.
   Public subpages should identify their own www URL, not the homepage. The live
   test may show new code while the indexed record still reflects the old crawl.
6. In **Pages**, inspect actual exclusion reasons. A screenshot of that report
   or the homepage inspection result is needed to diagnose remaining Google-side
   issues. Also check **Manual actions** and **Security issues**.

Do not use Removals to fix canonicalization. Keep the verification DNS TXT
record. No nameserver change is needed. Opening a URL in the browser address bar
and finding that URL in Google Search are different checks.

## Next four weeks

- Week 1: complete the checks above; record indexed pages and impressions for
  `Syaahi`, `Syaahii`, `syaahii.in`, and `Syaahi AI notes` as the baseline.
- Week 2: publish a genuinely useful, human-reviewed worked study example with
  source citations. Link it from its subject page, the examples page and a guide.
- Week 3: share the product demonstration on the owner's actual social accounts;
  link to the canonical site in profile and post descriptions. Seek relevant
  educator/student feedback and authentic mentions; do not buy spam backlinks.
- Week 4: compare Search Console impressions, clicks and indexed pages. Improve
  pages people actually search for, and fix reported crawl or mobile issues.

For AI answers, clear factual content and accessible public pages matter. There
is no special Google AI schema or guaranteed GEO/AEO ranking switch. llms.txt is
an informational file, not a substitute for indexing. No first, second or third
position can be promised. Google says recrawling may take days to weeks.

## Verification

Build using the production frontend configuration, start it locally, then run:

```powershell
$env:VERCEL='1'
$env:NEXT_PUBLIC_APP_URL='https://www.syaahii.in'
npm run build
# Built static HTML can also be checked without starting a server:
node scripts/test-seo-pages.mjs --build

# When testing against a running local production frontend:
$env:SEO_TEST_URL='http://localhost:3100'
node scripts/test-seo-pages.mjs
```

After deployment repeat with `SEO_TEST_URL=https://www.syaahii.in`.

Sources:

- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/ai-features
