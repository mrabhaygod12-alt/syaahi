# Syaahi site and security review

Review date: 1 October 2026. Scope: repository code, dependency inventory, local production build, automated defensive tests and browser checks. This is not a certification or a guarantee that no vulnerability remains. Hosted dashboard configuration and real provider account flows require separate validation.

## Changes made

- Removed landing-page, walkthrough and founder-page GSAP scroll effects and the unused GSAP package. No video generation or video artifact is part of this change.
- Replaced vague primary copy with a description of source-to-notes workflows, removed em dashes from application copy, used solid forest-green avatar backgrounds, and standardized buttons with compact rectangular corners.
- Simplified header styling, preserved grouped tool navigation, kept closed disclosures hidden before CSS loads, and prevented clicks before React activates their handlers. Phone navigation supports scrolling, Escape, outside-click dismissal and safe-area padding.
- Added a keyboard skip link, visible focus styles, optional analytics consent and footer privacy controls. Corrected the cookie policy to match actual analytics behavior.
- Added `/delivery` for digital credits and PDF downloads. Privacy, Terms, Refunds, Cookies and Acceptable Use pages remain linked in the footer. Favicon and PWA icons already exist.
- Added actual request-stream size enforcement (2 MiB for ordinary bodies, 12 MiB for multipart), rather than trusting Content-Length alone.
- Applied origin checks in the shared API wrapper; cross-site browser mutations fail closed. There is no wildcard CORS permission. Server webhooks without browser Origin continue through their own signature checks.
- Rate limiting now verifies a session before using its account as a bucket. Random forged cookies cannot create fresh authenticated buckets.
- SQLite and Mongo sessions both reject unverified accounts. Session cookies are HttpOnly, SameSite=Lax and Secure in production. Passwords use random salts and scrypt; session tokens are stored as hashes.
- Background Supabase synchronization no longer marks a newly registered email as confirmed.
- Added server authorization before admin pages render, backed by `/api/admin/access` on split frontend/backend deployments. Administrative APIs still enforce their individual permissions. Diagnostics always return 404 in production and require an administrator in development.
- Blocked common private-file paths, disabled the Next.js identification header and production browser source maps, and added a cross-domain policy header. Existing HTTPS/HSTS, MIME-sniffing, frame, referrer, permission and basic CSP defenses remain in place.
- Reject insecure Mongo TLS options in production. Authentication and sync logs retain error types rather than raw provider messages.
- Updated compatible dependencies, added weekly Dependabot checks, and added the security regression suite to CI and the weekly reliability workflow.

## Evidence and limits

`npm audit` reported zero known dependency vulnerabilities in the installed tree. This says nothing about undiscovered vulnerabilities or business-logic defects. Major dependency migrations were not applied without compatibility work.

Gitleaks 8.30.1 scanned 70 existing commits, approximately 1.87 MB. Eight detections were reviewed: five synthetic authentication test values, and three empty `.env.example` variable labels that matched across line breaks. No confirmed credentials were found in those detections. This does not prove credentials previously shared elsewhere have been revoked.

Defensive tests cover actual body-size enforcement, cross-site mutations, spoofed-cookie throttling, salted passwords, rejection of old unverified sessions and admin access. Existing tests cover email verification, proxy ingress, support ownership, payment identity/signatures/replay, durable generation integrity and private voice-session storage. Browser checks exercise phone portrait/landscape, 320px layouts, desktop navigation, consent, selected public-page overflow, favicon and response headers. A passing emulator check does not replace testing a physical phone or assistive technology.

## Checklist assessment

The supplied checklist contains 95 items. A numeric “production ready” score would be misleading without production measurements and verified business information. Status below distinguishes repository evidence from operator work.

| Area | Evidence in the product | Further evidence or operator action |
| --- | --- | --- |
| Branding and trust | Existing logo/favicon; restrained colors and fonts; real founder images, names and story; concrete study workflow | Publish only verified customer reviews, measured counts and consented case studies. None were invented. |
| Homepage | Concrete headline and CTA, above-fold explanation, interactive binary-search sample, feature groups, audience/use cases and FAQ | Validate messaging and conversion using actual learner feedback. The sample is labelled, not represented as a customer screenshot. |
| Content | Feature explanations, subject pages, blog, documentation, source transparency and founder information | Maintain an editorial review schedule. New customer case studies need real outcomes and permission. |
| UX and accessibility | Responsive disclosure navigation; keyboard dismissal; skip link; visible focus; existing loading/error/empty states; local browser overflow checks | Run a full WCAG audit including screen readers, contrast across all states, zoom, and physical iPhone/Android devices. |
| Conversion | CTAs, sample notes, transparent prices, account email capture, support inbox and institution/campus application forms | WhatsApp number, published testimonials, sales demo calendar and case studies require verified operator details. Do not add nonfunctional contact or booking links. |
| Legal | Privacy, Terms, Cookies, Refunds, Acceptable Use and digital-delivery pages; terms consent and optional analytics choice | Supply the legal business identity, service address, monitored contact, refund eligibility and response targets. Existing policy text acknowledges these missing deployment details. No GDPR certification is claimed. |
| SEO | Titles/descriptions, OG images, JSON-LD, canonical host, sitemap, robots, internal links and meaningful image descriptions | Search Console submissions, indexing decisions, rankings and backlinks cannot be established by code alone. |
| Performance | Static public routes, optimized founder images, reduced animation JavaScript, cache separation for private APIs | Measure production Core Web Vitals, slow connections and cold starts. Render free-tier sleep remains a hosting limitation. |
| Security | Ownership checks, verified sessions, hashed credentials, bounded/validated input, throttling, payment verification and security headers | Validate hosted secrets and Google redirects, Mongo least-privilege users/network rules, backup restore, live webhook delivery, alerts and log access. |

## Remaining security and operations work

- Vercel and Render must hold matching proxy secrets. Server credentials belong only on the API/worker service. Run `npm run check:env` in each configured environment; the local check cannot inspect dashboards.
- Use persistent MongoDB for multiple instances. SQLite rate-limit buckets are process-local. Trust forwarded IPs only behind the authenticated proxy with `TRUST_PROXY_HEADERS=true` and verified ingress behavior.
- The current CSP protects embedding, objects, base URLs and form destinations. A complete script nonce/connect allowlist rollout still needs provider-specific checkout, voice and Next.js compatibility validation; no claim of a full strict CSP is made.
- Body-size checks do not replace infrastructure request deadlines, concurrency caps or protection against slow connections.
- Review Atlas database-user permissions, network allowlists and encryption/backup settings. Code does not manage these account settings.
- Complete real Google OAuth, verification-email delivery, LIVE checkout and captured-webhook reconciliation with the hosted accounts. Local tests do not charge cards or verify bank settlements.
- Publish the missing business/legal details before representing every compliance item as complete. Do not use fabricated trust badges, reviews, addresses, certifications or customer counters.

Useful commands: `npm run check`, `npm run check:env`, `npm run test:security`, `npm run test:auth`, `npm run test:proxy`, `npm run test:payment-status`, `npm run test:payment-pages`, `npm run test:mobile-nav`, `npm run build`, `npm audit`.
