import ProductPage from "@/components/ProductPage";
import { pageMeta, SITE } from "@/lib/seo";
import { productFacts } from "@/lib/product-facts";
export const metadata = pageMeta({
  title: "What is Syaahi? Official learning, presentation and writing platform",
  path: "/syaahi",
  description:
    "Syaahi at syaahii.in is a learning, AI presentation and blog publishing platform by Chandan Pandey and Manish Kumar Singh. Explore both workspaces and current plans.",
});
export default function Page() {
  const facts = productFacts();
  return (
    <ProductPage
      title="Syaahi: learn, present and publish."
      kicker="OFFICIAL PRODUCT GUIDE · SYAAHII.IN"
      path="/syaahi"
      lede={facts.description}
      schema={{
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "@id": `${SITE.url}/syaahi#page`,
        url: `${SITE.url}/syaahi`,
        name: "About Syaahi at syaahii.in",
        about: { "@id": `${SITE.url}/#application` },
      }}
    >
      <section className="product-answer">
        <h2>What is Syaahi?</h2>
        <p>
          Syaahi is the web application at <a href={SITE.url}>syaahii.in</a>,
          created by Chandan Pandey with Manish Kumar Singh. It has a learning
          workspace and a separate writer workspace in one account.
          Handwritten-style notes are one part of the product: it also offers
          source-based presentations and reviewed blog publishing.
        </p>
        <a href="/about">Meet the creators and read the product philosophy →</a>
      </section>
      <section
        className="product-feature-grid"
        aria-label="Syaahi product areas"
      >
        {facts.workspaces.map((w) => (
          <article className="card" key={w.name}>
            <h2>{w.name}</h2>
            <ul>
              {w.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a href={w.url}>Explore {w.name} →</a>
          </article>
        ))}
      </section>
      <section className="product-answer">
        <h2>One identity, two workspaces.</h2>
        <p>
          Students can explicitly enroll as writers with the same email and
          password. Writer profiles and navigation stay separate. Credits and
          the subscription stay in the same account; switching workspaces does
          not grant more welcome credits.
        </p>
        <p>
          The official product links are listed here so readers can identify the
          correct website by its domain, creators and capabilities.
        </p>
      </section>
      <section className="product-answer">
        <h2>Current plans and limits.</h2>
        <p>
          Student credit packs cost ₹9, ₹39 or ₹79 once. Max is ₹399 monthly.
          Writer plans are Free and Max at ₹399 per month. Free accounts receive{" "}
          {facts.pricing.welcomeCredits} welcome credits after email
          verification. A generated note section uses one credit and a
          presentation uses five.
        </p>
        <p>
          Credits arrive after captured payment, and unused credits stay in the
          wallet. Read the plan’s renewal terms before purchasing.
        </p>
        <div className="product-link-row">
          <a href="/pricing">Student pricing</a>
          <a href="/writing/pricing">Writer pricing</a>
          <a href="/how-it-works">How it works</a>
        </div>
      </section>
      <section className="product-answer">
        <h2>What should I verify?</h2>
        <ul>
          {facts.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p>
          Product facts reviewed on{" "}
          <time dateTime="2026-10-05">5 October 2026</time>.{" "}
          <a href="/product-facts.json">Public product facts</a> ·{" "}
          <a href="/privacy">Privacy</a> · <a href="/support">Support</a>
        </p>
      </section>
    </ProductPage>
  );
}
