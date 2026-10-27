# AI Ink document studio redesign

27 October 2026.

## Workflow

AI Ink now uses a compact student tool shell with a desktop sidebar and a four-item mobile navigation. The primary screen is an upload desk, followed by a document report and an editing desk. Copy is limited to the next action; detailed coverage and privacy explanations live on the method page.

- **Document check:** PDF/DOCX upload, drag and drop, text-paste modal, extracted-text preview, editable title, reference-source modal, library attachments and scan activity dialog. Replacing an existing draft requires an explicit choice. Failed imports preserve the current text.
- **Report:** similarity, citation and style measurements; highlighted source passages; keyboard-operable report tabs; side-by-side source evidence; passage-specific links to the editor; JSON download and browser print/save PDF. Missing comparison sources show an unmeasured similarity value instead of a reassuring zero. Permanent deletion has a separate cancel/confirm dialog.
- **Improve writing:** two-column original/revised editor, five editing modes, own-voice sample dialog, pending/error states, copy and explicit revision acceptance. A passage link loads only the selected span from an owner-authorized report. The original saved report is unchanged by editing.
- **My reports:** document cards, title search, newest/most-matched sorting and empty/error states.
- **How it works:** compact workflow cards and expandable coverage/privacy explanations.
- **Access states:** redesigned loading, sign-in, paid-plan and service-error screens. The existing server-side verified-student/paid-purchase policy remains enforced.

## Document handling

The import API accepts searchable PDF and DOCX up to 10 MB and UTF-8 TXT/Markdown/LaTeX up to 500 KB. Extracted text must contain 200–120,000 characters. PDF uses the existing isolated process. DOCX uses the existing bounded OOXML ZIP reader, with a 2,500-entry cap, 25 MB expanded-text cap and 12-second extraction deadline. ZIP contents are read in memory; no filesystem extraction, macros, external relationships or embedded links are executed. Invalid containers, missing document text, legacy `.doc`, password-protected inputs and over-budget documents fail without silent text truncation.

The preview is extracted text, not a recreation of the original PDF/Word page layout. Scanned PDFs still require OCR before import. This release does not add closed-journal, Turnitin or iThenticate database access. Writing heuristics are not an AI-authorship detector, and rewriting is not a guarantee of semantic equivalence or detector evasion. The proprietary Turnitout implementation has not been copied.

## Motion and accessibility

Motion uses a native IntersectionObserver and scoped CSS transitions/keyframes: section reveals, document scanner beam, an indeterminate activity track, modal entrances and hover feedback. There is no scroll hijacking, remote animation asset or additional runtime animation dependency. Reduced-motion preference removes animation. Native dialogs provide focus containment; dismissible dialogs support Escape and restore focus. Report tabs support arrow keys and Home/End. Navigation shows the active route and keeps a student-workspace return link available on mobile.

## Verification

- `npm run test:ink`: matching/style/citation checks and SQLite/Mongo API authorization, ownership, source matching, rewrite failure handling, DOCX extraction, Indic text, malformed containers, missing document parts, unsupported extensions, upload/text limits and no silent truncation.
- `npm run check` and production build.
- `npx tsx scripts/test-ink-browser.ts`: real PDF and DOCX imports, cancel/replace, invalid import recovery, modal Escape/focus restoration, real source-report highlights, source evidence popup, selected passage, keyboard tabs, JSON download, voice sample persistence, rewrite service-error preservation and explicit mocked-success/apply UI, report search/deletion, paid/free/anonymous gates. All five pages checked for overflow at 320, 390, 768 and 1440 pixels. AI success fixtures are labelled as fixtures, not live inference evidence.
- Screenshots and logs: `output/ink-redesign/`, `output/ink-redesign-build.log`, `output/ink-redesign-browser.log`.

Hosted paid-user inference remains dependent on an existing qualifying customer account and available configured AI provider capacity. No purchase, paid entitlement grant or provider recharge is part of this release.

## Dependency security refresh

The 27 October production audit reported new advisories after the previous release. Next.js is raised from the installed 15.5.27 to 15.5.28. `fast-uri` is updated to 3.1.9 and `undici` to 7.30.1. Remotion's bundled Zod is constrained to the compatible 4.6.7 patch line under `@remotion/bundler`, without downgrading Remotion or changing the application's optional OpenAI peer dependency. The resulting production audit reports zero known vulnerabilities. Security boundary tests and SQLite/Mongo hybrid-presentation tests pass after the dependency changes.

Advisories: [Next.js image optimizer](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [Zod bounded collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [undici content encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c), [fast-uri scheme validation](https://github.com/advisories/GHSA-w74x-v6f9-j3xg). A clean audit is evidence about known dependency advisories, not a guarantee against all attacks.
