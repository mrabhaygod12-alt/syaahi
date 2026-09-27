"use client";
import { useRef, useState } from "react";
import { PACKS } from "@/lib/billing/packs";
import { loadCheckout, paymentRequest } from "@/lib/billing/checkout-client";

type Order = {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  testMode: boolean;
  credits: number;
};
export default function Checkout({ pack }: { pack: string }) {
  const plan = PACKS[pack];
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const confirming = useRef(false);

  async function pay() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    let opened = false;
    try {
      await loadCheckout();
      let saved = order;
      if (!saved) {
        const { response, data } = await paymentRequest("/api/razorpay/order", {
          pack,
        });
        if (response.status === 401) {
          window.location.assign(
            `/login?next=${encodeURIComponent(`/checkout/${pack}`)}`,
          );
          return;
        }
        if (!response.ok)
          throw new Error(
            data.error || "Checkout is unavailable. Please try again.",
          );
        saved = data as Order;
        setOrder(saved);
      }
      const current = saved;
      const statusUrl = `/payments/${encodeURIComponent(current.orderId)}`;
      confirming.current = false;
      const checkout = new (window as any).Razorpay({
        key: current.keyId,
        order_id: current.orderId,
        amount: current.amount,
        currency: current.currency,
        name: "Syaahi",
        description: `${current.testMode ? "TEST — no real money — " : ""}${current.credits} study credits`,
        theme: { color: "#214b40" },
        modal: {
          ondismiss: () => {
            if (confirming.current) return;
            locked.current = false;
            setBusy(false);
            setMessage(
              "Checkout closed. If money was debited, check payment status before trying again.",
            );
          },
        },
        handler: async (payment: unknown) => {
          confirming.current = true;
          setMessage("Confirming your payment…");
          try {
            await paymentRequest("/api/razorpay/verify", payment);
          } catch {
            /* Signed webhooks can finish confirmation after a network interruption. */
          }
          window.location.assign(statusUrl);
        },
      });
      checkout.on("payment.failed", () => {
        setMessage(
          "The payment attempt failed. You can retry inside checkout. If debited, check payment status before another attempt.",
        );
      });
      checkout.open();
      opened = true;
    } catch (error) {
      setMessage(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Checkout took too long to respond. Check payment history before trying again.",
      );
    } finally {
      if (!opened) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div className="payment-flow">
      <a href="/pricing">← All plans</a>
      <p className="payment-eyebrow">SECURE CHECKOUT</p>
      <h1>Your next study session starts here.</h1>
      <div className="payment-panel">
        <p className="payment-eyebrow">{pack} pack · One-time purchase</p>
        <h2>
          ₹{plan.inr} <span className="small">INR</span>
        </h2>
        <p>
          <strong>{plan.credits} credits</strong> for {plan.credits} generated
          note sections.
        </p>
        <p className="small">
          One credit covers one generated section. Additional PDF continuation
          sheets are free. No recurring subscription.
        </p>
        {order?.testMode && (
          <p className="payment-notice">
            Test checkout: no real money will be charged.
          </p>
        )}
        <button className="btn dark" disabled={busy} onClick={pay}>
          {busy
            ? "Checkout in progress…"
            : order
              ? "Continue payment"
              : `Pay ₹${plan.inr} with Razorpay`}
        </button>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {order && (
          <p>
            <a href={`/payments/${order.orderId}`}>
              Check this payment’s status →
            </a>
          </p>
        )}
      </div>
      <p className="small">
        Credits are added after payment is captured and verified. If
        confirmation is delayed, your payment-status page will update when the
        gateway confirms it.
      </p>
      <p>
        <a href="/payments">Payment history</a> ·{" "}
        <a href="/refunds">Refund policy</a> · <a href="/support">Get help</a>
      </p>
      <p>
        Prefer UPI? <a href="/pay">Pay directly via any UPI app →</a>
      </p>
    </div>
  );
}
