# Notebook and Turbo workflow evidence → Syaahi implementation

Research began on 13 October and integration continued on 14 October 2026. The test material was original synthetic undergraduate CS content about relational database normalization. No private notebooks, personal files, passwords, tokens or competitor server prompts were copied.

## Evidence and boundary

REA 6.4.0 was installed and registered for Codex at the user's request. Two controlled, fresh-profile public browser captures completed:

- Notebook public entry, redirected to its try-now page: `ev_9ddc96540eb48a199b709393a75573ceb17192d464073b5331f9ae640f561d4e`.
- Turbo public entry: `ev_73933ab8bd3ec1cd238165e17d79394c369e35a40319443dcf74351d513194fe`.

Complete retained records were exported locally to `output/research/rea-public-2026-10-13.json`. They describe public browser execution, DOM/accessibility and network event metadata. They do not establish authenticated functionality, network body contents, hidden server code, prompts or the model architecture.

The user’s authenticated Chrome profile used the extension rather than a loopback CDP endpoint. Signed-in research therefore used the connected browser UI, separately from REA’s public captures. Reconnection succeeded; later the profile disconnected again. Local Syaahi implementation does not depend on that connection.

## Observed Notebook workflow

- Sources, chat and Studio use separate panes. Source inclusion is explicit. Source summary and suggested questions appear after an original text source is processed.
- Deck customization offers Detailed/Presenter formats, language, length, source selection and a presentation brief before generation. The controlled Presenter/Short deck completed. Its nine illustrated slides explain anomalies, dependencies, normalization stages and the final schema, rather than repeating a generic bullet list. The actual observed deck is recorded in `output/research/notebook-deck.png`.
- Flashcards expose count/difficulty, language, text-only/image modes and selected sources. The generated set had 18 cards. Opening the first card showed a candidate-key question; flipping it showed `(StudentId, CourseId)`, an Explain action, Missed It/Got It and navigation. This observes one card interaction, not every review/retry/export behavior.
- Quiz customization exposed multiple-choice, multiple-select, fill-in and short-answer options. The controlled quiz finished and could be opened. The profile disconnected before answer/hint/results interactions were verified; no claim of completed quiz testing is made.
- Fast Research/Web controls were visible. Google's [source discovery help](https://support.google.com/gemininotebook/answer/16215270?co=GENIE.Platform%3DDesktop&hl=en) documents Fast Research and Deep Research. The private implementation and actual Deep Research execution were not inspected.

## Observed Turbo workflow

- A topic-first composer offers record/upload/YouTube alongside lesson creation. A controlled normalization request opened a chat and returned a named lesson plan with a separate Generate Lesson action.
- Generating the plan opened a material page with Learn, Notes, Quiz, Flashcards and Podcast navigation, but this account had exhausted free lessons. The premium screen is retained locally in `output/research/turbo-quota-boundary.png`. No checkout, subscription or paywall bypass was attempted.
- The actual planning chat response was inspected. A newly generated lesson body and its lesson chat were not accessible through the quota boundary. [Turbo's official student page](https://www.turbo.ai/for-students) describes its study activities; those descriptions are distinct from authenticated runtime evidence.

## Implemented in Syaahi

| Observed product need                       | Concrete implementation                                                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve the intended deck format           | Draft approval saves the Detailed/Presenter format on the deck; storyboarding, slot population, condensation and regeneration honor it. Detailed notes support reading explanations; Presenter notes support talk tracks, with the same concise visual slots. |
| Research before generating                  | Authenticated, rate-limited Wikipedia discovery returns original excerpts for review. Importing is explicit. Public HTTPS links continue through DNS-pinned SSRF checks, redirect validation, robots checks and bounded extraction.                           |
| Find relevant evidence beyond opening pages | Source import retrieves relevant original passages before clipping the snapshot, including later passages. Imported coverage remains bounded and marked truncated when applicable.                                                                            |
| Inspect explanations with the slide         | Private owner preview includes expandable reading notes or talk track; detailed notes open by default. Existing editable PPTX speaker notes and notes handout remain available; audience channels continue stripping private notes and extracted evidence.    |
| Guided lesson navigation                    | Saved outcomes/prerequisites, section progress and direct Understand/Example/Checkpoint phases with supporting note links and stale-response handling.                                                                                                        |
| Configurable practice                       | Persisted question/card counts, style, difficulty and focus; references resolve to actual saved note sections. Invalid model source IDs are removed or the unsupported item rejected.                                                                         |
| Resume and target weak concepts             | Quiz cursor persists; missed-only attempts select/score a server-defined subset. Full attempts remain available. Existing flashcard spaced review persists.                                                                                                   |
| Clear CS chat answers                       | Consecutive numbered lists stay one list; code fences preserve SQL/Python indentation; tables scroll on small screens; untrusted model HTML is escaped.                                                                                                       |

Implementation details and tests for the learning surface are in `LEARNING-STUDIO-UPGRADE-2026-10-14.md`. Writer follow/public article/indexing fixes are validated independently.

## Verification and remaining limits

Meaningful regression suites cover source retrieval, saved presentation mode, both editorial passes, schema/grounding guards, six deterministic archetypes, editable PPTX, owner/audience privacy, source-discovery bounds and chat rendering. SQLite/Mongo tests cover quiz persistence/subsets, race protection and saved practice settings. Production-browser suites cover source import, reading preview, follow retries, legacy Markdown and 320–1440px learning layouts.

Syaahi does not claim Google's models, a reconstruction of proprietary backend prompts, broad-web Deep Research, or full Notebook/Turbo parity. Wikipedia discovery is explicitly labeled. Source links identify the supplied material; they are not independent proof that every AI sentence is factually correct. The existing deterministic six-archetype engine remains responsible for layout. End-to-end production verification must identify the deployed commit and is reported separately after push.
