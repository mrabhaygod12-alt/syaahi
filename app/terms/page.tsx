import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Purpose of the service",
    "Syaahi helps organise study material into AI-generated notes and practice. It is not a substitute for a textbook, teacher, professional adviser, or an institution’s official requirements. No grade, admission, employment, or accuracy outcome is guaranteed.",
  ],
  [
    "Accounts",
    "Use an email address you control and protect your password. You are responsible for activity under your account. This installation does not currently provide verified parental consent or automated password recovery. Users who need those controls should contact the operator before using the service.",
  ],
  [
    "Material you submit",
    "Submit only material you have permission to process. You retain your rights in your original material. Submitting it authorises the technical processing needed for extraction, generation, saving, and export, including sending relevant content to configured providers.",
  ],
  [
    "Credits and output",
    "The displayed outline sets the generation cost. One token covers three generated note sections. Each section consumes one third of a token, stored as one integer page unit. A section is not a guaranteed physical sheet count. Credits are reserved before work starts. Unfinished reservations are returned when a job fails; completed sections consume credits. PDF continuation sheets and re-downloads do not add credit charges.",
  ],
  [
    "Sharing and referral rewards",
    "Share only material you have permission to share. An active link reveals generated notes to its holder; editor invitations additionally allow signed-in members to edit. New accounts receive 19 study credits once; signing in again gives no additional signup bonus. Apply a referral code within 24 hours of signup before the first purchase. An eligible verified signup gives the inviter 5 reward credits, transferable one-for-one into study credits. Three credits equal one token. Up to 20 inviter rewards may qualify per calendar month; over-cap pending referrals can be retried later. Prior purchase-based rewards remain unchanged and cannot earn a second reward. Self-referrals, duplicate accounts and abuse are ineligible. Promotional credits have no cash value.",
  ],
  [
    "Payments",
    "Prices and pack quantities are displayed before checkout. Credits are granted after a verified captured gateway payment or administrator verification of a direct UPI bank receipt. Entering a UTR alone does not prove payment. Checkout availability depends on the operator’s configuration. Monetary refund requests are handled separately from generation-credit returns, as described on Refunds.",
  ],
  [
    "Acceptable use and availability",
    "Do not misuse accounts, evade provider quotas, bypass payment checks, or upload material that infringes others’ rights. Free provider capacity can change, and the service may temporarily fail or become unavailable. Keep local copies of important exports.",
  ],
  [
    "Corrections and disputes",
    "Check output before relying on it and report problems through Support. Nothing on these pages is intended to remove rights that applicable law does not allow the operator to exclude. Operator identity and commercial contact information must be completed before public paid launch.",
  ],
];
export default function Policy() {
  return (
    <>
      <PageHero
        kicker="Trust & transparency"
        title="Terms of use"
        lede="How the study service works and the responsibilities that come with using it."
      />
      <Prose>
        <p className="small">
          Updated 22 September 2026 · Current installation
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
