"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderSummary } from "@/lib/billing/orders";
import { paymentRequest } from "@/lib/billing/checkout-client";
import { formatMinorPrice, type BillingCurrency } from "@/lib/billing/packs";

export default function PaymentStatus({ orderId }: { orderId?: string }) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { response, data } = await paymentRequest(
        `/api/razorpay/orders${orderId ? `?order=${encodeURIComponent(orderId)}` : ""}`,
      );
      if (!mounted.current) return true;
      if (response.status === 401) {
        window.location.assign(
          `/login?next=${encodeURIComponent(orderId ? `/payments/${orderId}` : "/payments")}`,
        );
        return true;
      }
      if (!response.ok)
        throw new Error(data.error || "Payment status could not be loaded.");
      setOrders(data.orders);
      return !orderId || data.orders[0]?.paid === true;
    } catch (err) {
      if (mounted.current)
        setError(
          err instanceof Error && err.name !== "TimeoutError"
            ? err.message
            : "Status check timed out. Please try again shortly.",
        );
      return true;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [orderId]);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let checks = 0;
    const poll = async () => {
      const finished = await refresh();
      if (!cancelled && !finished && ++checks < 12)
        timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => {
      cancelled = true;
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  const order = orderId ? orders[0] : undefined;
  return (
    <div className="payment-flow">
      <a href={orderId ? "/payments" : "/pricing"}>
        ← {orderId ? "Payment history" : "All plans"}
      </a>
      <p className="payment-eyebrow">YOUR PAYMENTS</p>
      <h1>
        {orderId
          ? order?.paid
            ? "Payment confirmed."
            : "Payment status"
          : "Your Razorpay purchases"}
      </h1>
      <div role="status" aria-live="polite">
        {error || (loading && !orders.length ? "Checking your account…" : "")}
      </div>
      {!loading && !error && !orders.length && (
        <p>
          No Razorpay orders found. <a href="/pricing">Explore plans →</a>
        </p>
      )}
      {orders.map((item) => (
        <section className="payment-panel" key={item.id}>
          <span className={`payment-badge ${item.paid ? "confirmed" : ""}`}>
            {item.paid ? "Captured and credited" : "Awaiting confirmation"}
          </span>
          <h2>
            {formatMinorPrice(
              item.amount,
              ["INR", "USD", "EUR"].includes(item.currency)
                ? (item.currency as BillingCurrency)
                : "INR",
            )}{" "}
            · {item.pack} pack
          </h2>
          <p>
            {item.credits} credits{" "}
            {item.paid
              ? "added to your account"
              : "will be added after verified capture"}
            .
          </p>
          <p className="small">
            Order reference: <code>{item.id}</code>
          </p>
          {item.paymentId && (
            <p className="small">
              Payment reference: <code>{item.paymentId}</code>
            </p>
          )}
          {!orderId && <a href={`/payments/${item.id}`}>View payment →</a>}
          {orderId && !item.paid && (
            <p>
              We have not received a captured-payment confirmation. This can
              also happen if checkout was closed or an attempt failed. If money
              was debited, check again or contact support with this order
              reference before paying again.
            </p>
          )}
          {orderId && item.paid && (
            <a className="btn dark" href="/dashboard">
              Start studying →
            </a>
          )}
        </section>
      ))}
      <button className="btn" disabled={loading} onClick={() => void refresh()}>
        {loading ? "Checking…" : "Refresh payment status"}
      </button>
      <p>
        <a href="/support">Payment support</a> ·{" "}
        <a href="/profile">Account and credit balance</a> ·{" "}
        <a href="/pay">Direct UPI payments</a>
      </p>
      <p className="small">
        Status comes from your account’s payment record. Direct UPI submissions
        are tracked separately on the UPI page.
      </p>
    </div>
  );
}
