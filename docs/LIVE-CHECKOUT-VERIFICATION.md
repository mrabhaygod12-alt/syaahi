# Production authentication, support and checkout

The 28 September 2026 incident returned Render HTML 502 responses through the
Vercel API proxy. The frontend tried to parse those pages as JSON. After the
Render deployment recovered, `/api/health` returned healthy MongoDB, Google
OAuth initialization returned a Supabase authorization URL, and signed-out
support requests returned the expected JSON 401. This does not establish the
cause of the temporary Render outage; inspect runtime logs and service events
if it recurs.

Client requests now time out, handle non-JSON service failures, and allow users
to retry. Login and payment POST requests are never automatically replayed.
The support inbox distinguishes unavailable, loading, signed-out and empty
states. A failed refresh after saving a ticket does not claim that the save failed.

## Deployment configuration

- Vercel: `BACKEND_URL=https://syaahi.onrender.com`; `BACKEND_PROXY_SECRET`
  must match the Render API service. Keep `NEXT_PUBLIC_APP_URL` set to
  `https://www.syaahii.in`.
- Render API: genuine matching LIVE `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
  and a separate `RAZORPAY_WEBHOOK_SECRET`. Never put secrets in public variables.
- Razorpay LIVE dashboard: webhook
  `https://www.syaahii.in/api/razorpay/webhook`, `payment.captured`, same webhook
  secret. Enable automatic capture. Test and Live configurations are separate.
- Save environment changes and redeploy Render. The public
  `/api/billing/region` response should show `paymentMode: "live"` and
  `checkoutEnabled: true` for an enabled currency. This checks configuration
  presence and key mode, not provider authentication or merchant approval.
- Enable USD/EUR through `RAZORPAY_SUPPORTED_CURRENCIES=INR,USD,EUR` only after
  Razorpay approves those currencies. INR is enabled by default.

## Final account test

1. Open the production site in a private browser window, agree to terms and
   complete Google sign-in. Verify the callback returns to your dashboard.
2. Test email registration with an inbox you control. Before verification,
   protected actions must be blocked. Open the delivered verification link,
   then sign out and sign in using the password.
3. On Support, create a ticket, refresh, add a reply and mark it resolved.
4. Choose the INR ₹9 pack from an Indian connection. Confirm the merchant,
   amount and LIVE mode, then personally complete a real payment. This charges
   real money; automated tests do not perform this transaction.
5. Payment history must report captured/paid, and credits must increase once.
   Refreshing or a duplicate webhook must not grant additional credits.
6. Check the corresponding Razorpay LIVE payment and webhook delivery status.
   If debited but pending, check history/support before paying again.

Automated tests use isolated data or mocked requests. They cannot certify
Google account consent, delivery to a real mailbox or a real bank capture.
