"use client";
import { useState } from "react";
import { loadCheckout, paymentRequest } from "@/lib/billing/checkout-client";
import {
  MONTHLY_PLANS,
  type MonthlyTier,
} from "@/lib/billing/subscription-plans";
export default function SubscriptionCheckout({ tier }: { tier: MonthlyTier }) {
  const plan = MONTHLY_PLANS[tier],
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function checkout() {
    if (!accepted || busy) return;
    setBusy(true);
    setMessage("Opening secure checkout…");
    try {
      const { response, data } = await paymentRequest(
        "/api/billing/subscription",
        { tier, acceptRecurring: true },
      );
      if (response.status === 401) {
        location.assign(`/login?next=/subscribe/${tier}`);
        return;
      }
      if (!response.ok) throw new Error(data.error);
      await loadCheckout();
      const modal = new (window as any).Razorpay({
        key: data.keyId,
        subscription_id: data.subscription.id,
        name: "Syaahi",
        description: `${plan.label}: ₹${plan.inr}/month`,
        theme: { color: "#214d41" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setMessage("Checkout closed. Check Billing before trying again.");
          },
        },
        handler: async (result: unknown) => {
          try {
            const verified = await paymentRequest(
              "/api/billing/subscription/verify",
              result,
            );
            if (!verified.response.ok) throw new Error(verified.data.error);
            setMessage(
              verified.data.credited
                ? "Payment verified. Your monthly credits are available."
                : "Mandate authorised. Credits arrive after the monthly payment is captured. Check Billing for updates.",
            );
          } catch (e) {
            setMessage(
              e instanceof Error
                ? e.message
                : "Verification pending. Check Billing.",
            );
          } finally {
            setBusy(false);
          }
        },
      });
      modal.on("payment.failed", () => {
        setBusy(false);
        setMessage(
          "Payment failed. Check Billing before starting another payment.",
        );
      });
      modal.open();
    } catch (e) {
      setBusy(false);
      setMessage(e instanceof Error ? e.message : "Checkout unavailable.");
    }
  }
  return (
    <section className="container narrow">
      <p className="eyebrow">Monthly subscription</p>
      <h1>{plan.label}</h1>
      <div className="card">
        <p className="plan-price">
          ₹{plan.inr}
          <small>/month</small>
        </p>
        <p>
          {plan.credits} credits for each captured monthly payment. Up to{" "}
          {plan.maxSlides} slides per presentation.
        </p>
        <p>
          This creates a recurring payment mandate. It renews monthly for up to
          120 cycles, unless cancelled. Razorpay checkout indicates test mode
          when test keys are configured.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          I agree to the <a href="/terms">Terms</a> and{" "}
          <a href="/refunds">Refund Policy</a>, and authorise ₹{plan.inr}{" "}
          monthly until cancellation.
        </label>
        <button
          className="btn dark"
          disabled={busy || !accepted}
          onClick={() => void checkout()}
        >
          {busy ? "Please wait…" : "Continue to Razorpay"}
        </button>
        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}
        <p>
          <a href="/account/billing">Manage or check subscription</a>
        </p>
      </div>
    </section>
  );
}
