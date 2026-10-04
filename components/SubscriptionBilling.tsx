"use client";
import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
export default function SubscriptionBilling({
  workspace = "student",
}: {
  workspace?: "student" | "writer";
}) {
  const plans = workspace === "writer" ? "/writer/membership" : "/pricing",
    billing = workspace === "writer" ? "/writer/billing" : "/account/billing",
    receipts = workspace === "writer" ? "/writer/payments" : "/payments",
    support = workspace === "writer" ? "/writer/support" : "/support";
  const [data, setData] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async (refresh = false) => {
    setBusy(true);
    try {
      const result = await requestJson(
        `/api/billing/subscription${refresh ? "?refresh=1" : ""}`,
      );
      if (!result.response.ok) throw new Error(result.data.error);
      setData(result.data);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Billing unavailable.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function cancel() {
    if (
      !window.confirm(
        "Stop future renewals? Your current paid period and existing credits remain available.",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await requestJson("/api/billing/subscription", {
        method: "DELETE",
      });
      if (!result.response.ok) throw new Error(result.data.error);
      setData((old: any) => ({
        ...old,
        subscription: result.data.subscription,
      }));
      setMessage("Cancellation recorded. Your billing status is shown below.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Cancellation unavailable. Contact support.",
      );
    } finally {
      setBusy(false);
    }
  }
  const subscription = data?.subscription;
  async function prepareCheckout() {
    setBusy(true);
    setMessage("Checking secure monthly checkout…");
    try {
      const result = await requestJson(
        "/api/billing/catalog",
        { method: "POST" },
        60000,
      );
      if (!result.response.ok) throw new Error(result.data.error);
      await load();
      setMessage(
        "Monthly checkout is ready. No subscription or payment was started.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not prepare checkout.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container narrow">
      <h1>Billing</h1>
      {!data && (
        <p role="status">
          {busy ? "Loading billing…" : "Billing could not load."}
        </p>
      )}
      {data && !data.authenticated ? (
        <a
          className="btn dark"
          href={`/login?workspace=${workspace}&next=${encodeURIComponent(billing)}`}
        >
          Log in to view billing
        </a>
      ) : (
        data && (
          <section className="card">
            <h2>
              {subscription
                ? `${subscription.tier} monthly plan`
                : "No monthly subscription"}
            </h2>
            {subscription ? (
              <>
                <p>
                  Status: <strong>{subscription.status}</strong>
                  {subscription.cancelScheduled && " · Renewal cancelled"}
                </p>
                <p>
                  ₹{subscription.amount / 100}/month · {subscription.credits}{" "}
                  credits per paid month · {subscription.mode} mode
                </p>
                {subscription.currentEnd > 0 && (
                  <p>
                    Paid through{" "}
                    {new Date(
                      subscription.currentEnd * 1000,
                    ).toLocaleDateString()}
                  </p>
                )}
                <p>Subscription ID: {subscription.id}</p>
                {!subscription.cancelScheduled &&
                  !["cancelled", "completed", "expired"].includes(
                    subscription.status,
                  ) && (
                    <button
                      className="btn light"
                      disabled={busy}
                      onClick={() => void cancel()}
                    >
                      Cancel renewal
                    </button>
                  )}
              </>
            ) : (
              <a className="btn dark" href={plans}>
                Compare plans
              </a>
            )}
            <p>
              <button
                className="btn light"
                disabled={busy}
                onClick={() => void prepareCheckout()}
              >
                Check payment setup
              </button>{" "}
              <button
                className="btn light"
                disabled={busy}
                onClick={() => void load(true)}
              >
                Refresh provider status
              </button>
            </p>
            <p>
              Credits are added after captured invoice payments. If a charge
              appears without credits, use Refresh to reconcile it before paying
              again.
            </p>
          </section>
        )
      )}
      {message && <p role="status">{message}</p>}
      <nav className="hero-actions">
        <a href={receipts}>Payment receipts</a>
        <a href="/refunds">Refund policy</a>
        <a href={support}>Billing support</a>
      </nav>
    </div>
  );
}
