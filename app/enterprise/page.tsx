import { PageHero, Prose, H } from "@/components/site";
export default function Enterprise() {
  return (
    <>
      <PageHero
        kicker="For educators & teams"
        title="Build a study workflow around your curriculum."
        lede="Start with a teacher-reviewed pilot before using AI material with a class."
      />
      <Prose>
        <H>Available today</H>
        <p>
          Individual accounts can upload material, review an outline, generate
          notes, edit sections, create practice questions, and export PDFs.
          Share exported material only where you have permission.
        </p>
        <H>Plan a responsible pilot</H>
        <ol>
          <li>Select a small unit and a trusted source.</li>
          <li>Have a teacher check extraction, explanations, and questions.</li>
          <li>Collect learner feedback and identify missed concepts.</li>
          <li>
            Agree data-handling and support requirements before wider use.
          </li>
        </ol>
        <H>Institutional features under consideration</H>
        <p>
          Organisation workspaces, roster management, shared credit pools,
          teacher approval, institution invoices, and dedicated service levels
          are not included in this release. They need a separate implementation
          and operating agreement.
        </p>
        <a className="btn dark" href="/support">
          Discuss your requirements →
        </a>
      </Prose>
    </>
  );
}
