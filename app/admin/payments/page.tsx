"use client";
import { useEffect, useState, useCallback } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

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
  { key: "gateway", label: "Razorpay" },
  { key: "all", label: "All payments" },
  { key: "", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "expired", label: "Expired" },
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
  const [updatedAt, setUpdatedAt] = useState("");
  const [canInspectUsers, setCanInspectUsers] = useState(false);

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
        setError("");
        setPayments(j.payments || []);
        setTotal(j.total || 0);
        setUpdatedAt(new Date().toISOString());
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
    fetch("/api/admin/access", { cache: "no-store" })
      .then((response) => response.json())
      .then((access) => setCanInspectUsers(access.scopes?.users === true))
      .catch(() => setCanInspectUsers(false));
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
      <main className="wrap feature-section admin-content">
        <section className="admin-panel admin-access-denied">
          <p className="eyebrow">PAYMENTS OPERATIONS</p>
          <h1>Payment access is restricted.</h1>
          <p>
            This account does not have a verified payment-administrator scope.
            Ask a site administrator to review your role if you should have
            access.
          </p>
          <a href="/admin" className="btn dark">
            Return to control room
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="wrap feature-section admin-content admin-page admin-payments">
      <AdminPageHeader
        eyebrow="PAYMENTS OPERATIONS"
        title="Payments and wallet orders."
        description="Review Razorpay orders and manually submitted UPI payments. Every approval still requires a bank-statement match."
        actions={
          <button
            className="btn light"
            type="button"
            disabled={loading}
            onClick={() => {
              void loadPayments();
              void loadStats();
            }}
          >
            {loading ? "Refreshing…" : "Refresh payments"}
          </button>
        }
      />
      {updatedAt && (
        <p className="admin-page-note" role="status">
          Refreshed {new Date(updatedAt).toLocaleTimeString()} · automatic
          refresh every 15 seconds
        </p>
      )}

      {/* ── Stats Cards ── */}
      {stats && (
        <div className="admin-stat-grid admin-payment-stats">
          <div className="admin-panel">
            <span>Pending</span>
            <strong>{stats.pending.toLocaleString("en-IN")}</strong>
            <small>Awaiting review</small>
          </div>
          <div className="admin-panel">
            <span>Approved</span>
            <strong>{stats.approved.toLocaleString("en-IN")}</strong>
            <small>Recorded payments</small>
          </div>
          <div className="admin-panel">
            <span>Rejected</span>
            <strong>{stats.rejected.toLocaleString("en-IN")}</strong>
            <small>Declined submissions</small>
          </div>
          <div className="admin-panel">
            <span>Manual UPI revenue</span>
            <strong>₹{stats.totalRevenue.toLocaleString("en-IN")}</strong>
            <small>Captured UPI payments</small>
          </div>
        </div>
      )}

      <form
        className="admin-panel admin-payment-search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
          setActiveTab((current) =>
            current === "gateway" ? "gateway" : "all",
          );
        }}
      >
        <label className="admin-payment-search-field">
          Find a user's payment
          <input
            className="admin-payment-search-input"
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
            {tab.label}
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
        <div className="admin-panel admin-payment-empty" aria-busy="true">
          <div className="admin-spinner"></div>
          <p role="status">Loading payment records…</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="admin-panel admin-payment-empty">
          <span className="admin-empty-icon" aria-hidden="true">
            ₹
          </span>
          <h2>No payments in this view</h2>
          <p>Try a different status or clear the account search.</p>
        </div>
      ) : (
        <div className="admin-payments-list">
          {payments.map((p) => (
            <div
              key={p.orderId}
              className={`admin-panel admin-payment-card status-${p.status}`}
            >
              <div className="payment-card-header">
                <div className="payment-user">
                  <div className="user-avatar" aria-hidden="true">
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
                  <code style={{ overflowWrap: "anywhere" }}>{p.orderId}</code>
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
                {canInspectUsers && (
                  <div className="payment-detail-row admin-payment-inspect">
                    <span>Account actions</span>
                    <a
                      href={`/admin/users?q=${encodeURIComponent(p.userEmail || p.user)}`}
                    >
                      Inspect account
                    </a>
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
    </main>
  );
}
