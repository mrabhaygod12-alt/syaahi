import ReferralWallet from "@/components/ReferralWallet";
export default function Refer() {
  return (
    <main
      className="wrap"
      style={{ maxWidth: 960, paddingTop: 60, paddingBottom: 80 }}
    >
      <p className="eyebrow">LEARN BETTER TOGETHER</p>
      <h1>Give a friend a fresh start.</h1>
      <p>
        New accounts receive 19 free study credits. Every eligible friend who
        verifies their signup earns you 5 reward credits. Transfer rewards into
        your study balance whenever you choose.
      </p>
      <div className="referral-journey">
        {[
          [
            "1",
            "Share your link",
            "Send your personal invitation to a friend.",
          ],
          [
            "2",
            "They verify their account",
            "Your friend receives 19 welcome credits. Eligible verified signups earn you 5 reward credits.",
          ],
          [
            "3",
            "Move rewards into your balance",
            "Transfer credits when you want to create more notes. No cash withdrawal.",
          ],
        ].map(([n, t, p]) => (
          <article key={n}>
            <span>{n}</span>
            <h2>{t}</h2>
            <p>{p}</p>
          </article>
        ))}
      </div>
      <ReferralWallet />
      <section style={{ marginTop: 32 }}>
        <h2>Clear conditions</h2>
        <ul>
          <li>
            Apply one code within 24 hours of signup, before the first purchase.
          </li>
          <li>
            Google identity or an email verification link must confirm the
            referred account.
          </li>
          <li>
            Each referred account qualifies once. No self-referrals, duplicate
            accounts or cash withdrawals.
          </li>
          <li>
            Up to 20 rewards per inviter per calendar month. A qualification
            over the cap earns no reward then; it can be retried in a later
            month.
          </li>
          <li>
            Previously awarded purchase-based rewards remain unchanged and
            cannot earn a second signup reward.
          </li>
        </ul>
        <a href="/terms">Read the terms →</a>
      </section>
    </main>
  );
}
