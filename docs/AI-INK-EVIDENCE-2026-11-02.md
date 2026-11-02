# AI Ink evidence workspace — 2 November 2026

## Delivered behavior

AI Ink is a document-checking workspace. The editing UI and runtime were removed. Old editor URLs redirect to `/ink`; the paid authenticated rewrite API returns `410 INK_EDITING_RETIRED` without invoking an AI provider. Existing private reports and source data remain intact.

Reports now provide a document overview, raw and filtered text similarity, passage review groups, numbered matching sources, a manuscript inspector, side-by-side evidence, citation/reference review, comparison provenance and an explicit coverage/integrity ledger. No-source checks are unmeasured, not “0% original”. Nearby citation markers are review hints, not verified attribution.

Each newly compared source records its title, kind, URL when available, provider, text scope, retrieval time when known, bounded character count, truncation flag, SHA-256 fingerprint and matching word count. Sources with no matches remain in the ledger. Full third-party source bodies are not copied into each report. Legacy reports remain readable and explicitly identify missing historical ledgers.

## Actual research coverage

- OpenAlex: optional, off by default. At most two selected-excerpt queries, five records per query, a nine-second request deadline and one-megabyte response cap. Available abstracts are reconstructed from positional indexes and compared as **abstracts**, never publisher full text. Failure is recorded as unavailable/partial rather than a clean search.
- Crossref: existing explicit DOI opt-in; up to eight identifiers. Metadata is distinct from text matching.
- Tavily/Brave: existing optional configured web discovery. Returned page text and snippets now have separate provenance scopes. This is bounded discovery, not an exhaustive internet crawl.
- Public URL import: paid/private source index, public HTTPS only, validated and pinned public DNS, port restrictions, robots enforcement, bounded redirects, bytes and time, with cancellation. Restrictions are rechecked at redirect destinations. No sign-in/paywall bypass.
- Google Scholar: clearly labeled manual lookup. It is not automatically scraped or compared.
- ScienceDirect: licensed full-text integration unavailable without access. Scopus is a bibliographic index; optional licensed DOI metadata verification is not a Scopus full-text comparison engine.
- AI-text/image origin: no calibrated detector connected. No AI probability is invented. Images, graphs, scientific data fabrication, hidden formatting and original page geometry remain unassessed.

## Integrity and PDF export

Unicode checks flag supported zero-width characters, directional controls and mixed Latin/Cyrillic words. ZWJ/ZWNJ used by Indic scripts are deliberately excluded. These flags do not establish intent, misconduct or authorship.

`POST /api/ink/export` requires a verified paid student account, validates filter values, enforces report ownership and rate limits, and inherits the origin/CSRF and request-budget controls. It generates a private, non-cacheable PDF with no remote assets or document transmission to a rendering service. The PDF includes overview, filters, coverage, numbered sources, provenance, source excerpts, reference checks and reflowed manuscript highlights.

Export evidence is bounded to 80 exact passages at 1,000 characters per excerpt and 20 lexical candidates, explicitly labeled in the file. Full saved evidence remains in the private web report and JSON export. Bundled Noto fonts support Latin/Greek/Cyrillic and Devanagari; unsupported glyphs use labeled Unicode code points rather than silently disappearing. Original text remains in JSON. Coordinates are extracted-text positions, not original PDF geometry.

## Verification

- TypeScript validation and production build.
- AI Ink unit/research/consent/provenance/integrity/PDF tests.
- Paid/free/anonymous/writer boundaries, ownership, invalid filters and retired API tested with both SQLite and MongoDB.
- Browser intake, failed-upload preservation, filters/reset, evidence dialogs, real PDF download, history/source tools, public schema/canonical and private noindex checks.
- Responsive browser coverage at 320, 390, 768 and 1440 pixels; desktop/mobile report screenshots visually inspected.
- Synthetic PDF rendered to page images and inspected, including manuscript annotation and footer pagination.
- Presentation research regression and SEO checks.
- Production dependency audit resolved the known follow-redirects advisory by updating the locked package to 1.16.2.

The supplied comparison PDF was reviewed locally for report organization. It was not uploaded to an external research/detection service, included in fixtures, or committed to the repository. No equality with its proprietary database or score is claimed.
