import ProductPage from "@/components/ProductPage";
import { pageMeta, SITE } from "@/lib/seo";
import { MONTHLY_PLANS } from "@/lib/billing/subscription-plans";
export const metadata = pageMeta({
  title: "Writer plans: Free or Max ₹399 per month",
  path: "/writing/pricing",
  description:
    "Syaahi has two writer plans: Free for drafting and reviewed publishing, or Max ₹399/month with 360 generation credits. One wallet across student and writer workspaces.",
});
export default function Page() {
  const max = MONTHLY_PLANS.max;
  return (
    <ProductPage
      title="Two writer plans. Room for every story."
      kicker="WRITER MEMBERSHIP"
      path="/writing/pricing"
      lede="Core writing tools are included on Free. Choose a monthly credit budget when you need more generation."
      schema={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        url: `${SITE.url}/writing/pricing`,
        name: "Syaahi writer pricing",
        about: { "@id": `${SITE.url}/writing/features#software` },
      }}
    >
      <div className="product-feature-grid writer-public-plans">
        <article className="card">
          <h2>Free</h2>
          <p className="plan-price">₹0</p>
          <p>
            Rich article editor, private drafts and revisions, public writer
            profile, editorial submission and story statistics.
          </p>
          <a className="btn light" href="/signup?workspace=writer">
            Start writing free
          </a>
        </article>
        <article className="card">
          <h2>{max.label}</h2>
          <p className="plan-price">
            ₹{max.inr}
            <small>/month</small>
          </p>
          <p>
            {max.credits} credits after each captured monthly payment. Includes
            every Free writer feature and a shared generation wallet. Up to{" "}
            {max.maxSlides} slides per deck in the learning workspace.
          </p>
          <a className="btn dark" href="/writer/subscribe/max">
            Choose Max
          </a>
        </article>
      </div>
      <section className="product-answer">
        <h2>What am I paying for?</h2>
        <p>
          A paid membership adds credits. Drafting, submission and approved
          public stories remain available on Free. Publication is subject to
          review; paying does not buy approval, distribution or earnings.
        </p>
        <h2>How does renewal work?</h2>
        <p>
          Max renews monthly in INR until cancellation, for up to 120 cycles.
          Authorising a mandate does not add credits: a captured invoice payment
          does. Cancel future renewals in writer Billing. Existing wallet
          credits remain.
        </p>
        <h2>Are student and writer purchases separate?</h2>
        <p>
          No. There is one subscription and one wallet per account. If you
          already have a subscription, manage or cancel it before starting
          another. Existing paid terms are preserved when an offer is retired
          from new sales.
        </p>
        <div className="product-link-row">
          <a href="/writer/billing">Writer Billing</a>
          <a href="/pricing">Student pricing</a>
          <a href="/refunds">Refund policy</a>
          <a href="/terms">Terms</a>
        </div>
      </section>
    </ProductPage>
  );
}
