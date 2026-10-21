# AI Ink by Syaahii — implementation and evidence

Date: 22 October 2026.

## Reference investigation

Reviewed the public recursive tree at Turnitout-Humanizer commit `b2f95139d08dd674a192cdb91af32bc6222f1469`, its README, architecture description and actual LICENSE. The public repository contains documentation/marketing assets, not the described Python/Streamlit parsing or rule engine. Its LICENSE is proprietary and prohibits unauthorized reuse. No Turnitout code, artwork, transformation rules or branding was imported. The local checkout has no `/frontend-design` folder. AI Ink is an independent TypeScript implementation and an editorial proof-sheet interface using scoped styles.

References: https://github.com/AhmadHassan-BTed/Turnitout-Humanizer/tree/b2f95139d08dd674a192cdb91af32bc6222f1469 and https://github.com/AhmadHassan-BTed/Turnitout-Humanizer/blob/b2f95139d08dd674a192cdb91af32bc6222f1469/LICENSE . Repository marketing promises about detector bypass, mandatory invisible watermarks and guaranteed preservation are not verified engineering evidence and are not product promises here.

## Delivered surfaces

- `/ink`: paper/chapter text composer, searchable PDF/TXT/Markdown/LaTeX import, private reference-library attachment and direct pasted reference.
- `/ink/report/[id]`: source-overlap evidence, exact highlighted spans, citation-format review, explainable writing-style measurements, source excerpts, JSON download, print/save PDF and permanent deletion.
- `/ink/reports`: private check history.
- `/ink/rewrite`: five editing modes, own-writing sample, source-to-result comparison, explicit acceptance. Maximum 6,000 characters per rewrite; longer input is rejected, never silently truncated.
- `/ink/how-it-works`: method, coverage and limitations.
- Student dashboard/workspace navigation opens AI Ink. A workspace return link and company footer are available on every Ink surface.

## Access and privacy

Every API authenticates a verified local session and checks student role and server-side payment evidence. A captured positive-value pack order with payment ID, or a paid subscription within its current billing period, unlocks access. Signup/referral credits and client-supplied plan names do not. Existing one-time packs retain access. No additional credit debit is introduced; checks are capped at 12/hour, rewrites at 20/hour and imports at 6/hour per authenticated account.

The browser gate is only presentation; APIs enforce authorization independently. Reports and attached documents are owner-scoped in SQLite and MongoDB. Frontend pages fetch the same-origin API rather than opening the backend database on Vercel. Mutation endpoints use the shared CSRF/origin guard, bounded request bodies and admission control.

Reports retain the user's draft and matched excerpts until deletion; they do not retain full third-party pages. Deleting removes the live report record (hosting database backups may retain it under the operator's backup policy). Writing samples can be cleared by saving an empty sample. Optional web queries send selected excerpts to Tavily/Brave only after explicit opt-in; without configured search, the report says it was skipped. Rewrites send the selected passage/sample to the configured AI fallback router. Users should avoid confidential material when an external provider's data policy is unsuitable.

## What checking means

Eight-word fingerprints are clustered only along the same token alignment; at least twelve words are required for evidence. Unique submission positions determine total coverage, so multiple sources cannot double-count a passage. Input sizes, source counts, repeated-phrase candidate expansion, search response bytes and total discovery time are bounded. Hindi combining marks and valid joiners remain intact. Full-text closed journal/book databases, Turnitin and iThenticate are not integrated. Matching is lexical rather than semantic. A clean report cannot certify originality; quotations can legitimately overlap.

Style scores are explainable heuristics, never probabilities of AI authorship. Citation-format presence does not verify that a cited source exists or supports a claim. The rewrite guard rejects missing numbers, common citations, quoted passages, inline/fenced code and equations; it cannot prove every semantic claim or named entity is preserved. Users review edits before use. No guaranteed AI-footprint removal, watermark evasion or detector-bypass claim is made.

## Validation

`npm run test:ink` exercises segmentation, real copied vs unrelated passages, duplicate-source counting, Indic word boundaries and SQLite/Mongo API authorization/ownership, repeat report IDs, invalid inputs, protected-fragment preservation and permanent deletion. Browser checks cover desktop/mobile, real fixture source comparison, imported PDF, private report controls, plan/role gates and error handling. External AI/search fixtures are identified as fixtures; provider activation is documented separately.

Real-provider note: two local AI Ink rewrite attempts using the supplied UnoRouter key timed out; the built browser test separately verified that a provider failure appears as an error and never as a successful rewrite. Source matching/report/import flows passed against the built API. Hosted customer rewrite success is not claimed.
