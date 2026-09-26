# Replaceable UPI QR references

phonepe.png, paytm.png, google-pay.png and navi.png are generated SAMPLE references. All four currently encode the SAME owner-provided destination: 8090912278@ybl, CHANDAN PANDEY. They are not four independently verified merchant accounts and do not contain an amount.

You may replace these files with your app-exported QR images. Check the decoded receiving UPI ID and payee name before publishing. These reference files deliberately do not control checkout: checkout generates its own QR locally with the server-owned amount and order reference, from UPI_MERCHANT_ID and UPI_MERCHANT_NAME. No third-party QR image service receives order details.

If a replacement points to another account, update and verify the server merchant configuration too before collecting money. Never include a UPI PIN, OTP or bank statement in this public folder.
