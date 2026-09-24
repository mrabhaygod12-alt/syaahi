import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "If generation stops",
    "Unused reserved credits are returned automatically when a job is marked failed. Sections saved successfully remain in your lesson and consume their credits. A resumed job reserves only its missing sections.",
  ],
  [
    "If payment succeeds but credits are missing",
    "Keep your payment and order IDs, the purchase time, and account email. Do not send card details, passwords, or payment OTPs. Ask the operator to reconcile the payment. Repeated valid callbacks cannot credit the same payment twice.",
  ],
  [
    "Requesting a payment refund",
    "Use the configured support contact and explain the purchase and issue. The operator reviews the request and, when appropriate, processes the refund through the payment provider. This code does not automate monetary refunds or promise a fixed processing period.",
  ],
  [
    "Quality concerns",
    "AI output can contain mistakes. Explain the specific missing or incorrect material when reporting a quality issue. Downloading, printing, or deleting a lesson does not automatically trigger a refund. Applicable consumer rights remain unaffected.",
  ],
  [
    "Before paid launch",
    "The operator must publish its refund eligibility, review process, business identity, and response target. Until payment and support configuration are complete, paid checkout should remain disabled.",
  ],
];
export default function Policy() {
  return (
    <>
      <PageHero
        kicker="Trust & transparency"
        title="Credits, failures & refunds"
        lede="A clear distinction between generation credits and payment refunds."
      />
      <Prose>
        <p className="small">
          Updated 21 September 2026 · Current installation
        </p>
        {sections.map(([title, body], i) => (
          <section key={title}>
            <H>
              {i + 1}. {title}
            </H>
            <p>{body}</p>
          </section>
        ))}
        <p>
          Questions? <a href="/support">Contact the operator</a>.
        </p>
      </Prose>
    </>
  );
}
