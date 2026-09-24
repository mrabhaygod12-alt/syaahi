# Syaahi

An AI-assisted study workspace created by Chandan Pandey: source intake, visual handwritten notes, editable outlines, PDF export, chat, mixed quizzes, scheduled flashcards, spoken summaries and controlled sharing.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npx playwright install chromium
# Copy .env.example to .env.local and configure an eligible provider.
npm run dev
```

Local mode uses `data/syaahi.sqlite`. Keep this directory and your environment file private. A new account receives five note-section units. **One token = three note sections**; continuation PDF sheets are free. Existing balances preserve their original generation allowance.

## Project map

- `app`: public pages, workspace routes and API handlers.
- `components`: responsive UI, composer, learning rooms and notebook previews.
- `lib/ai`: model catalog, bounded fallback and six-slot credential configuration.
- `lib/jobs`: durable reservations, worker leases, generation and recovery.
- `lib/storage`: MongoDB adapters and transactions; SQLite remains available locally.
- `lib/billing`: server-owned prices, verified capture and referral ledger.
- `lib/study`: folders, review scheduling and collaboration permissions.
- `lib/pdf`: the shared semantic preview/print renderer.
- `scripts`: verification, worker and explicit data migration commands.

## Verify

```sh
npm run check
npm test
npm run test:study
npx tsx scripts/test-referrals.ts
npx tsx scripts/test-office.ts
npm run test:mongo
npm run build
```

The Mongo test starts a local replica set and may download a MongoDB binary. It does not touch Atlas. Browser/live-provider checks use localhost:3101 and are documented in `docs/RELEASE-STATUS.md`. Live checks consume the configured provider allowance.

## Deploy and operate

Read [DEPLOY.md](DEPLOY.md), [master plan](docs/MASTER-PLAN.md), [release status](docs/RELEASE-STATUS.md), and [security assessment](docs/SECURITY-ASSESSMENT.md). Netlify serves the frontend; Render serves the API and generation worker; Atlas stores application data; Supabase optionally verifies Google identity. Cloudflare is an optional DNS/security layer.

Do not enable commercial checkout until the operator identity, contact details, provider terms, payment tests, backup restoration and applicable policies have been completed. The code does not certify security, guarantee learning outcomes, or demonstrate capacity for 100,000 simultaneous users.
