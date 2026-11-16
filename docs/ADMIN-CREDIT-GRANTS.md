# Administrator credit grants

Admin credit adjustments use the same wallet and ledger as verified payments.
They do not create a payment receipt, subscription, or cash refund.

## Controls

- Only an active user administrator with a current MFA-authenticated session can
  grant credits.
- The target account must exist, be active, and already have a wallet.
- A single grant is limited to 10,000 credits and requires a 5–300 character
  reason.
- A UUID operation ID makes retries idempotent. Reusing an operation ID with
  different grant details returns a conflict instead of changing the balance.
- Wallet, credit-ledger, and admin-audit writes commit in one SQLite or MongoDB
  transaction. The audit records actor, recipient, amount, reason, and ledger
  reference.
- The account detail view lists recent administrator grants. Standard credit
  ledger history remains available to the account owner.

## Admin workflow

Open **Admin → Users**, search the recipient by email or account ID, and choose
**Inspect account**. In the wallet adjustment panel, enter the credit amount and
reason, then choose **Grant credits**. The response shows the resulting balance
and the recorded ledger entry. The panel is available at `/admin/users` and
inherits the existing admin MFA gate.

## Verification

`npm run test:admin-security` exercises denied users, successful credit grants,
idempotent retries, operation-ID conflicts, amount bounds, ledger visibility,
audit attribution, and both SQLite and MongoDB storage. The admin browser suite
also verifies the 3,000-credit demonstration grant and mobile layout using a
disposable local account.
