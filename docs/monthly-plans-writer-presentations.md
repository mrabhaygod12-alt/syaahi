# Monthly plans, writer workspaces and presentations

Implemented prices (approved 3 October 2026):

| Plan    | Price         | Credits                          | Slides per deck   |
| ------- | ------------- | -------------------------------- | ----------------- |
| Free    | ₹0            | 19 once at signup                | 6                 |
| Starter | ₹39/month     | 15 per captured monthly invoice  | 8                 |
| Pro     | ₹179/month    | 90 per captured monthly invoice  | 12                |
| Max     | ₹399/month    | 360 per captured monthly invoice | 15                |
| Team    | Contact sales | Agreed separately                | Agreed separately |

All self-service monthly plans bill in INR. International recurring prices have not been configured. Previously purchased credits and order receipts remain valid. A monthly plan is a new recurring mandate, never a silent conversion of an existing purchase. Unused credits remain in the wallet. Subscriptions run for at most 120 monthly cycles; cancellation stops future renewals.

## 1. Prepare Razorpay plans

Enable Razorpay Subscriptions for the merchant account. Standard one-time Checkout activation alone does not establish recurring billing availability.

Preview the exact configuration without provider requests:

```powershell
npm run billing:plans
```

In Razorpay's matching Test/Live Mode, create three plans with billing period **Monthly**, interval **1** and currency **INR**:

- `Syaahi Starter monthly INR v1`: ₹39 (3900 paise).
- `Syaahi Pro monthly INR v1`: ₹179 (17900 paise).
- `Syaahi Max monthly INR v1`: ₹399 (39900 paise).

Alternatively, on a trusted server where credentials are already environment variables:

```powershell
# Creates or reuses matching test plans; never prints secrets.
npm run billing:plans -- --apply
# Live account: explicit live switch required.
npm run billing:plans -- --apply --live
```

The script reuses plans matching their name, billing period, price and currency. Review the preview first. A failed provisioning attempt can be rerun to reconcile matching existing plans. Plan IDs are not secret, but do not paste the API key secret into chat or source files.

## 2. Configure Render API service only

Use the fresh matching key pair already configured for the chosen mode. Add:

```text
RAZORPAY_PLAN_STARTER_INR=plan_ID_FROM_STARTER
RAZORPAY_PLAN_PRO_INR=plan_ID_FROM_PRO
RAZORPAY_PLAN_MAX_INR=plan_ID_FROM_MAX
```

Keep `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` on the backend. Do not add secrets as `NEXT_PUBLIC_*` variables. The backend checks the actual provider plan before creating a mandate; an incorrect price, currency or interval is rejected.

## 3. Configure the webhook

In the same Razorpay mode, use:

`https://www.syaahii.in/api/razorpay/webhook`

Use the same webhook secret as Render. Retain `payment.captured` for historical one-time orders, and add:

`subscription.charged`, `subscription.authenticated`, `subscription.activated`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `subscription.paused`, `subscription.resumed`.

Subscription credits require a valid webhook signature and a provider-fetched captured payment tied to a paid invoice for the stored subscription. Invoice identity, amount, currency and billing period are checked. The invoice ledger ID prevents duplicate credit grants. Mandate authorisation alone adds no credits.

## 4. Verify before opening monthly sales

Redeploy the API and frontend. Sign in, open `/pricing`, select Starter and read the recurring-charge consent at `/subscribe/starter`. Authorise using Razorpay's current subscription test instructions in Test Mode. Confirm the invoice payment is captured, then inspect `/account/billing` and the wallet. Replay the webhook: the wallet must stay unchanged. Test Cancel renewal and confirm the provider shows cancellation at cycle end.

The Billing **Refresh provider status** action reconciles paid invoices if webhook delivery was delayed. A timed-out subscription creation remains locked to prevent duplicate mandates; Refresh searches provider records for the stored attempt. If it cannot resolve the attempt, contact support and reconcile the Razorpay record before creating another subscription.

No real bank charge was submitted as part of automated checks. Final live mandate approval, collection, cancellation and settlement require a controlled merchant-account test. Payment capture and bank settlement are different steps; inspect Razorpay Settlements for the bank transfer status.

## Writer workspace

Login/signup asks whether the starting workspace is **Learn & create** or **Write & publish**, including Google sign-in. The learning workspace serves students, teachers and professionals; the writing workspace serves articles, tutorials and teaching guides. This is a saved navigation preference, **not an administrator permission**. Both workspaces remain available through the switch. The existing internal `student` value is retained for storage compatibility.

- `/writer`: drafts, submissions, published guides and approximate guide opens.
- `/write`: headings, lists, emphasis, links, uploaded images with alt text, preview, autosave and ten draft revisions.
- Images: JPEG/PNG/WebP up to 4 MB; resized/re-encoded WebP, original metadata removed. Private until referenced by a published guide. Takedown revokes future access.
- Concurrent saves use a database compare-and-set guard. Conflicts preserve the editor content and pause automatic retries.
- `/guides/[slug]`: server-rendered approved rich text, Article metadata and structured data. Private drafts and editorial notes are excluded.

## Presentation workspace and operations

- `/presentations`: public feature explanation and authenticated generation form.
- `/presentations/[id]`: private progress, saved slide previews, editing and export.
- Five credits are reserved atomically with the job. Failed generation returns the charge once; retry reserves five credits and keeps completed slides.
- Each slide is saved independently under a worker lease. A restarted worker resumes at the next slide without another charge.
- Three templates: Editorial, Technical, Classroom. Native editable text, tables, charts and speaker notes; no watermark. Export layout should be checked in the user's presentation app because fonts and wrapping vary.
- User briefs/reference material remain untrusted content. Factual accuracy and model citations still require review.

Configure an eligible AI provider on the API **and generation worker**. With `WORKER_MODE=external`, run the existing `npm run worker` service continuously with the same MongoDB database and provider configuration. An uptime monitor does not replace a persistent worker. Heavy generation is not a dependable fit for a sleeping free service.

Owner checks protect listing, editing, retry and export. Rates are bounded. Private workspace routes are excluded from the sitemap. `/presentations` is public and included; the shared editor/export dependencies do not enter the homepage bundle.

## Public positioning and search, updated 4 October 2026

The homepage, About, Features, How it works, FAQ, share card, application manifest and public product summary describe Syaahi as a learning and writing platform for students, teachers, professionals and writers. The homepage gives both workspaces equal entry paths and describes each implemented feature without invented reviews, user counts or outcome promises.

`/writing` is a public explanation of the writer workflow, including teacher and professional use cases, privacy, editorial review and language scope. It is linked from the homepage, navigation, footer and sitemap. `/writer` and `/write` remain private workspace pages with noindex metadata. Existing `/guides/[slug]` URLs remain compatible; approved public articles retain Article structured data and creator attribution.

The navigation groups are Learn & create, Write & publish, and Resources, with a direct Pricing link. Mobile groups scroll within the available viewport, only one opens at a time, and Escape returns keyboard focus. Writing signup/login links preserve the chosen workspace and a validated internal return URL.

FAQ structured data uses the same answers rendered visibly. The site name remains Syaahi, with Syaahii and syaahii.in as alternatives. There is no fabricated international price ladder, translated-page hreflang, professional certification, identity verification badge or publication guarantee.

The robots rules allow the writing-image path so images in approved articles can be crawled. This is not an access permission: the image endpoint still checks owner or current publication on every request and returns 404 for private drafts. A takedown also removes public image access.

After deployment, submit `https://www.syaahii.in/sitemap.xml` in Search Console and request indexing of `/`, `/writing`, `/features`, `/about` and `/community` through URL Inspection. This must be done in the owner's Google account. Indexing, rankings and AI citations are controlled by the search services; metadata and `llms.txt` alone cannot guarantee inclusion.

## Checks

```powershell
npm run check
npm run test:workspace-upgrade
npx tsx scripts/test-workspace-upgrade.ts --mongo
npx tsx scripts/test-workspace-browser.ts
npm run test:auth
npm run test:creator-publications
npm run test:public-guides
npm run test:security
npm run test:proxy
npm run test:seo
npm run test:mobile-nav
npm run build
npm audit --omit=dev
```

The optional `test:razorpay` uses a real test account for historical one-time Checkout; it requires working test credentials. It does not verify recurring production mandates. Screenshots, sample PPTX and reference-deck renders are local under ignored `output/`.
