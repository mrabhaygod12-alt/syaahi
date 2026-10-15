import ProductPage from "@/components/ProductPage";
import { pageMeta } from "@/lib/seo";
import { notesSchema, VIDEO_NOTE_FAQS } from "@/lib/notes/product";
export const metadata = pageMeta({
  title: "AI-generated notes from YouTube videos",
  path: "/youtube-video-to-notes",
  description:
    "Turn a public YouTube lecture into editable study notes. Review captions or a clearly labelled video digest, then export PDF and practise with quizzes and flashcards.",
});
export default function Page() {
  return (
    <ProductPage
      title="From a YouTube lecture to notes you can use."
      kicker="AI-GENERATED NOTES FROM YOUTUBE VIDEO"
      path="/youtube-video-to-notes"
      lede="Paste a public lecture link. Review the source and outline, then create structured notes, diagrams and recall practice in your private study workspace."
      faqs={VIDEO_NOTE_FAQS}
      schema={notesSchema(true)}
    >
      <section className="product-answer">
        <h2>How YouTube lecture notes work</h2>
        <p>
          Syaahii reads available captions from a public lecture. If captions
          are missing and video reading is configured, it attempts a clearly
          labelled AI-extracted digest. You review the material before a lesson
          is generated.
        </p>
        <a className="btn dark" href="/dashboard">
          Add a lecture link →
        </a>
        <p className="small">
          Public videos up to 60 minutes. Processing time varies with the
          source, worker and provider availability.
        </p>
      </section>
      <section>
        <h2>One source. A complete study workflow.</h2>
        <ol className="product-process">
          <li>
            <strong>Read the source.</strong> Captions first; a public-video
            digest when supported. Neither a title nor metadata replaces the
            lecture.
          </li>
          <li>
            <strong>Review the plan.</strong> Check key topics, extracted text
            and uncertainty. Edit your outline before using lesson credits.
          </li>
          <li>
            <strong>Generate a study atlas.</strong> Definitions, useful
            examples, comparisons and deterministic diagrams keep ideas
            connected.
          </li>
          <li>
            <strong>Test your understanding.</strong> Ask the lesson assistant,
            answer quiz questions and revisit flashcards.
          </li>
        </ol>
      </section>
      <section className="product-answer">
        <h2>No transcript? Here is the fallback.</h2>
        <p>
          A digest is a summary of what a video-reading model could extract, not
          a verbatim transcript. If the video cannot be read reliably, the
          workspace asks for a permitted recording or a pasted transcript. It
          does not silently fabricate content.
        </p>
        <a href="/docs/youtube">Read the YouTube source guide →</a>
      </section>
      <section>
        <h2>Keep your work when the browser closes.</h2>
        <p>
          The extraction request creates an owned background job. Short progress
          checks show whether it is queued, reading or checking teaching
          content. Prepare the same link again to resume the saved job. A worker
          must be running for the queue to progress.
        </p>
        <p>
          Sources and lesson contents stay private to your account. Review AI
          output against the lecture before relying on it.
        </p>
        <a href="/ai-generated-notes">Explore all AI-generated notes →</a>
      </section>
    </ProductPage>
  );
}
