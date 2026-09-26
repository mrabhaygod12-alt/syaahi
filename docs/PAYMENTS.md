# Payment operations and activation

## Two supported paths

| Path                  | Customer                                          | Confirmation                                                                                                                 | Configuration                                                           |
| --------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Direct UPI (`/pay`)   | Scan the amount-specific QR, pay, submit bank UTR | Trusted operator checks bank receipt at `/admin/payments`, then approves                                                     | MongoDB replica set/Atlas, receiving UPI ID/name, payment administrator |
| Razorpay (`/pricing`) | Gateway checkout                                  | Server verifies checkout signature and fetched captured payment; signed `payment.captured` webhook recovers missed callbacks | Activated merchant account, key ID, secret, webhook secret              |

A typed UTR, screenshot or client success state is never sufficient to grant credits. Static UPI QR payments cannot be automatically matched without an actual bank/provider reconciliation integration. The old generic `/api/upi/gateway-webhook` endpoint returns 410: its invented signature format was not a working gateway integration.

## Direct UPI setup

Owner-provided public receiving identity: `8090912278@ybl`, `CHANDAN PANDEY`. Confirm the resolved bank payee in the UPI app before a real payment. This identity is configurable on the Render API service with `UPI_MERCHANT_ID` and `UPI_MERCHANT_NAME`; these are public payee details, not credentials.

Payment operators are identified by immutable account IDs in the private `payment_admins` MongoDB collection (`active: true`) or `PAYMENT_ADMIN_IDS` server environment variable. Support agents do not automatically receive money-approval access. Provision roles only through a trusted operator/database session. There is no browser endpoint for self-promotion. The owner-requested account was provisioned in the configured Atlas database; its password is not included in this repository. Log in normally and visit `/admin/payments` after deployment.

The explicit operator CLI `scripts/provision-payment-admin.ts` accepts the private environment file path and JSON credentials over stdin. It hashes the password, revokes existing sessions, saves the role, and updates the private environment allowlist. Do not put passwords in shell history or Git. It intentionally requires direct operator access to the database.

Manual orders are disabled if no payment reviewer is configured. Local SQLite development does not implement manual UPI; use an isolated MongoDB replica set for this flow.

### QR replacement folder

`public/payments/qr/` contains `phonepe.png`, `paytm.png`, `google-pay.png`, `navi.png`. These four **sample reference images all point to the same provided UPI account**. They contain no amount and are not four verified bank destinations. They can be replaced for branding/reference after decoding and checking the payee. The actual checkout continues to generate a local amount-specific QR using server merchant configuration; replacing a reference image cannot silently redirect checkout payments. No external QR image service receives order details.

### Review procedure

1. Open the receiving bank/merchant statement independently.
2. Match UTR, exact amount, recipient and receipt status to the order. A screenshot is insufficient.
3. Approve only after this match; the UI asks for confirmation. Approval, ledger entry, wallet increment and paid order commit together. Retrying approval does not add credits again.
4. If no receipt exists, reject with a clear reason. If the customer reports money debited, investigate before requesting another payment.
5. Customers can resume UTR submission or status from paginated payment history. QR sessions end after 30 minutes; already-paid references can be submitted within seven days. Older cases go through support.

Financial records **do not use a deletion TTL**. The application removes the legacy `expiresAt` TTL index when initializing UPI storage, while retaining the expiry timestamp for order state. Records already deleted by the old TTL cannot be recreated automatically: reconcile them against bank receipts and database backups. A case-insensitive unique UTR index blocks reference reuse; if legacy duplicate references prevent index creation, investigate them before enabling manual checkout.

## Automatic gateway activation: Razorpay

Razorpay is selected because this app already uses its server orders, signature verification and capture model. It offers a documented checkout and signed webhook integration rather than trusting a generic Auto-UTR claim.

1. In Razorpay, finish required merchant onboarding and enable the payment methods supported for the account.
2. Put **test-mode** `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` into Render's API-service environment, not client code. Configure automatic capture in the merchant dashboard.
3. Create a separate `RAZORPAY_WEBHOOK_SECRET`. Configure the webhook URL as `https://syaahii.netlify.app/api/razorpay/webhook` (or your actual frontend origin), with event `payment.captured`. The frontend proxy carries it to Render; the API validates the raw-body signature.
4. Keep `BACKEND_URL`, matching `BACKEND_PROXY_SECRET`, and `NEXT_PUBLIC_APP_URL` correct on the applicable services. Do not route the gateway directly to Render's protected API without its intended ingress.
5. Deploy the pushed main branch on Netlify and Render. Test successful capture, cancelled checkout, invalid signature, repeated callback and webhook, and a browser close before callback. Check the bank/provider dashboard and Syaahi ledger together.
6. After test verification, configure live keys and a live webhook, then perform a small authorised live purchase. A passing local test is not proof of settlement or live activation.

Published standard Razorpay pricing checked 26 September 2026 shows 2% platform fees plus applicable GST, with exceptions/account-specific terms. Do not advertise this gateway as universally zero-fee or document-free. Direct UPI does not incur a Razorpay fee because Razorpay is not involved; bank/app/business conditions still apply.

Official references:

- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- https://razorpay.com/docs/webhooks/validate-test/
- https://razorpay.com/pricing/

## Security and practical limits

HTTPS protects data in transit; hashed passwords and restricted server/database access protect account operations. This is not end-to-end encryption: operators must read transaction references to reconcile payments. Never collect a customer's UPI PIN or OTP. Configure Atlas network restrictions, encrypted backups and restricted staff access operationally.

Manual review requires staffing and does not scale like an automatic gateway. Refunds, disputes, partial/overpayments and older receipt corrections require an operator; no automated bank-refund integration is claimed. Do not automatically grant a partial-payment credit pack. Review the published refund/support policy and actual response hours before launch.

## Verification

`npx tsx scripts/test-payments.ts --http` runs against an isolated MongoDB replica set and a local production build. It covers financial-record retention migration, owner/admin restrictions, concurrent UTR submission, concurrent approval/capture replay, rollback, server-owned prices, forged webhooks and responsive QR rendering. Run `npm run build` first. These tests do not charge a bank account or call live Razorpay.
