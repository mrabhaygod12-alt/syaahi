"use client";
import { useEffect, useState } from "react";
import { MONTHLY_PLANS } from "@/lib/billing/subscription-plans";
import { requestJson } from "@/lib/http-client";
export default function PricingClient() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    requestJson("/api/credits")
      .then(({ response, data }) => {
        if (alive && response.ok) setBalance(data.balance);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="container pricing-page">
      <p className="eyebrow">Plans for learning, teaching and writing</p>
      <h1>Choose your monthly generation budget.</h1>
      <p>
        Use credits for notes and presentations. Write private drafts and submit
        articles for editorial review with any plan.
      </p>
      {balance !== null && (
        <p>
          Your balance: <strong>{balance} credits</strong>.{" "}
          <a href="/account/billing">Manage billing</a>
        </p>
      )}
      <div className="monthly-plans">
        <article className="card">
          <h2>Free</h2>
          <p className="plan-price">₹0</p>
          <strong>19 credits after email verification</strong>
          <p>Start with notes, recall practice, and writing.</p>
          <ul>
            <li>All core study tools</li>
            <li>Up to 6 slides per presentation</li>
            <li>Private drafts and article submission</li>
          </ul>
          <a className="btn light" href="/signup">
            Start free
          </a>
        </article>
        {Object.entries(MONTHLY_PLANS).map(([id, plan]) => (
          <article className="card" key={id}>
            <h2>{plan.label}</h2>
            <p className="plan-price">
              ₹{plan.inr}
              <small>/month</small>
            </p>
            <strong>{plan.credits} credits each paid month</strong>
            <p>
              {id === "starter"
                ? "For occasional notes and presentations."
                : id === "pro"
                  ? "For regular learning, teaching and presentations."
                  : "For a larger monthly generation workload."}
            </p>
            <ul>
              <li>All core study tools</li>
              <li>Up to {plan.maxSlides} slides per presentation</li>
              <li>No watermark on exported PPTX</li>
            </ul>
            <a className="btn dark" href={`/subscribe/${id}`}>
              Choose {plan.label}
            </a>
          </article>
        ))}
        <article className="card">
          <h2>Team</h2>
          <p className="plan-price">Let’s talk</p>
          <p>For an institution, teaching team or professional group.</p>
          <ul>
            <li>Discuss seats and workspace requirements</li>
            <li>Agree on billing and support before rollout</li>
            <li>No automatic purchase</li>
          </ul>
          <a className="btn light" href="/enterprise">
            Contact sales
          </a>
        </article>
      </div>
      <section className="card">
        <h2>What every plan includes</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free / Starter / Pro / Max</th>
                <th>Credit use</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Handwritten-style notes, PDF templates, source appendix</td>
                <td>Included</td>
                <td>1 credit per generated note section</td>
              </tr>
              <tr>
                <td>Editable PPTX presentations</td>
                <td>Included, slide limit varies by plan</td>
                <td>5 credits per completed deck</td>
              </tr>
              <tr>
                <td>Lesson flashcards, quizzes, source view and progress</td>
                <td>Included for your lessons</td>
                <td>No additional deck charge</td>
              </tr>
              <tr>
                <td>Writer Studio, images, version history, profile</td>
                <td>Included</td>
                <td>No study credits required</td>
              </tr>
              <tr>
                <td>Publication</td>
                <td>Editorial review required</td>
                <td>No guaranteed acceptance</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small">
          Monthly plans renew in INR until cancelled, for up to 120 billing
          cycles. Unused credits remain in your wallet; cancellation stops
          future renewals. There is no unlimited generation allowance.
          Previously purchased credits and receipts stay available.
        </p>
      </section>
      <section className="pricing-faq">
        <h2>Billing questions</h2>
        <details>
          <summary>When do monthly credits arrive?</summary>
          <p>
            After Razorpay confirms a captured payment for your monthly invoice.
            Authorising a mandate alone does not add credits.
          </p>
        </details>
        <details>
          <summary>How do I cancel?</summary>
          <p>
            Open Billing and choose Cancel renewal. An active subscription
            cancels at the end of its current cycle. Your existing credits
            remain.
          </p>
        </details>
        <details>
          <summary>What happens if generation fails?</summary>
          <p>
            Unused note credits are returned under the generation rules. A
            failed presentation returns its 5-credit charge; retrying reserves
            it again.
          </p>
        </details>
        <details>
          <summary>Can I pay in another currency?</summary>
          <p>
            These monthly plans currently bill in INR. International
            availability depends on your payment method and Razorpay account
            approval.
          </p>
        </details>
        <p>
          <a href="/refunds">Refund policy</a> · <a href="/terms">Terms</a> ·{" "}
          <a href="/payments">Past payment receipts</a>
        </p>
      </section>
    </div>
  );
}
