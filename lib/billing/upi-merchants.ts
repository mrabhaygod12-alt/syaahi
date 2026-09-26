// Destinations decoded from the merchant-supplied QR images (2026-09-26).
export const UPI_MERCHANTS = {
  phonepe: {
    label: "PhonePe",
    id: "8090912278@ibl",
    name: "CHANDAN PANDEY",
    image: "/payments/qr/phonepe.jpeg",
  },
  paytm: {
    label: "Paytm",
    id: "8090912278@ptyes",
    name: "CHANDAN PANDEY",
    image: "/payments/qr/paytm.jpeg",
  },
  googlepay: {
    label: "Google Pay",
    id: "chandanabhay458@okhdfcbank",
    name: "chandan pandey",
    image: "/payments/qr/google-pay.jpeg",
  },
  navi: {
    label: "Navi",
    id: "8090912278@nyes",
    name: "CHANDAN PANDEY",
    image: "/payments/qr/navi.jpeg",
  },
} as const;
export type UpiMerchant = keyof typeof UPI_MERCHANTS;
