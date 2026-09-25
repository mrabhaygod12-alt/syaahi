"use client";
import { useEffect, useState } from "react";
import { PACKS, tokenLabel } from "@/lib/billing/packs";

const COPY: Record<
  string,
  { label: string; blurb: string; featured?: boolean }
> = {
  try: { label: "Try", blurb: "A small topic, clearly explained." },
  starter: { label: "Starter", blurb: "A short lesson or two." },
  popular: {
    label: "Popular",
    blurb: "Best for a full course outline.",
    featured: true,
  },
  pro: { label: "Pro", blurb: "Long syllabi and YouTube lectures." },
};

export default function Pricing() {
  const [balance, setBalance] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((j) => setBalance(j.balance));
  }, []);

  async function buy(pack: string) {
    setMsg("");
    setBusy(pack);
    try {
      const r = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const j = await r.json();
      if (j.error) {
        setMsg(j.error);
        return;
      }
      if (!(window as any).Razorpay)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Checkout failed to load."));
          document.head.appendChild(script);
        });
      const checkout = new (window as any).Razorpay({
        key: j.keyId,
        order_id: j.orderId,
        amount: j.amount,
        currency: "INR",
        name: "Syaahi",
        description: `${tokenLabel(j.credits)} for ${j.credits} note pages`,
        handler: async (payment: unknown) => {
          const verified = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payment),
          });
          const result = await verified.json();
          if (!verified.ok) {
            setMsg(result.error || "Payment pending verification.");
            return;
          }
          setBalance(result.balance);
          setMsg("Payment verified. Tokens added.");
        },
      });
      checkout.open();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Checkout unavailable.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <p className="small">
        <a href="/dashboard">← Home</a>
      </p>
      <h1>A little goes a long way.</h1>
      <p className="small">
        1 token = 3 generated note pages. One page uses ⅓ token; PDF
        continuation sheets are free. Current balance:{" "}
        <b>
          {balance === null ? "…" : tokenLabel(balance)} ({balance ?? 0}{" "}
          pages)
        </b>
      </p>
      <p className="small">
        The full outline cost is shown before generation. If your balance is too
        low, shorten the outline or add tokens before starting.
      </p>
      <div className="pricing-grid">
        {Object.entries(PACKS).map(([id, p]) => {
          const c = COPY[id];
          return (
            <div
              key={id}
              className={`pricing-card ${c?.featured ? "featured" : ""}`}
            >
              {c?.featured && (
                <div
                  className="small"
                  style={{ color: "#214b40", fontWeight: 700 }}
                >
                  Suggested pack
                </div>
              )}
              <h2 style={{ margin: "4px 0" }}>₹{p.inr}</h2>
              <b>
                {tokenLabel(p.credits)} · {p.credits} pages
              </b>
              <p className="small">{c?.blurb}</p>
              <button
                className="btn dark"
                disabled={busy === id}
                onClick={() => buy(id)}
                style={{ marginTop: 12 }}
              >
                {busy === id ? "Opening checkout…" : `Buy ${c?.label ?? id}`}
              </button>
            </div>
          );
        })}
      </div>
      {msg && (
        <p
          className="small"
          style={{
            marginTop: 16,
            background: "#fdf8ec",
            border: "1px solid #f0dfba",
            padding: 12,
            borderRadius: 12,
          }}
        >
          {msg}
        </p>
      )}
      <p className="small" style={{ marginTop: 16 }}>
        Payments are credited only after verified capture. Failed generation
        returns unused page units.
      </p>
      <p>
        <a href="/refer">Invite a friend and earn a token →</a>
      </p>
    </div>
  );
}
