/** Server-only environment inspection; never return credentials to status callers. */
export function razorpayCredentials() {
  return {
    keyId: (process.env.RAZORPAY_KEY_ID || "").trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || "").trim(),
  };
}
export function paymentConfiguration() {
  const { keyId, keySecret } = razorpayCredentials();
  const mode = /^rzp_live_[A-Za-z0-9]+$/.test(keyId)
    ? "live"
    : /^rzp_test_[A-Za-z0-9]+$/.test(keyId)
      ? "test"
      : "unconfigured";
  const configured =
    mode !== "unconfigured" &&
    !!keySecret &&
    !!process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  return { mode, configured };
}
