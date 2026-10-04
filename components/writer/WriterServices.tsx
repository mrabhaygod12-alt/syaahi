"use client";
import WriterShell from "./WriterShell";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { MONTHLY_PLANS } from "@/lib/billing/subscription-plans";
import SubscriptionBilling from "../SubscriptionBilling";
import SubscriptionCheckout from "../SubscriptionCheckout";
import PaymentStatus from "../payments/PaymentStatus";
import SupportDesk from "../SupportDesk";
import type { MonthlyTier } from "@/lib/billing/subscription-plans";
function Membership() {
  const [balance, setBalance] = useState<number | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    requestJson("/api/credits")
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error);
        setBalance(data.balance);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="writer-service-page">
      <div className="membership-hero">
        <p className="writer-kicker">SYAAHI MEMBERSHIP</p>
        <h1>
          Space for your ideas.
          <br />
          <em>A plan that grows with you.</em>
        </h1>
        <p>
          Your writer tools are included on Free. Monthly plans add generation
          credits to the same account you already use.
        </p>
        <a className="btn light" href="/writer/billing">
          Manage your membership ↗
        </a>
        <span className="membership-balance">
          {balance === null
            ? "Loading wallet…"
            : `${balance} credits in your wallet`}
        </span>
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="writer-plan-grid">
        <article className="writer-plan">
          <p className="writer-kicker">THE ESSENTIALS</p>
          <h2>Free</h2>
          <p className="writer-plan-price">₹0</p>
          <p>Give your story a home.</p>
          <ul>
            <li>Rich editor and article design</li>
            <li>Private drafts, images and revisions</li>
            <li>Public profile and saved reading</li>
            <li>Editorial submission and story stats</li>
          </ul>
          <a className="btn light" href="/write">
            Start a story
          </a>
        </article>
        {Object.entries(MONTHLY_PLANS).map(([id, plan]) => (
          <article
            key={id}
            className={`writer-plan ${id === "pro" ? "featured" : ""}`}
          >
            <p className="writer-kicker">
              {id === "pro" ? "FOR REGULAR CREATORS" : "MONTHLY CREDIT BUDGET"}
            </p>
            <h2>{plan.label}</h2>
            <p className="writer-plan-price">
              ₹{plan.inr}
              <small>/ month</small>
            </p>
            <p>{plan.credits} credits each paid month.</p>
            <ul>
              <li>Every Free writer feature</li>
              <li>One wallet across your account</li>
              <li>
                Up to {plan.maxSlides} slides per deck in the learning workspace
              </li>
              <li>Unused credits stay in your wallet</li>
            </ul>
            <a className="btn dark" href={`/writer/subscribe/${id}`}>
              Choose {plan.label} ↗
            </a>
          </article>
        ))}
        <article className="writer-plan">
          <p className="writer-kicker">LET'S BUILD TOGETHER</p>
          <h2>Team</h2>
          <p className="writer-plan-price">Let’s talk</p>
          <p>Discuss your group's requirements with our team.</p>
          <ul>
            <li>Agree on seats, billing and support before rollout</li>
            <li>Discuss publishing and workspace requirements</li>
            <li>Requires a quote; no automatic purchase</li>
          </ul>
          <a className="btn light" href="/writer/support">
            Ask about Team ↗
          </a>
        </article>
      </div>
      <section className="writer-membership-faq">
        <h2>A few things to know.</h2>
        <details>
          <summary>Do I need a paid plan to publish?</summary>
          <p>
            No. Private drafting and editorial submission are included on Free.
            A subscription does not guarantee publication or an audience.
          </p>
        </details>
        <details>
          <summary>Are my student and writer plans separate charges?</summary>
          <p>
            No. Both experiences use one identity, one subscription and one
            credit wallet. Writer enrollment does not grant another welcome
            allowance.
          </p>
        </details>
        <details>
          <summary>When are credits added, and how do I cancel?</summary>
          <p>
            Credits arrive after a captured monthly invoice. Authorising a
            mandate alone adds no credits. Cancel future renewals in{" "}
            <a href="/writer/billing">writer Billing</a>; your existing wallet
            remains.
          </p>
        </details>
        <p>
          Plans renew monthly in INR until cancelled, for up to 120 billing
          cycles. <a href="/refunds">Refund policy</a> ·{" "}
          <a href="/terms">Terms</a>
        </p>
      </section>
    </section>
  );
}
export default function WriterServices({
  view,
  tier,
  orderId,
}: {
  view: "membership" | "billing" | "support" | "subscribe" | "payments";
  tier?: MonthlyTier;
  orderId?: string;
}) {
  return (
    <WriterShell>
      {view === "membership" ? (
        <Membership />
      ) : view === "billing" ? (
        <div className="writer-service-page">
          <SubscriptionBilling workspace="writer" />
        </div>
      ) : view === "support" ? (
        <section className="writer-service-page">
          <div className="writer-service-heading">
            <p className="writer-kicker">WE'RE HERE FOR YOUR WORDS</p>
            <h1>Writer help & support</h1>
            <p>Get help with drafts, publishing, your profile or membership.</p>
          </div>
          <div className="writer-help-topics">
            {[
              [
                "Drafts & editor",
                "Autosave, revisions, tables and article design.",
              ],
              ["Publishing", "Editorial review and changes requested."],
              [
                "Account & billing",
                "Profile access and your shared membership.",
              ],
            ].map(([a, b]) => (
              <div key={a}>
                <h3>{a}</h3>
                <p>{b}</p>
              </div>
            ))}
          </div>
          <SupportDesk workspace="writer" />
        </section>
      ) : view === "subscribe" && tier ? (
        <div className="writer-service-page">
          <SubscriptionCheckout tier={tier} workspace="writer" />
        </div>
      ) : (
        <div className="writer-service-page">
          <PaymentStatus workspace="writer" orderId={orderId} />
        </div>
      )}
    </WriterShell>
  );
}
