import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "How Study Credits & Billing Work",
  description:
    "Understand Syaahi credits, generated sections, payment confirmation and credit returns when generation does not finish.",
  path: "/docs/credits-billing",
});
import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Monthly study plans and PPTX",
    "Free includes 19 credits after email verification. Student packs are one-time: ₹9 for 3 credits, ₹39 for 15, ₹79 for 36. Max is ₹399/month for 360 credits per captured invoice. Only Max is offered as a new recurring plan; historical subscription terms remain unchanged. Unused credits remain in the wallet. Manage or cancel renewals at /account/billing. Presentation generation costs 5 credits per completed deck; failed jobs return the charge and retries reserve it again. Previously purchased credits and receipts are retained.",
  ],
  [
    "Welcome credits",
    "A new account receives 19 free credits (6⅓ tokens / 19 note sections). One token covers 3 sections; one section consumes ⅓ token; longer sections may print on multiple sheets. Planning and PDF re-downloads do not subtract credits.",
  ],
  [
    "Reservations and refunds",
    "The full outline cost is reserved when generation starts. Each saved section consumes one reservation. If generation stops, unused reservations return automatically to the wallet. Completed sections remain available.",
  ],
  [
    "Buying credits",
    "Checkout uses Razorpay only when the installation has valid payment configuration. If checkout is unavailable, the app reports that directly. An order alone does not grant credits: the payment must be captured and verified.",
  ],
  [
    "Payment verification",
    "The server owns pack prices and validates payment signatures, order identity, captured status, amount, and currency. Repeated webhook or verification requests do not grant credits twice.",
  ],
  [
    "Money refunds",
    "Returning generation credits is separate from refunding a payment. Contact the operator through Support with the payment ID and reason. Payment refunds require operator review; this installation does not issue automatic bank refunds.",
  ],
];
export default function Guide() {
  return (
    <>
      <PageHero
        kicker="Syaahi documentation"
        title="Understand your credits"
        lede="Practical guidance for the current application."
      />
      <Prose>
        <a href="/docs">← All guides</a>
        {sections.map(([title, body]) => (
          <section key={title}>
            <H>{title}</H>
            <p>{body}</p>
          </section>
        ))}
        <p className="small">Updated 3 October 2026</p>
      </Prose>
    </>
  );
}
