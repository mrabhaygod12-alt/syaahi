"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Summary = {
  code: string;
  invited: number;
  rewarded: number;
  thisMonth: number;
  claimed: boolean;
  rewardBalance: number;
  rewardEarned: number;
  emailVerified: boolean;
};
export default function ReferralWallet({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [data, setData] = useState<Summary | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);
  const transfer = useRef<{ credits: number; requestId: string } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/referrals");
    if (r.status === 401) {
      setGuest(true);
      setLoading(false);
      return;
    }
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load().catch(() => {
      setLoading(false);
      setMessage("Could not load referral wallet. Please retry.");
    });
  }, [load]);
  async function action(url: string, body: object, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(success);
      await load();
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <section className="card" aria-busy="true">
        <h2>Your referral wallet</h2>
        <p role="status">Loading your invitation and rewards…</p>
      </section>
    );
  if (!data)
    return (
      <section className="card">
        <h2>Invite & earn</h2>
        <p>Earn 5 reward credits for each eligible verified signup.</p>
        {message && <p role="status">{message}</p>}
        {guest ? (
          <a className="btn dark" href="/login?next=/refer">
            Sign in to open your referral wallet
          </a>
        ) : (
          <button
            className="btn light"
            onClick={() => {
              setLoading(true);
              void load().catch(() => {
                setLoading(false);
                setMessage("Please try again later.");
              });
            }}
          >
            Retry wallet
          </button>
        )}
      </section>
    );
  return (
    <section className="card referral-wallet" style={{ marginTop: 24 }}>
      <h2>
        {compact ? "Your referral wallet" : "Invite friends. Keep learning."}
      </h2>
      <div className="referral-metrics">
        <div>
          <strong>{data.invited}</strong>
          <span>Friends joined</span>
        </div>
        <div>
          <strong>{data.rewardBalance}</strong>
          <span>Reward credits available</span>
        </div>
        <div>
          <strong>{data.rewardEarned}</strong>
          <span>Credits earned in this programme</span>
        </div>
      </div>
      <p>5 credits per verified signup · 3 credits = 1 study token</p>
      <button
        className="btn dark"
        disabled={busy || data.rewardBalance < 1}
        onClick={async () => {
          if (!transfer.current)
            transfer.current = {
              credits: data.rewardBalance,
              requestId: crypto.randomUUID(),
            };
          if (
            await action(
              "/api/referrals",
              { action: "transfer", ...transfer.current },
              "Reward credits added to your study balance.",
            )
          ) {
            transfer.current = null;
            if (compact) location.reload();
          }
        }}
      >
        {busy
          ? "Please wait…"
          : `Add ${transfer.current?.credits || data.rewardBalance} credits to study balance`}
      </button>
      <p className="small">
        One reward credit becomes one study credit. Fractional tokens stay
        usable as whole note sections. No cash withdrawal.
      </p>
      {message && <p role="status">{message}</p>}
      {!data.emailVerified && (
        <div style={{ marginTop: 20 }}>
          <p>Verify your email to qualify your signup for referral rewards.</p>
          <button
            className="btn light"
            disabled={busy}
            onClick={() =>
              void action(
                "/api/auth/verify-email",
                {},
                "Verification email sent. Check your inbox and spam folder.",
              )
            }
          >
            Send verification email
          </button>
        </div>
      )}
      {compact ? (
        <p>
          <a href="/refer">Share your invitation and view details →</a>
        </p>
      ) : (
        <>
          <label>
            Your invitation link
            <input
              readOnly
              value={
                typeof location === "undefined"
                  ? data.code
                  : `${location.origin}/signup?ref=${data.code}`
              }
            />
          </label>
          <button
            className="btn light"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${location.origin}/signup?ref=${data.code}`,
                );
                setMessage("Invitation copied.");
              } catch {
                setMessage("Copy the invitation from the field above.");
              }
            }}
          >
            Copy invitation
          </button>
          <button
            className="btn light"
            onClick={async () => {
              const url = `${location.origin}/signup?ref=${data.code}`;
              try {
                if (navigator.share)
                  await navigator.share({
                    title: "Study with me on Syaahi",
                    text: "Create your first lesson with 21 welcome credits.",
                    url,
                  });
                else {
                  await navigator.clipboard.writeText(url);
                  setMessage("Invitation copied.");
                }
              } catch {
                setMessage(
                  "Sharing cancelled or unavailable. You can copy the link instead.",
                );
              }
            }}
          >
            Share invitation
          </button>
          <p>
            {data.rewarded} qualified ·{" "}
            {Math.max(0, data.invited - data.rewarded)} awaiting qualification
          </p>
          <label>
            Monthly reward allowance
            <progress
              max={20}
              value={data.thisMonth}
              style={{ width: "100%" }}
            />
          </label>
          <p>
            {Math.max(0, 20 - data.thisMonth)} of 20 rewards remaining this
            month
          </p>
          {data.claimed && data.emailVerified && (
            <button
              className="btn light"
              disabled={busy}
              onClick={() =>
                void action(
                  "/api/referrals",
                  { action: "recheck" },
                  "Eligibility checked. Existing rewards are never duplicated; monthly limits still apply.",
                )
              }
            >
              Recheck my invitation eligibility
            </button>
          )}
          {!data.claimed && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(
                  "/api/referrals",
                  { code },
                  "Invitation applied. Verification qualifies eligible new accounts.",
                );
              }}
            >
              <label>
                Received a code?
                <input
                  value={code}
                  maxLength={30}
                  required
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className="btn light" disabled={busy}>
                Apply code
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
