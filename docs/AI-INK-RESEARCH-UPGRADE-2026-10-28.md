# AI Ink research review upgrade — 28 October 2026

## Product decision

Build an independent research-review workflow with inspectable evidence. A similarity percentage describes compared text; it is not a plagiarism verdict. Writing-pattern measurements are not calibrated AI-authorship probabilities. No benchmark currently supports a claim that AI Ink exceeds Turnitin's detection accuracy or collection coverage.

The student workspace now exposes AI Ink directly beside its main tools. `/ai-ink` is the indexable product explanation; `/ink`, sources, reports and editing remain private/noindex.

## Research and provenance

- [Turnitin: similarity and plagiarism decisions](https://helpcenter.turnitin.com/hc/en-us/articles/27811925295501-Does-Turnitin-check-for-plagiarism-and-what-is-a-good-Similarity-score): its comparison collection includes current/archived web content, submitted student papers and premium publications. Educators interpret matches; there is no universal acceptable percentage.
- [Turnitin: AI Writing Report](https://guides.turnitin.com/hc/en-us/articles/22774058814093-Using-the-AI-Writing-Report): a separate model and indicator, with false positives/negatives and a requirement for human judgment. Its public documentation does not disclose enough to reproduce the proprietary model.
- [Crossref REST metadata](https://www.crossref.org/documentation/retrieve-metadata/rest-api/): bibliographic discovery and DOI metadata are available through the public REST interface. Metadata is not publisher full text or a determination that a citation supports a claim.
- [Elsevier Scopus APIs](https://dev.elsevier.com/sc_apis.html): abstracts and citation metadata; commercial use requires an API licence/subscription. A general developer key is not automatic commercial permission.
- [Turnitout repository](https://github.com/AhmadHassan-BTed/Turnitout-Humanizer), inspected at `1b997bd450330483ff7752617b88c7f3d54c179a`: the public tree contains documentation and web assets; no Python/Go/Rust/Java/C# core engine source was available. Architecture and enterprise API documents describe capabilities but do not make the advertised backend reproducible or independently validate its accuracy.
- [Turnitout licence at the inspected commit](https://github.com/AhmadHassan-BTed/Turnitout-Humanizer/blob/1b997bd450330483ff7752617b88c7f3d54c179a/LICENSE): proprietary, not an open-source grant. This change copies no engine source or proprietary assets, purchases no enterprise service and makes no detector-bypass claim.

## Implemented layers

| Layer                    | Actual behavior                                                                                                                       | Boundary                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document intake          | Searchable PDF/DOCX and UTF-8 text extraction; preview before checking                                                                | PDF/DOCX 10 MB; extracted submission 200–120,000 characters; scanned PDFs need OCR elsewhere                                                                                                                               |
| Private comparison index | Account-owned source text plus SHA-256 fingerprints of eight-word sequences; candidate retrieval followed by actual text confirmation | 20 sources/account, 200–60,000 characters and 12,000 words/source; at most 10 candidates in the direct-source scan budget                                                                                                  |
| Exact similarity         | Contiguous matching runs, minimum 12 words; word union avoids double counting                                                         | At most 34 combined sources, 60,000 characters/source, 16 repeated positions/shingle, 20,000 hits/source and 12 evidence spans/source. Reached limits are exposed in the report                                            |
| Shared phrasing          | Three-word-set overlap finds some lightly changed sentences and displays paired excerpts                                              | Heuristic, not semantic/translated plagiarism detection. 16–80-word sentences; first 200 eligible submission sentences, 250/source, 2,000 candidate comparisons and 12 findings. No contribution to exact-match percentage |
| Reference audit          | Links supported numbered and author–year markers, flags unresolved markers, duplicate references and unused entries                   | Conservative heading/style recognition; maximum 100 parsed references and 100 issues; manual review for unsupported formatting                                                                                             |
| DOI metadata             | Explicit per-report opt-in; Crossref title, publisher, year and registry status                                                       | Only up to 8 DOI identifiers leave the app, never the paper body. Missing record and service failure are distinct                                                                                                          |
| Scopus connector         | Optional DOI metadata lookup with exact DOI/EID confirmation                                                                          | Off unless `SCOPUS_API_KEY` and `SCOPUS_COMMERCIAL_LICENSED=true` are set. Not a full-text comparison collection                                                                                                           |
| Report filters           | Quote/bibliography exclusion, minimum matching words and individual source exclusions                                                 | View-only recalculation; raw report remains unchanged, downloadable with applied view settings                                                                                                                             |
| Editing                  | Open selected evidence passage, compare suggestions and explicitly accept edits                                                       | Existing AI provider availability still applies; source attribution and meaning need review                                                                                                                                |
| Discovery                | Public product facts, canonical metadata, SoftwareApplication/visible FAQ structured data, sitemap and llms.txt                       | No public indexing of uploaded papers or private reports; no ranking guarantee                                                                                                                                             |

## Privacy and security

Source-index GET returns titles/IDs/counts/timestamps, not source bodies, fingerprints or hashes. Source operations and reports require an authenticated verified student with qualifying paid entitlement; welcome/referral wallet credits alone do not grant it. Ownership applies separately to every account's state, report and imported document.

The shared API wrapper enforces origin checks, request byte/time budgets, admission control and redacted infrastructure errors. Index mutations have a 20/hour limit; analysis retains its existing 12/hour limit. Inputs are primitive-validated before persistence. Citation-name patterns are bounded to avoid long malformed names causing excessive backtracking. Paragraph/sentence mapping now advances a cursor instead of rescanning every sentence for each paragraph.

Metadata requests target fixed HTTPS Crossref/Elsevier hosts, encode DOI path components, reject redirects, use an eight-second overall deadline, process two identifiers at once and cap each response at 256 KB. The in-process cache holds at most 200 records: normal metadata up to 24 hours, service failures one minute. Scopus keys are sent only to Elsevier and are never part of report output.

Adding sources to the private index is explicit; submissions are not automatically put in a cross-account paper repository. Removing an indexed source removes its stored text/fingerprints, while old report excerpts remain until the relevant report is deleted. Operational database backups follow the operator's backup policy. Optional web search sends excerpts to its configured provider, and passage editing sends selected text/optional voice samples to the configured AI provider.

## Validation evidence

The implementation includes pure-function tests, real API tests for both SQLite and MongoDB replica-set storage, a production build and browser journeys. Test assets are synthetic. Browser rewrite success/failure uses explicitly labelled provider fixtures; document import, private index, matching, reference checks and report persistence use the real local backend.

Validation covers account isolation, anonymous/free denial, source/hash summary redaction, content deduplication, 20-source bounds, limited retrieval, oversized/selector rejection, normalization, 5,000-paragraph offsets, malformed author input, unchanged exact scores for near-copy candidates, bibliography boundaries, reversible filters, missing/duplicate/unused references, DOI opt-in, response limits/cache, outage vs missing-record status and Scopus's licence gate.

A real Crossref request for DOI `10.1128/mbio.01735-25` returned a registry record on 28 October 2026. Scopus has not been live-verified because no licensed production configuration was supplied. Web discovery and live AI revision are not represented as verified by mocked/local tests.

Local evidence files are under `output/ink-research*`. The browser suite checks upload, report, revision, report library, method, private source index and public product page at 320, 390, 768 and 1440 px; it includes source import/removal confirmation, evidence dialogs, filter reset, reference issues, canonical/FAQ metadata and private noindex assertions.

## What still requires separate work or access

1. A licensed, broad full-text corpus and opt-in institutional ingestion agreements. A twenty-source private index is not a substitute for a publisher or global submission repository.
2. Labelled evaluation datasets covering disciplines, languages, quotation styles and deliberate paraphrases. No measured precision/recall or comparative detection benchmark exists yet.
3. Semantic/cross-language matching and a calibrated AI-writing detector, if independently evaluated and communicated with false-positive limits.
4. OCR, layout-aware multi-column paper extraction, richer reference-format parsing and title/author lookup for sources without DOIs.
5. Production licensed Scopus credentials and a configured web-search provider, followed by hosted paid-account verification. These are optional integrations, not reasons to fake a successful check.

These boundaries are visible in the product. They protect users from mistaking a partial source check for a definitive accusation or originality certificate.
