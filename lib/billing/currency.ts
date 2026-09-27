import type { BillingCurrency } from "./packs";

// The euro area has 21 EU members in 2026, plus Andorra, Monaco, San Marino,
// Vatican City, Kosovo and Montenegro, which also use the euro.
const EURO_COUNTRIES = new Set([
  "AD",
  "AT",
  "BE",
  "BL",
  "BG",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GF",
  "GP",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MC",
  "ME",
  "MF",
  "MT",
  "MQ",
  "NL",
  "PM",
  "PT",
  "RE",
  "SI",
  "SK",
  "SM",
  "VA",
  "YT",
  "XK",
]);

export function currencyForCountry(
  country: string | null | undefined,
): BillingCurrency {
  const code = country?.trim().toUpperCase();
  if (!code) return "INR"; // Local development and non-geolocated requests.
  if (code === "IN") return "INR";
  if (EURO_COUNTRIES.has(code)) return "EUR";
  return "USD";
}

/** International charges stay off until explicitly enabled after gateway approval. */
export function enabledBillingCurrencies(
  setting = process.env.RAZORPAY_SUPPORTED_CURRENCIES,
): Set<BillingCurrency> {
  const enabled = new Set<BillingCurrency>(["INR"]);
  for (const value of (setting || "").split(",")) {
    const currency = value.trim().toUpperCase();
    if (currency === "USD" || currency === "EUR") enabled.add(currency);
  }
  return enabled;
}

export function isBillingCurrencyEnabled(currency: BillingCurrency) {
  return enabledBillingCurrencies().has(currency);
}
