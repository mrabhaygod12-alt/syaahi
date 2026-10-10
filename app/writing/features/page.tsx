import ProductPage from "@/components/ProductPage";
import WriterStartLink from "@/components/writer/WriterStartLink";
import { pageMeta, writingSchema } from "@/lib/seo";
import { WRITING_FAQS } from "@/lib/product-facts";
export const metadata = pageMeta({
  title: "Blog writing and publishing tools for writers",
  path: "/writing/features",
  description:
    "Syaahi writer tools include a rich editor, private drafts, revisions, public profiles, reviewed publishing, following, responses, reading notes and story statistics.",
});
const tools = [
  [
    "Write with room to think",
    "Use headings, emphasis, lists, links, tables, equations and uploaded images. Article design controls include fonts, spacing, accents, page color and borders.",
  ],
  [
    "Save private drafts and revisions",
    "Work stays private before approval. Autosave, earlier versions and revision checks help you return to a draft and avoid overwriting another change.",
  ],
  [
    "Build a distinct writer profile",
    "Choose your writer name, photo, bio, pronouns and About page. Public stories use your writer identity rather than exposing student account information.",
  ],
  [
    "Submit for editorial review",
    "Track drafts, requested changes and approved stories in Your stories. An editor reviews the submission before its article URL becomes public.",
  ],
  [
    "Help readers return",
    "Follow and unfollow writers, browse your connections and return through a Following feed. Writers can choose to show verified public writer connections on their profile. Reading position, selected highlights and notes stay private.",
  ],
  [
    "Talk about published work",
    "Like, save, share and comment on reviewed articles. Story cards show real likes, visible responses and approximate views. Authors and response owners can remove their responses; private reading notes stay private.",
  ],
  [
    "Shape your reading feed",
    "Choose topics, mute topics or public writers and opt into reading-history recommendations. Muting stays private and leaves your follow relationships unchanged; you can unmute any time.",
  ],
  [
    "Understand readership",
    "View followers, following, likes, responses, approximate story opens and qualified signed-in readers separately. Story metrics cover your latest 50 stories. Qualified readers use a bounded thirty-second signal, not verified attention or earnings.",
  ],
  [
    "Credit an original publication",
    "Set a validated HTTPS canonical URL when cross-posting work you have the right to publish. The approved page includes that original URL in its metadata.",
  ],
];
export default function Page() {
  return (
    <ProductPage
      title="A complete home for your writing."
      kicker="SYAAHI WRITE & PUBLISH"
      path="/writing/features"
      lede="Draft privately, shape your article, build your writer identity and share approved work with readers."
      faqs={WRITING_FAQS}
      schema={writingSchema()}
    >
      <section className="product-answer">
        <h2>How do I publish a blog on Syaahi?</h2>
        <p>
          Sign up as a writer, open the editor, write and save your draft, then
          submit for review. Approved stories appear in the public community
          with a byline and public profile. The editor and submission flow are
          included on Free.
        </p>
        <div className="product-link-row">
          <WriterStartLink />
          <a href="/community">Read reviewed stories</a>
          <a href="/writing/pricing">Compare the two writer plans</a>
        </div>
      </section>
      <section
        className="product-feature-grid"
        aria-label="Writer capabilities"
      >
        {tools.map(([title, body]) => (
          <article className="card" key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="product-answer">
        <h2>Clear scope for writers.</h2>
        <p>
          Syaahi currently has no publication team workspace, newsletter
          delivery, subscriber paywall or writer payout programme. Following and
          reading statistics work without those services. A paid plan adds
          generation credits and never guarantees approval or an audience.
        </p>
        <a href="/writing/medium-comparison">
          See the capability comparison with Medium →
        </a>
      </section>
    </ProductPage>
  );
}
