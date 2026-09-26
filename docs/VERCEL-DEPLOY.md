# Vercel frontend deployment

Keep Render API/worker and Atlas in place. Import `mrabhaygod12-alt/syaahi`, branch `main`, repository root, Next.js preset, Node 24.x, build `npm run build`, install `npm ci`, and leave Output Directory override disabled. The Vercel deployment uses Next.js's expected `.next` output directory; Render retains `.next-production`. Do not use a static export.

Production and Preview environment:
- APP_ROLE=frontend
- NEXT_DIST_DIR=.next (optional explicit output directory)
- NEXT_PUBLIC_APP_URL=https://www.syaahii.in (canonical production domain; Vercel redirects the apex to www)

Production environment only:
- BACKEND_URL: existing Render API HTTPS origin
- BACKEND_PROXY_SECRET: exact same server-only value as Render
- NEXT_TELEMETRY_DISABLED=1 (optional)

The Next.js config selects `.next` when `APP_ROLE=frontend` or Vercel's `VERCEL=1` system variable is available; `NEXT_DIST_DIR` is an explicit override. This keeps the Vercel output independent of whether the project's Vercel system-variable exposure toggle is enabled. Render's production build keeps `.next-production` unless `NEXT_DIST_DIR` is set there.

A private local template exists at `.env.vercel` for transferring the frontend values; it is ignored by Git and never uploaded automatically. Enter those values in the Vercel project dashboard. Do not import the backend environment wholesale. Database, payment, email and AI secrets stay on Render. Vercel does not use the Render environment group, so configure APP_ROLE explicitly on the frontend project. On Render retain TRUST_PROXY_HEADERS=true for per-client IP limits behind the authenticated proxy. The middleware selects Vercel's platform-supplied x-forwarded-for on Vercel on Vercel; an unsupported host fails to an unknown IP rather than trusting arbitrary forwarded headers.

The Vercel log excerpt supplied on 27 September 2026 ends at the Next.js startup banner and contains no reported build failure. A local production build completed successfully (94 routes). The code selects `.next` from `APP_ROLE=frontend` as well as Vercel's `VERCEL=1`, with optional `NEXT_DIST_DIR` override, so frontend output does not depend on exposing Vercel system variables. Node engines are pinned to 24.x to avoid automatic major-version selection. Dependency deprecation/install-script notices alone do not establish a failed deployment. If deployment fails, collect the final error and surrounding lines; do not enable every install script to silence warnings.

The custom domain is not yet publicly reachable from the latest workspace check: neither `syaahii.in` nor `www.syaahii.in` returned an A record, `syaahi.vercel.app` returned HTTP 404, and `https://syaahi.onrender.com/api/health` returned HTTP 200. The supplied Vercel Domains screenshot shows the custom domains assigned to Production but certificates still generating. Thus the local build and Render health are verified, while the actual Vercel deployment URL, production environment values, DNS propagation, certificate, OAuth and payment callback remain unverified. In GoDaddy, configure the exact apex and `www` records Vercel shows in Project → Settings → Domains, preserve mail/TXT records, and wait until Vercel validates DNS and issues HTTPS. Then test the latest Ready deployment URL from Vercel and `/api/health` before testing auth or payments.

Keep NEXT_PUBLIC_APP_URL aligned on Vercel and Render with the chosen primary origin. The supplied Vercel domain screen redirects the apex to www, so use https://www.syaahii.in as canonical. Set the Supabase Site URL to that origin and allow https://www.syaahii.in/api/auth/callback. Google's redirect remains https://eoybbxevqenijbglhsog.supabase.co/auth/v1/callback. Razorpay webhook uses https://www.syaahii.in/api/razorpay/webhook. Provider dashboards are not updated by a Git push.

Test final-domain login, cookies, wallet/history, lesson generation, chat, uploads, PDF downloads and payment webhook/verification after migration. A .vercel.app smoke test does not establish that canonical-domain Google login works. Do not connect untrusted preview branches to production secrets. API calls still consume frontend proxy traffic and Render resources; Vercel is not unlimited free hosting. Check the commercial-use plan requirements and usage budget before launch.

References:
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/domains/working-with-domains/add-a-domain
