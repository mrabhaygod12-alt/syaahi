# Landing redesign — 17 October 2026

## Implemented

The public English and Hindi landing pages now share a paper-and-ink editorial layout. This update is scoped to the landing page rather than private student or writer workspaces.

- Layered notebook hero with restrained pointer-controlled depth and one primary preview action.
- Four chapter links to learning, live preview, examples and the separate writer space.
- Dark lecture card, diagram card, recall card and an interactive workflow.
- A scroll-driven laptop walkthrough on desktop; manual controls on phones and when reduced motion is requested. Scrolling on a phone no longer resets the selected step.
- A distinct live-preview desk, three stacked sample sheets, revision checklist, layered presentation illustration, real review section, writer spread, resource cards, FAQ and final preview action.
- One-time section entrances without hiding server-rendered content. No animation library, video or WebGL runtime added.
- Landing-specific mobile heading sizes override a legacy global typography cap without changing other routes.

The existing guest-preview API, signup topic continuity, lecture handoff, review API and resource links remain connected. Illustrations do not claim to be live generated output. Review content continues to come from approved real submissions; no ratings, testimonials or user counts were fabricated.

## Verification

The production build and `test:growth-browser` cover the changes. The browser suite checks English/Hindi preview output, signup context, 320/390/768/1440px overflow, chapter targets, FAQ expansion, desktop pointer depth, reduced motion, manual mobile demo state, content without JavaScript, saved student preferences and resource PDF download. It also captures the landing sections at phone and desktop widths for visual review.

These checks do not establish live AI provider quality, payment settlement, hosting capacity or search ranking. Those remain separate operational checks.
