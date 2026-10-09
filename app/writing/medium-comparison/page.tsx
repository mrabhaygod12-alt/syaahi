import ProductPage from "@/components/ProductPage";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Syaahi and Medium: writer capability comparison",
  path: "/writing/medium-comparison",
  description:
    "Compare Syaahi's reviewed publishing, canonical links, following and reading statistics with Medium's publication teams, newsletters and wider audience reporting.",
});
export default function Page() {
  return (
    <ProductPage
      title="Choose the tools your writing needs."
      kicker="SYAAHI & MEDIUM · CAPABILITY REVIEW"
      path="/writing/medium-comparison"
      lede="Syaahi combines learning and presentations with reviewed publishing. Medium offers a broader dedicated publishing ecosystem. This comparison describes available workflows and current gaps."
    >
      <div className="table-scroll">
        <table className="product-comparison">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Syaahi</th>
              <th>Medium documentation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Original publication credit</th>
              <td>
                Writers can set a validated HTTPS canonical URL on a story.
              </td>
              <td>
                <a href="https://help.medium.com/hc/en-us/articles/360033930293-Set-a-canonical-link">
                  Canonical-link support
                </a>{" "}
                for cross-posting.
              </td>
            </tr>
            <tr>
              <th>Publication teams</th>
              <td>
                Individual writer profiles and editorial review. Separate
                publication teams and contributor roles are not offered.
              </td>
              <td>
                <a href="https://help.medium.com/hc/en-us/articles/115004681607-Getting-started-with-a-Medium-publication">
                  Publication pages and roles
                </a>{" "}
                support grouped writing.
              </td>
            </tr>
            <tr>
              <th>Email newsletters</th>
              <td>
                Following is available. Newsletter signup and email delivery are
                not offered.
              </td>
              <td>
                <a href="https://help.medium.com/hc/en-us/articles/115004682167-Newsletter">
                  Publication newsletters
                </a>{" "}
                have separate subscriptions and email statistics.
              </td>
            </tr>
            <tr>
              <th>Audience reporting</th>
              <td>
                Approximate story opens, likes, public responses, followers and
                qualified signed-in readers. Story metrics cover the latest 50
                stories; thirty-second signals do not prove attention.
              </td>
              <td>
                <a href="https://help.medium.com/hc/en-us/articles/34831991136151-Story-s-detailed-stats-page">
                  Detailed story statistics
                </a>{" "}
                provide more distribution and reader reporting.
              </td>
            </tr>
            <tr>
              <th>Follower growth</th>
              <td>
                Durable follow/unfollow, counts, paginated writer connection
                lists and an optional public profile display. Student account
                identities stay private. Following does not collect email
                subscribers.
              </td>
              <td>
                <a href="https://help.medium.com/hc/en-us/articles/4405449973015-Audience-stats">
                  Audience statistics
                </a>{" "}
                distinguish followers and email subscribers.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <section className="product-answer">
        <h2>What makes Syaahi useful?</h2>
        <p>
          You can study source material, create an editable presentation and
          write an article in one account. Separate enrollment keeps writer
          identity apart from the student dashboard. This connection is useful
          for teachers, students and professionals who learn before they
          publish.
        </p>
        <h2>What remains to be built?</h2>
        <p>
          Publication teams, newsletter delivery, subscriber paywalls, author
          payouts and more detailed audience analysis remain outside the current
          release. Core drafting, reviewed publishing, following, public
          responses and private reading notes are working parts of the platform.
        </p>
        <p>
          Reviewed on <time dateTime="2026-10-09">9 October 2026</time>.
          Provider features can change; the linked official documentation is the
          reference. This is a capability comparison, not an affiliation with
          Medium.
        </p>
        <div className="product-link-row">
          <a href="/writing/features">Explore Syaahi writer features</a>
          <a href="/writing/pricing">Writer pricing</a>
          <a href="/ai-presentations">Presentation Studio</a>
        </div>
      </section>
    </ProductPage>
  );
}
