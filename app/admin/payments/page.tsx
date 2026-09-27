"use client";
import { useEffect, useState, useCallback } from "react";

interface Payment {
  orderId: string;
  user: string;
  userName?: string;
  userEmail?: string;
  status: string;
  amount: number;
  amountInr: number;
  credits: number;
  pack: string;
  utr?: string;
  paymentId?: string;
  upiId?: string;
  qrProvider?: string;
  approvedBy?: string;
  method: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  totalRevenue: number;
}

const STATUS_TABS = [
  { key: "gateway", label: "Razorpay", icon: "↗" },
  { key: "all", label: "All payments", icon: "▤" },
  { key: "", label: "Pending", icon: "⏳" },
  { key: "approved", label: "Approved", icon: "✅" },
  { key: "rejected", label: "Rejected", icon: "❌" },
  { key: "expired", label: "Expired", icon: "⌛" },
];

export default function AdminPayments() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const loadPayments = useCallback(
    async (tab?: string, p?: number) => {
      setLoading(true);
      try {
        const gateway = (tab ?? activeTab) === "gateway";
        const statusParam =
          !gateway && (tab ?? activeTab) ? `&status=${tab ?? activeTab}` : "";
        const r = await fetch(
          `/api/upi/admin?action=${gateway ? "gateway" : "list"}${statusParam}&page=${p ?? page}&q=${encodeURIComponent(query)}`,
        );
        if (r.status === 403 || r.status === 401) {
          setAuthorized(false);
          return;
        }
        setAuthorized(true);
        const j = await r.json();
        if (j.error) {
          setError(j.error);
          return;
        }
        setPayments(j.payments || []);
        setTotal(j.total || 0);
      } catch (err) {
        setError("Failed to load payments.");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, page, query],
  );

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/upi/admin?action=stats");
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadPayments();
    loadStats();
  }, [loadPayments, loadStats]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadPayments();
      loadStats();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadPayments, loadStats]);

  async function approve(orderId: string) {
    if (
      !window.confirm(
        "Have you matched this UTR, the exact amount, and the receiving account against the actual bank statement? A screenshot alone is insufficient.",
      )
    )
      return;
    setActionBusy(orderId);
    try {
      const r = await fetch("/api/upi/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          orderId,
          bankVerified: true,
        }),
      });
      const j = await r.json();
      if (j.error) {
        setError(j.error);
        return;
      }
      setError("");
      loadPayments();
      loadStats();
    } catch {
      setError("Approval failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function reject(orderId: string) {
    setActionBusy(orderId);
    try {
      const r = await fetch("/api/upi/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          orderId,
          reason: rejectReason || "Payment could not be verified.",
        }),
      });
      const j = await r.json();
      if (j.error) {
        setError(j.error);
        return;
      }
      setError("");
      setRejectingId(null);
      setRejectReason("");
      loadPayments();
      loadStats();
    } catch {
      setError("Rejection failed.");
    } finally {
      setActionBusy(null);
    }
  }

  if (authorized === false) {
    return (
      <div className="admin-page">
        <div
          className="wrap"
          style={{ padding: "80px 24px", textAlign: "center" }}
        >
          <h1>🔒 Access Denied</h1>
          <p>You don't have admin permissions. Contact the site owner.</p>
          <a href="/dashboard" className="btn dark" style={{ marginTop: 16 }}>
            ← Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <p className="small">
          <a href="/dashboard">← Dashboard</a>
        </p>

        <div className="admin-header">
          <h1>💰 Payment Admin</h1>
          <p className="small">
            Manage UPI payments. Auto-refreshes every 15 seconds.
          </p>
        </div>

        {/* ── Stats Cards ── */}
        {stats && (
          <div className="admin-stats-grid">
            <div className="stat-card pending">
              <div className="stat-icon">⏳</div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card approved">
              <div className="stat-icon">✅</div>
              <div className="stat-value">{stats.approved}</div>
              <div className="stat-label">Approved</div>
            </div>
            <div className="stat-card rejected">
              <div className="stat-icon">❌</div>
              <div className="stat-value">{stats.rejected}</div>
              <div className="stat-label">Rejected</div>
            </div>
            <div className="stat-card revenue">
              <div className="stat-icon">💰</div>
              <div className="stat-value">
                ₹{stats.totalRevenue.toLocaleString("en-IN")}
              </div>
              <div className="stat-label">Manual UPI revenue</div>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
            setActiveTab((current) =>
              current === "gateway" ? "gateway" : "all",
            );
          }}
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <label style={{ flex: 1 }}>
            Find a user's payment
            <input
              style={{ width: "100%" }}
              value={search}
              maxLength={120}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email, user ID, order ID or UTR"
            />
          </label>
          <button className="btn dark" type="submit">
            Search
          </button>
          <button
            className="btn light"
            type="button"
            onClick={() => {
              setSearch("");
              setQuery("");
              setPage(1);
            }}
          >
            Clear
          </button>
        </form>
        {/* ── Tab Bar ── */}
        <div className="admin-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`admin-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
                loadPayments(tab.key, 1);
              }}
            >
              {tab.icon} {tab.label}
              {tab.key === "" && stats ? ` (${stats.pending})` : ""}
            </button>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="admin-error">
            {error}
            <button onClick={() => setError("")} className="toast-close">
              ✕
            </button>
          </div>
        )}

        {/* ── Payment Cards ── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div className="admin-spinner"></div>
            <p className="small">Loading payments…</p>
          </div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <p style={{ fontSize: "2rem" }}>🎯</p>
            <p>No payments in this category.</p>
          </div>
        ) : (
          <div className="admin-payments-list">
            {payments.map((p) => (
              <div
                key={p.orderId}
                className={`admin-payment-card status-${p.status}`}
              >
                <div className="payment-card-header">
                  <div className="payment-user">
                    <div className="user-avatar">
                      {(p.userName || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <b>{p.userName || "Unknown"}</b>
                      <br />
                      <span className="small">
                        {p.userEmail || p.user.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  <div className="payment-amount">
                    <span className="amount-value">₹{p.amountInr}</span>
                    <span className="small">{p.credits} pages</span>
                  </div>
                </div>

                <div className="payment-card-body">
                  <div className="payment-detail-row">
                    <span>Order</span>
                    <code style={{ overflowWrap: "anywhere" }}>
                      {p.orderId}
                    </code>
                  </div>
                  <div className="payment-detail-row">
                    <span>User ID</span>
                    <code style={{ overflowWrap: "anywhere" }}>{p.user}</code>
                  </div>
                  <div className="payment-detail-row">
                    <span>UTR / Payment ID</span>
                    <code className="utr-code">
                      {p.utr || p.paymentId || "Not submitted"}
                    </code>
                  </div>
                  <div className="payment-detail-row">
                    <span>Payee UPI</span>
                    <code>{p.upiId || "Gateway"}</code>
                  </div>
                  <div className="payment-detail-row">
                    <span>Method</span>
                    <span>
                      {p.method === "upi_qr"
                        ? `UPI QR · ${p.qrProvider || "legacy"}`
                        : "Auto Gateway"}
                    </span>
                  </div>
                  <div className="payment-detail-row">
                    <span>Time</span>
                    <span>
                      {p.createdAt
                        ? new Date(p.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Not recorded (legacy order)"}
                    </span>
                  </div>
                  {p.rejectionReason && (
                    <div className="payment-detail-row rejection">
                      <span>Reason</span>
                      <span>{p.rejectionReason}</span>
                    </div>
                  )}
                </div>

                {/* ── Actions ── */}
                {(p.status === "utr_submitted" || p.status === "verifying") && (
                  <div className="payment-card-actions">
                    <button
                      className="btn dark approve-btn"
                      disabled={actionBusy === p.orderId}
                      onClick={() => approve(p.orderId)}
                    >
                      {actionBusy === p.orderId ? "…" : "✅ Approve"}
                    </button>

                    {rejectingId === p.orderId ? (
                      <div className="reject-form">
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="reject-input"
                        />
                        <button
                          className="btn reject-confirm"
                          disabled={actionBusy === p.orderId}
                          onClick={() => reject(p.orderId)}
                        >
                          Confirm Reject
                        </button>
                        <button
                          className="btn-link"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn reject-btn"
                        onClick={() => setRejectingId(p.orderId)}
                      >
                        ❌ Reject
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {total > 20 && (
          <div className="admin-pagination">
            <button
              className="btn light"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                loadPayments(undefined, page - 1);
              }}
            >
              ← Prev
            </button>
            <span className="small">
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <button
              className="btn light"
              disabled={page >= Math.ceil(total / 20)}
              onClick={() => {
                setPage((p) => p + 1);
                loadPayments(undefined, page + 1);
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
