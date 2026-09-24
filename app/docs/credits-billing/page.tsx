import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Welcome credits",
    "A new account receives 21 free credits (7 tokens / 21 note sections). One token covers 3 sections; one section consumes ⅓ token; longer sections may print on multiple sheets. Planning and PDF re-downloads do not subtract credits.",
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
        <p className="small">Updated 22 September 2026</p>
      </Prose>
    </>
  );
}
