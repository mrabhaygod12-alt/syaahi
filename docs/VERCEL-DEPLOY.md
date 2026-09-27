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

The 27 September 2026 Vercel build compiled, then failed while collecting page data because an empty `NEXT_PUBLIC_APP_URL` reached `new URL()` through root metadata. Production builds now fall back to `https://www.syaahii.in` when that variable is blank or invalid; still set the variable to that exact URL in Vercel and Render. A local production build with `NEXT_PUBLIC_APP_URL` explicitly empty completed successfully (94 routes). The code selects `.next` from `APP_ROLE=frontend` as well as Vercel's `VERCEL=1`, with optional `NEXT_DIST_DIR` override, so frontend output does not depend on exposing Vercel system variables. Node engines are pinned to 24.x to avoid automatic major-version selection. Dependency deprecation/install-script notices alone are not build failures; do not enable every install script to silence warnings.

The latest workspace smoke test returned HTTP 200 for `https://syaahii.in/`, `https://www.syaahii.in/`, and `/api/health` through both custom domains; DNS reports Vercel nameservers. The supplied GoDaddy screen says DNS is managed by Vercel, so edit DNS records in Vercel's domain DNS page, not GoDaddy. The Vercel project screenshot currently connects both apex and `www` to Production with no redirect selected; for the configured `www` canonical URL, set the apex to a permanent redirect to `www`. Google OAuth, payment callbacks and the newly pushed deployment still need end-to-end dashboard verification.

Keep NEXT_PUBLIC_APP_URL aligned on Vercel and Render with the chosen primary origin. Use https://www.syaahii.in as canonical and configure the apex redirect in Vercel if you want one public origin. Set the Supabase Site URL to that origin and allow https://www.syaahii.in/api/auth/callback. Google's redirect remains https://eoybbxevqenijbglhsog.supabase.co/auth/v1/callback. Razorpay webhook uses https://www.syaahii.in/api/razorpay/webhook. Provider dashboards are not updated by a Git push.

Test final-domain login, cookies, wallet/history, lesson generation, chat, uploads, PDF downloads and payment webhook/verification after migration. A .vercel.app smoke test does not establish that canonical-domain Google login works. Do not connect untrusted preview branches to production secrets. API calls still consume frontend proxy traffic and Render resources; Vercel is not unlimited free hosting. Check the commercial-use plan requirements and usage budget before launch.

References:
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/domains/working-with-domains/add-a-domain
