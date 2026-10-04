import { PageHero, Prose, H } from "@/components/site";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Digital Delivery Policy",
  path: "/delivery",
  description:
    "How Syaahi delivers purchased study credits and generated notes. No physical goods are shipped.",
});
export default function Delivery() {
  return (
    <>
      <PageHero
        kicker="Payments & delivery"
        title="Digital delivery"
        lede="Syaahi supplies online study tools, monthly plans and digital exports. No physical products are shipped."
      />
      <Prose>
        <p>Updated 1 October 2026</p>
        <H>Purchased credits</H>
        <p>
          Credits are added to the signed-in account after the server verifies a
          captured payment. A checkout success message alone does not confirm
          delivery. Open <a href="/payments">Payments</a> to check your order
          and <a href="/profile">your account</a> to review the balance.
        </p>
        <H>Generated notes and downloads</H>
        <p>
          Notes are created after you review a study plan and begin generation.
          Processing time depends on the source size and provider availability.
          Saved lessons are available in your workspace. PDF exports are digital
          downloads; there is no shipping charge or delivery address.
        </p>
        <H>If an order remains pending</H>
        <p>
          Reopen the order before trying another payment. If you were charged
          and credits remain unavailable, contact <a href="/support">Support</a>{" "}
          with the order ID, payment ID and purchase time. Never send card
          numbers, passwords or API keys. Refund requests follow our{" "}
          <a href="/refunds">Refund Policy</a>.
        </p>
      </Prose>
    </>
  );
}
