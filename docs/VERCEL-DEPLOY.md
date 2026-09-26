# Vercel frontend deployment

Keep Render API/worker and Atlas in place. Import `mrabhaygod12-alt/syaahi`, branch `main`, repository root, Next.js preset, Node 24.x, build `npm run build`, install `npm ci`, and leave Output Directory override disabled. Next.js reads the existing custom distDir. Do not use a static export.

Production environment:
- APP_ROLE=frontend
- BACKEND_URL: existing Render API HTTPS origin
- BACKEND_PROXY_SECRET: exact same server-only value as Render
- NEXT_PUBLIC_APP_URL=https://syaahii.in (canonical production domain)
- NEXT_TELEMETRY_DISABLED=1 (optional)

Do not import the backend environment wholesale. Database, payment, email and AI secrets stay on Render. Netlify's build environment does not apply on Vercel, so APP_ROLE must be configured explicitly. On Render retain TRUST_PROXY_HEADERS=true for per-client IP limits behind the authenticated proxy. The middleware selects Vercel's platform-supplied x-forwarded-for on Vercel and Netlify's client header on Netlify; an unsupported host fails to an unknown IP rather than trusting arbitrary forwarded headers.

The supplied log ending at the Next.js version banner contains no build failure. Node engines are pinned to 24.x to avoid automatic major-version selection. Dependency deprecation/install-script notices alone do not establish a failed deployment. If deployment fails, collect the final error and surrounding lines; do not enable every install script to silence warnings.

Before DNS cutover, confirm the Vercel deployment is Ready and its /api/health reaches Render. Add syaahii.in and www.syaahii.in in Vercel Domains; use the exact DNS values Vercel displays. Edit the active DNS provider, preserve mail/verification records, and wait for valid HTTPS. Do not delete the old host before testing the replacement.

Keep NEXT_PUBLIC_APP_URL aligned on Vercel and Render with the chosen primary origin. Supabase Site URL is https://syaahii.in and its redirect allowlist includes https://syaahii.in/api/auth/callback. Google's redirect remains https://eoybbxevqenijbglhsog.supabase.co/auth/v1/callback. Razorpay webhook uses https://syaahii.in/api/razorpay/webhook. Provider dashboards are not updated by a Git push.

Test final-domain login, cookies, wallet/history, lesson generation, chat, uploads, PDF downloads and payment webhook/verification after migration. A .vercel.app smoke test does not establish that canonical-domain Google login works. Do not connect untrusted preview branches to production secrets. API calls still consume frontend proxy traffic and Render resources; Vercel is not unlimited free hosting. Check the commercial-use plan requirements and usage budget before launch.

References:
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/domains/working-with-domains/add-a-domain
