"use client";
import { useEffect, useState } from "react";
import {
  PACKS,
  formatMinorPrice,
  packPrice,
  tokenLabel,
  type BillingCurrency,
} from "@/lib/billing/packs";

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
  semester: {
    label: "Semester Pass",
    blurb: "A six-month bulk study budget for one semester.",
    featured: true,
  },
};

export default function PricingClient({
  currency,
}: {
  currency: BillingCurrency;
}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [regionStatus, setRegionStatus] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);

  useEffect(() => {
    const pending = new URLSearchParams(window.location.search).get("buy");
    if (pending && Object.hasOwn(PACKS, pending)) {
      window.location.replace("/checkout/" + encodeURIComponent(pending));
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch("/api/credits", { signal: controller.signal, cache: "no-store" })
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

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch("/api/billing/region", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!controller.signal.aborted && data?.currency === currency) {
          setCheckoutEnabled(data.checkoutEnabled === true);
          setRegionStatus("ready");
        } else if (active) {
          setRegionStatus("failed");
        }
      })
      .catch(() => {
        if (active) setRegionStatus("failed");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [currency]);

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
        purchases. Prices are shown in {currency} based on your location.
      </p>
      {regionStatus === "ready" && !checkoutEnabled && (
        <p className="payment-notice" role="status">
          Razorpay {currency} checkout is not enabled for this account yet. The
          displayed price is ready; international checkout will open after the
          payment account is approved and configured.
        </p>
      )}
      {regionStatus === "loading" && (
        <p className="small" role="status">
          Checking payment availability for {currency}…
        </p>
      )}
      {regionStatus === "failed" && (
        <p className="payment-notice" role="status">
          We could not confirm {currency} checkout availability. Refresh this
          page to try again.
        </p>
      )}
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
                {id === "semester" ? "Semester value" : "Suggested pack"}
              </div>
            )}
            <h2 style={{ margin: "4px 0" }}>
              {formatMinorPrice(packPrice(id, currency) * 100, currency)}
            </h2>
            <b>
              {plan.credits} credits · {plan.credits} note sections
            </b>
            <p className="small">{COPY[id]?.blurb}</p>
            {plan.durationDays && (
              <p className="small">
                Plan your study over {plan.durationDays} days. One payment;
                no automatic renewal.
              </p>
            )}
            <button
              className="btn dark"
              disabled={regionStatus !== "ready" || !checkoutEnabled}
              onClick={() => window.location.assign("/checkout/" + id)}
              style={{ marginTop: 12 }}
            >
              {regionStatus === "loading"
                ? "Checking availability…"
                : regionStatus === "failed"
                  ? "Refresh to retry"
                  : checkoutEnabled
                    ? `Buy ${COPY[id]?.label ?? id}`
                    : `${currency} checkout unavailable`}
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
      {currency === "INR" && (
        <p className="payment-notice">
          💳 <b>Prefer UPI?</b>{" "}
          <a href="/pay">Pay directly via any UPI app →</a>
          <br />
          <span className="small">
            Scan QR, pay, enter UTR. Credits are added after payment review.
          </span>
        </p>
      )}
      <p>
        <a href="/refer">Invite a friend and earn credits →</a>
      </p>
    </div>
  );
}
