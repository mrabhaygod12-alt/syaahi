"use client";
import { useEffect, useRef, useState } from "react";
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
  const autoBuyStarted = useRef(false);

  useEffect(() => {
    let active = true;
    const pendingPack = new URLSearchParams(window.location.search).get("buy");
    fetch("/api/credits")
      .then(async (r) => ({ response: r, data: await r.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setBalance(null);
          return;
        }
        setBalance(typeof data.balance === "number" ? data.balance : null);
        if (
          pendingPack &&
          Object.hasOwn(PACKS, pendingPack) &&
          !autoBuyStarted.current
        ) {
          autoBuyStarted.current = true;
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("buy");
          window.history.replaceState({}, "", cleanUrl);
          void buy(pendingPack);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function buy(pack: string) {
    setMsg("");
    setBusy(pack);
    let opened = false;
    try {
      const r = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const j = await r.json();
      if (r.status === 401) {
        const next = `/pricing?buy=${encodeURIComponent(pack)}`;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!r.ok || j.error) {
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
        description: `${j.testMode ? "TEST — no real money — " : ""}${tokenLabel(j.credits)} for ${j.credits} note pages`,
        modal: {
          ondismiss: () => {
            setBusy(null);
            setMsg(
              "Checkout closed. If money was debited, wait for confirmation and contact support before paying again.",
            );
          },
        },
        handler: async (payment: unknown) => {
          try {
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
          } catch {
            setMsg(
              "Confirmation interrupted. Do not pay again. Refresh your balance shortly or contact support with your payment ID.",
            );
          } finally {
            setBusy(null);
          }
        },
      });
      checkout.on("payment.failed", () => {
        setMsg(
          "Payment did not complete. If debited, contact support before retrying.",
        );
        setBusy(null);
      });
      checkout.open();
      opened = true;
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Checkout unavailable.");
    } finally {
      if (!opened) setBusy(null);
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
          {balance === null ? "…" : tokenLabel(balance)} ({balance ?? 0} pages)
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
                disabled={busy !== null}
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
      <p
        style={{
          marginTop: 12,
          padding: "14px 20px",
          background: "#e8f0df",
          borderRadius: 14,
          border: "1px solid #cad8c2",
        }}
      >
        💳 <b>Prefer UPI?</b>{" "}
        <a href="/pay" style={{ color: "#214b40", fontWeight: 600 }}>
          Pay directly via any UPI app →
        </a>
        <br />
        <span className="small" style={{ color: "#687a61" }}>
          Scan QR, pay, enter UTR — no Razorpay needed.
        </span>
      </p>
      <p>
        <a href="/refer">Invite a friend and earn a token →</a>
      </p>
    </div>
  );
}
