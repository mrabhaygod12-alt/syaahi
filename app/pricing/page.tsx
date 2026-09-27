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
  useEffect(() => {
    const pending = new URLSearchParams(window.location.search).get("buy");
    if (pending && Object.hasOwn(PACKS, pending)) {
      window.location.replace("/checkout/" + encodeURIComponent(pending));
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch("/api/credits", { signal: controller.signal })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!controller.signal.aborted && typeof data?.balance === "number")
          setBalance(data.balance);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <p className="small">
        <a href="/dashboard">← Home</a>
      </p>
      <h1>A little goes a long way.</h1>
      <p>
        One credit covers one generated note section. Extra PDF continuation
        sheets are free.
      </p>
      {balance !== null && (
        <p className="small">
          Your balance:{" "}
          <b>
            {balance} credits ({tokenLabel(balance)})
          </b>
        </p>
      )}
      <p className="small">
        See the full outline cost before generation. All packs are one-time
        purchases.
      </p>
      <div className="pricing-grid">
        {Object.entries(PACKS).map(([id, plan]) => (
          <div
            key={id}
            className={"pricing-card " + (COPY[id]?.featured ? "featured" : "")}
          >
            {COPY[id]?.featured && (
              <div
                className="small"
                style={{ color: "#214b40", fontWeight: 700 }}
              >
                Suggested pack
              </div>
            )}
            <h2 style={{ margin: "4px 0" }}>₹{plan.inr}</h2>
            <b>
              {plan.credits} credits · {plan.credits} note sections
            </b>
            <p className="small">{COPY[id]?.blurb}</p>
            <button
              className="btn dark"
              onClick={() => window.location.assign("/checkout/" + id)}
              style={{ marginTop: 12 }}
            >
              Buy {COPY[id]?.label ?? id}
            </button>
          </div>
        ))}
      </div>
      <p>
        <a href="/payments">Payment history and status →</a>
      </p>
      <p className="small">
        Credits are added after verified payment capture. Failed generation
        returns unused credits.
      </p>
      <p className="payment-notice">
        💳 <b>Prefer UPI?</b> <a href="/pay">Pay directly via any UPI app →</a>
        <br />
        <span className="small">
          Scan QR, pay, enter UTR. Credits are added after payment review.
        </span>
      </p>
      <p>
        <a href="/refer">Invite a friend and earn credits →</a>
      </p>
    </div>
  );
}
