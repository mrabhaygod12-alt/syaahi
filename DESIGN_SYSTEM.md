# Syaahii product design system

Approved direction implemented from the 16 October 2026 redesign proposal: a quiet learning workspace around expressive, editable notebooks.

## Foundations

Canonical shared values live in `app/redesign.css`. Canvas `#f7f8f5`, panel white, paper `#fffef8`, ink `#202d40`, muted text `#5d665f`, brand accent `#245447`, soft rules `#dfe5dc`. Spacing uses 4, 8, 12, 16, 24, 32 and 48px. Controls use 10px corners, larger panels 16px. Prefer a 44px comfortable interaction target; do not make dense editor controls unusably large.

Use the existing Instrument Sans UI family, restrained heading weights and clear labels. Handwriting belongs to notebook content, not navigation, forms, code or mathematical notation. Keep text selectable. Do not promise that a generated illustration is an actual application capture.

## Notebook composition

`lib/notes/notebook.ts` supplies shared web and PDF composition rules. `lib/pdf/templates.ts` is the template allowlist. The approved choices are:

| Template                              | Treatment                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sketchnote, default for new notebooks | Warm ivory, Kalam lettering, navy ink, sage headings, peach definitions and restrained yellow emphasis |
| Blue pen                              | Blue ink, ruled notebook, conventional underlines and spare callouts                                   |
| Cornell                               | Recall margin, dotted paper and separated explanation area                                             |

Preserve old template identifiers and saved accessible-reading preferences. Users can choose an accessible sans-serif reading view, or a paginated print preview. Keep code monospace and mathematics precisely typeset. Measure print content after fonts load, paginate overflow and use the same template selection in web and PDF. Paper and font choices are saved per owned notebook with revision checks; selection alone is a local preview until saved.

## Application hierarchy

Student Home prioritises Create notes, Continue learning and a short progress summary. Home, Create lesson, Notebooks, Practice and Exam planner are the primary destinations. Preferences and specialist tools belong under More tools. Avoid repeated global navigation and full marketing footers inside private workspaces.

The notebook starts with its title and primary reading/export actions. Appearance, accessibility and error reporting are grouped under Notebook options. History and recall configuration appear on request. Optional feedback follows the learning content.

Authentication uses one compact form and consistent recovery/verification states. Desktop may show an illustrative notebook; mobile prioritises the form. Preserve explicit consent, safe redirects, server-side workspace enrollment, verification and MFA. A visual redesign never substitutes for access control.

## Motion and accessibility

Use 160–240ms transitions for orientation. Keep the device walkthrough bounded, scroll-controlled and manually operable. Label it illustrative. Respect reduced motion and retain static content. Do not add perpetual motion to study content. Provide visible focus, meaningful accessible names, reflow at narrow widths and usable touch targets.

## Public landing composition

The landing page uses an editorial paper-and-ink composition, scoped to `.growth-editorial`. Give each chapter its own structure: layered notebook hero, chapter navigation, asymmetric lecture cards, device walkthrough, live preview desk, sample sheets, revision checklist, stacked presentation deck, genuine reviews, dark writer spread, resource links, two-column FAQ and a single final preview action. Keep student creation primary and writer enrollment a distinct secondary destination.

Depth is CSS only, with bounded pointer rotation on fine pointers. Scroll reveals translate once without hiding content. Desktop walkthrough steps follow scrolling; phones and reduced-motion users control them with buttons. Honour live changes to reduced-motion preferences and clean up listeners when leaving the page. No canvas, autoplay video or animation package is needed. Preserve server-rendered content and real forms; illustrative product art must remain labelled.

## Feedback and trust

Only eligible real users can submit testimonials. AI assistance edits the user's existing words; it must not invent experiences, ratings or praise. Show the proposal before applying it, require renewed consent after changes and retain moderation. Never automatically publish feedback or fabricated counters.

## Verification

Use isolated browser fixtures at 320, 390, 768 and 1440px; inspect screenshots as well as overflow assertions. Verify all three PDF templates, style save/reload, auth flows, practice, review moderation and payment navigation. Shared rules cover route families; they are not proof that every private state has received an individual visual review.
