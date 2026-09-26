"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { PACKS, tokenLabel } from "@/lib/billing/packs";

/* ────────── QR Code generator (pure client-side) ────────── */
function QRCodeSVG({ data, size = 200 }: { data: string; size?: number }) {
  /* Simple QR via Google Charts API fallback rendered as image */
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=8&format=svg`;
  return (
    <img
      src={url}
      alt="UPI QR Code"
      width={size}
      height={size}
      style={{ borderRadius: 12, background: "#fff", padding: 8 }}
    />
  );
}

/* ────────── Timer Component ────────── */
function CountdownTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const expiry = new Date(expiresAt).getTime();
    const tick = () => {
      const diff = expiry - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        onExpire();
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const isLow =
    new Date(expiresAt).getTime() - Date.now() < 5 * 60000 &&
    timeLeft !== "Expired";

  return (
    <span
      className={`upi-timer ${isLow ? "timer-low" : ""} ${timeLeft === "Expired" ? "timer-expired" : ""}`}
    >
      ⏱ {timeLeft}
    </span>
  );
}

/* ────────── Step indicators ────────── */
function StepIndicator({
  step,
  total,
}: {
  step: number;
  total: number;
}) {
  return (
    <div className="upi-steps">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`upi-step ${i + 1 <= step ? "active" : ""} ${i + 1 === step ? "current" : ""}`}
        >
          <div className="step-dot">
            {i + 1 < step ? "✓" : i + 1}
          </div>
          <span className="step-label">
            {["Select", "Scan & Pay", "Enter UTR", "Done"][i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ────────── Status Badge ────────── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending: { label: "⏳ Pending", cls: "badge-pending" },
    utr_submitted: { label: "📤 UTR Submitted", cls: "badge-submitted" },
    verifying: { label: "🔍 Verifying", cls: "badge-verifying" },
    approved: { label: "✅ Approved", cls: "badge-approved" },
    auto_verified: { label: "✅ Auto-verified", cls: "badge-approved" },
    rejected: { label: "❌ Rejected", cls: "badge-rejected" },
    expired: { label: "⌛ Expired", cls: "badge-expired" },
  };
  const c = config[status] || { label: status, cls: "" };
  return <span className={`upi-badge ${c.cls}`}>{c.label}</span>;
}

/* ────────── COPY ────────── */
const COPY: Record<
  string,
  { label: string; blurb: string; featured?: boolean; icon: string }
> = {
  try: { label: "Try", blurb: "A small topic, clearly explained.", icon: "✨" },
  starter: { label: "Starter", blurb: "A short lesson or two.", icon: "🚀" },
  popular: {
    label: "Popular",
    blurb: "Best for a full course outline.",
    featured: true,
    icon: "⭐",
  },
  pro: {
    label: "Pro",
    blurb: "Long syllabi and YouTube lectures.",
    icon: "💎",
  },
};

/* ────────── Main Page ────────── */
export default function UPICheckout() {
  const [balance, setBalance] = useState<number | null>(null);
  const [step, setStep] = useState(1); // 1=select, 2=scan, 3=utr, 4=done
  const [, setSelectedPack] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"info" | "error" | "success">("info");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((j) => setBalance(j.balance))
      .catch(() => {});
  }, []);

  /* ── Poll for status updates ── */
  const startPolling = useCallback((orderId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/upi/status?orderId=${orderId}`);
        const j = await r.json();
        if (j.status === "approved" || j.status === "auto_verified") {
          setPaymentStatus(j.status);
          setStep(4);
          setMsg("🎉 Payment verified! Credits added to your account.");
          setMsgType("success");
          if (pollRef.current) clearInterval(pollRef.current);
          // Refresh balance
          fetch("/api/credits")
            .then((r) => r.json())
            .then((j) => setBalance(j.balance));
        } else if (j.status === "rejected") {
          setPaymentStatus(j.status);
          setMsg(
            `❌ Payment rejected: ${j.rejectionReason || "Could not verify."} Please try again.`,
          );
          setMsgType("error");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 5000);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  /* ── Create order ── */
  async function createOrder(pack: string) {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/upi/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const j = await r.json();
      if (j.error) {
        setMsg(j.error);
        setMsgType("error");
        return;
      }
      setSelectedPack(pack);
      setOrder(j);
      setStep(2);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Failed to create order.");
      setMsgType("error");
    } finally {
      setBusy(false);
    }
  }

  /* ── Submit UTR ── */
  async function handleSubmitUTR() {
    if (!utr.trim()) {
      setMsg("Please enter your UTR number.");
      setMsgType("error");
      return;
    }
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/upi/submit-utr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, utr: utr.trim() }),
      });
      const j = await r.json();
      if (j.error) {
        setMsg(j.error);
        setMsgType("error");
        return;
      }
      setPaymentStatus("utr_submitted");
      setStep(4);
      setMsg(
        "✅ UTR submitted! We're verifying your payment. This usually takes 1-5 minutes.",
      );
      setMsgType("success");
      // Start polling for approval
      startPolling(order.orderId);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Failed to submit UTR.");
      setMsgType("error");
    } finally {
      setBusy(false);
    }
  }

  /* ── Load history ── */
  async function loadHistory() {
    try {
      const r = await fetch("/api/upi/status?history=1");
      const j = await r.json();
      setHistory(j.payments || []);
      setShowHistory(true);
    } catch {}
  }

  /* ── Reset ── */
  function reset() {
    setStep(1);
    setSelectedPack(null);
    setOrder(null);
    setUtr("");
    setMsg("");
    setPaymentStatus(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  return (
    <div className="upi-checkout-page">
      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <p className="small">
          <a href="/dashboard">← Home</a>
          {" · "}
          <a href="/pricing">Razorpay Checkout →</a>
        </p>

        <div className="upi-hero">
          <h1>
            <span className="upi-icon-title">💳</span> Pay via UPI
          </h1>
          <p className="upi-subtitle">
            Scan QR, pay from any UPI app, enter UTR — credits added instantly.
          </p>
          <p className="small" style={{ marginTop: 4 }}>
            Current balance:{" "}
            <b>
              {balance === null ? "…" : tokenLabel(balance)} ({balance ?? 0}{" "}
              pages)
            </b>
          </p>
        </div>

        <StepIndicator step={step} total={4} />

        {/* ── STEP 1: Pack Selection ── */}
        {step === 1 && (
          <div className="upi-pack-grid">
            {Object.entries(PACKS).map(([id, p]) => {
              const c = COPY[id];
              return (
                <div
                  key={id}
                  className={`upi-pack-card ${c?.featured ? "featured" : ""}`}
                  onClick={() => !busy && createOrder(id)}
                >
                  <div className="pack-icon">{c?.icon}</div>
                  {c?.featured && (
                    <div className="pack-badge">Most Popular</div>
                  )}
                  <h2 className="pack-price">₹{p.inr}</h2>
                  <div className="pack-details">
                    <b>
                      {tokenLabel(p.credits)} · {p.credits} pages
                    </b>
                  </div>
                  <p className="small pack-blurb">{c?.blurb}</p>
                  <button
                    className="btn dark pack-btn"
                    disabled={busy}
                  >
                    {busy ? "Creating…" : `Pay ₹${p.inr}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STEP 2: QR Code ── */}
        {step === 2 && order && (
          <div className="upi-qr-section">
            <div className="upi-qr-card">
              <div className="qr-header">
                <h2>Scan & Pay ₹{order.amountInr}</h2>
                <CountdownTimer
                  expiresAt={order.expiresAt}
                  onExpire={() => {
                    setMsg("⏰ Payment expired. Please start again.");
                    setMsgType("error");
                    setStep(1);
                  }}
                />
              </div>

              <div className="qr-body">
                <div className="qr-wrapper">
                  <QRCodeSVG data={order.deepLink} size={220} />
                </div>

                <div className="qr-info">
                  <div className="info-row">
                    <span className="info-label">UPI ID</span>
                    <span className="info-value">
                      <code>{order.upiId}</code>
                      <button
                        className="copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(order.upiId);
                          setMsg("UPI ID copied!");
                          setMsgType("info");
                          setTimeout(() => setMsg(""), 2000);
                        }}
                        title="Copy UPI ID"
                      >
                        📋
                      </button>
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Amount</span>
                    <span className="info-value highlight">
                      ₹{order.amountInr}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Pack</span>
                    <span className="info-value">
                      {COPY[order.pack]?.label} — {order.tokenLabel}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Order</span>
                    <span className="info-value mono">
                      {order.orderId.slice(0, 16)}…
                    </span>
                  </div>
                </div>

                <div className="qr-instructions">
                  <h3>How to pay:</h3>
                  <ol>
                    <li>Open any UPI app (GPay, PhonePe, Paytm, etc.)</li>
                    <li>Scan the QR code or enter the UPI ID manually</li>
                    <li>Pay exactly <b>₹{order.amountInr}</b></li>
                    <li>Note down the <b>UTR / Transaction Reference</b> number</li>
                  </ol>
                </div>
              </div>

              <div className="qr-actions">
                <a
                  href={order.deepLink}
                  className="btn dark"
                  target="_blank"
                  rel="noopener"
                  style={{ fontSize: "1rem" }}
                >
                  📱 Open UPI App
                </a>
                <button
                  className="btn light"
                  onClick={() => setStep(3)}
                  style={{ fontSize: "1rem" }}
                >
                  I've Paid → Enter UTR
                </button>
              </div>
            </div>

            <button className="btn-link" onClick={reset}>
              ← Choose different pack
            </button>
          </div>
        )}

        {/* ── STEP 3: UTR Input ── */}
        {step === 3 && order && (
          <div className="upi-utr-section">
            <div className="upi-utr-card">
              <h2>Enter UTR Number</h2>
              <p className="small">
                After paying ₹{order.amountInr}, enter the UTR /
                Transaction Reference Number from your UPI app's payment
                confirmation.
              </p>

              <div className="utr-input-group">
                <label htmlFor="utr-input">UTR / Reference Number</label>
                <input
                  id="utr-input"
                  type="text"
                  placeholder="e.g. 412345678901"
                  value={utr}
                  onChange={(e) =>
                    setUtr(e.target.value.replace(/[^A-Za-z0-9]/g, ""))
                  }
                  maxLength={22}
                  className="utr-input"
                  autoComplete="off"
                  autoFocus
                />
                <p className="small utr-hint">
                  UTR is 12-22 characters. Find it in your payment app under
                  "Transaction Details" or "Payment Reference".
                </p>
              </div>

              <div className="utr-summary">
                <div className="info-row">
                  <span className="info-label">Amount Paid</span>
                  <span className="info-value highlight">₹{order.amountInr}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Credits</span>
                  <span className="info-value">{order.credits} pages ({order.tokenLabel})</span>
                </div>
              </div>

              <div className="utr-actions">
                <button
                  className="btn dark"
                  onClick={handleSubmitUTR}
                  disabled={busy || utr.length < 12}
                  style={{ fontSize: "1rem" }}
                >
                  {busy ? "Submitting…" : "Submit UTR"}
                </button>
                <button
                  className="btn light"
                  onClick={() => setStep(2)}
                >
                  ← Back to QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Status/Confirmation ── */}
        {step === 4 && (
          <div className="upi-status-section">
            <div className="upi-status-card">
              {paymentStatus === "approved" || paymentStatus === "auto_verified" ? (
                <div className="status-success">
                  <div className="status-icon">🎉</div>
                  <h2>Payment Confirmed!</h2>
                  <p>
                    {order?.credits} pages ({order && tokenLabel(order.credits)}) have been added to your
                    account.
                  </p>
                  <p className="small">
                    New balance:{" "}
                    <b>
                      {balance !== null
                        ? `${tokenLabel(balance)} (${balance} pages)`
                        : "…"}
                    </b>
                  </p>
                </div>
              ) : paymentStatus === "rejected" ? (
                <div className="status-rejected">
                  <div className="status-icon">❌</div>
                  <h2>Payment Not Verified</h2>
                  <p>
                    We couldn't verify your payment. If you've paid, please
                    contact support with your UTR number.
                  </p>
                </div>
              ) : (
                <div className="status-pending">
                  <div className="status-icon pulse">⏳</div>
                  <h2>Verifying Payment...</h2>
                  <p>
                    Your UTR has been submitted. We're verifying your payment.
                    <br />
                    This usually takes <b>1-5 minutes</b>.
                  </p>
                  <div className="verification-progress">
                    <div className="progress-bar">
                      <div className="progress-fill"></div>
                    </div>
                    <p className="small">
                      Auto-checking every 5 seconds. You can close this page — credits
                      will be added automatically.
                    </p>
                  </div>
                </div>
              )}

              <div className="status-actions">
                <button className="btn dark" onClick={reset}>
                  Buy More Tokens
                </button>
                <a href="/dashboard" className="btn light">
                  Go to Dashboard
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Message toast ── */}
        {msg && (
          <div className={`upi-toast ${msgType}`}>
            <span>{msg}</span>
            <button onClick={() => setMsg("")} className="toast-close">
              ✕
            </button>
          </div>
        )}

        {/* ── Payment History ── */}
        <div className="upi-history-section">
          <button
            className="btn-link"
            onClick={() => (showHistory ? setShowHistory(false) : loadHistory())}
          >
            {showHistory ? "Hide" : "Show"} Payment History
          </button>

          {showHistory && (
            <div className="history-table-wrap">
              {history.length === 0 ? (
                <p className="small">No payments yet.</p>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Pack</th>
                      <th>Amount</th>
                      <th>UTR</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p: any) => (
                      <tr key={p.orderId}>
                        <td>
                          {new Date(p.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>{COPY[p.pack]?.label || p.pack}</td>
                        <td>₹{p.amount / 100}</td>
                        <td className="mono">{p.utr || "—"}</td>
                        <td>
                          <StatusBadge status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <p className="small">
            <b>Secure payment:</b> Your UPI ID is never stored. Only the
            transaction reference (UTR) is recorded for verification.
          </p>
          <p>
            <a href="/refer">Invite a friend and earn a token →</a>
          </p>
        </div>
      </div>
    </div>
  );
}
