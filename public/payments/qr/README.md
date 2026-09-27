# Owner-supplied UPI QR images

The four original images are published unchanged. Their decoded receiving IDs are:

| File | Receiving ID |
| --- | --- |
| phonepe.jpeg | 8090912278@ibl |
| paytm.jpeg | 8090912278@ptyes |
| google-pay.jpeg | chandanabhay458@okhdfcbank |
| navi.jpeg | 8090912278@nyes |

Checkout lets the user select a receiving QR before creating an order. The selected receiving ID, payee name and QR provider are saved on that order. Original static QRs have no amount: enter the exact order amount manually. The UPI-app link includes the same receiving ID and amount. Replacing an image requires updating and decoding the catalog in lib/billing/upi-merchants.ts. Old orders keep their original receiving ID for bank reconciliation.
