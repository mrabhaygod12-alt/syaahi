"use client";
import { useEffect, useState } from "react";
export default function Refer() {
  const [data, setData] = useState<{
      code: string;
      invited: number;
      rewarded: number;
      claimed: boolean;
      thisMonth: number;
    } | null>(null),
    [message, setMessage] = useState(""),
    [code, setCode] = useState("");
  useEffect(() => {
    fetch("/api/referrals")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <main
      className="wrap"
      style={{ maxWidth: 900, paddingTop: 60, paddingBottom: 80 }}
    >
      <p className="eyebrow">LEARN BETTER TOGETHER</p>
      <h1>
        A useful introduction.
        <br />A little more room to learn.
      </h1>
      <p>
        When a new learner uses your code and completes their first verified
        purchase, you each receive 1 token for 3 note sections.
      </p>
      {message && <p role="status">{message}</p>}
      {!data ? (
        <a className="btn dark" href="/login?next=/refer">
          Sign in to see your referral link
        </a>
      ) : (
        <div className="card">
          <h2>Your learning circle</h2>
          <div className="referral-metrics">
            <div>
              <strong>{data.invited}</strong>
              <span>Friends joined</span>
            </div>
            <div>
              <strong>{Math.max(0, data.invited - data.rewarded)}</strong>
              <span>Awaiting qualification</span>
            </div>
            <div>
              <strong>{data.rewarded}</strong>
              <span>Tokens earned</span>
            </div>
          </div>
          <label>
            Monthly reward allowance
            <progress
              max={20}
              value={data.thisMonth || 0}
              style={{ width: "100%" }}
            />
            {Math.max(0, 20 - (data.thisMonth || 0))} of 20 rewards remaining
            this month
          </label>
          <p>
            {data.invited} joined · {data.rewarded} rewards earned
          </p>
          <label>
            Your referral code
            <input readOnly value={data.code} />
          </label>
          <button
            className="btn dark"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${location.origin}/signup?ref=${data.code}`,
                );
                setMessage("Referral link copied.");
              } catch {
                setMessage(
                  "Copy the code above and share it with your friend.",
                );
              }
            }}
          >
            Copy invitation link
          </button>
          <button
            className="btn light"
            style={{ marginLeft: 8 }}
            onClick={async () => {
              try {
                const url = `${location.origin}/signup?ref=${data.code}`;
                if (navigator.share)
                  await navigator.share({
                    title: "Study with me on Syaahi",
                    text: "Create visual notes and practise together.",
                    url,
                  });
                else {
                  await navigator.clipboard.writeText(url);
                  setMessage("Invitation link copied.");
                }
              } catch {
                setMessage(
                  "Sharing closed. Your referral code is still available.",
                );
              }
            }}
          >
            Share invitation
          </button>
          {!data.claimed && (
            <form
              style={{ marginTop: 30 }}
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await fetch("/api/referrals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code }),
                });
                const d = await r.json();
                setMessage(
                  r.ok
                    ? "Referral applied. Your first verified purchase will qualify."
                    : d.error,
                );
                if (r.ok) setData({ ...data, claimed: true });
              }}
            >
              <label>
                Received a code?
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={30}
                  required
                />
              </label>
              <button className="btn light">Apply code</button>
            </form>
          )}
        </div>
      )}
      <section style={{ marginTop: 32 }}>
        <h2>Simple, clear conditions</h2>
        <ul>
          <li>
            Apply one code within 24 hours of signup, before your first
            purchase.
          </li>
          <li>Rewards follow verified payment capture, not signup alone.</li>
          <li>No self-referrals, duplicate accounts, or cash withdrawals.</li>
          <li>
            Each inviter can earn up to 20 rewards per calendar month. Purchases
            after that limit do not qualify that month.
          </li>
          <li>
            Rewards are promotional; refunded or fraudulent purchases may have
            rewards reversed after review.
          </li>
        </ul>
        <a href="/terms">Read the service terms →</a>
      </section>
    </main>
  );
}
