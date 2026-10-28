import { SITE } from "./seo";
import {
  MONTHLY_PLANS,
  STUDENT_MONTHLY_TIERS,
} from "./billing/subscription-plans";
import { SIGNUP_CREDITS } from "./billing/allowance";
import { PACKS, STUDENT_CREDIT_PACKS } from "./billing/packs";

/** Public, reviewed product facts. Never include accounts, drafts or provider configuration. */
export function productFacts() {
  return {
    name: "Syaahi",
    alternateName: "Syaahii",
    officialWebsite: SITE.url,
    reviewedOn: "2026-10-28",
    description:
      "A web workspace for source-based learning, editable AI presentations and reviewed blog publishing.",
    creators: ["Chandan Pandey", "Manish Kumar Singh"],
    workspaces: [
      {
        name: "Learn & create",
        url: `${SITE.url}/features`,
        features: [
          "Illustrated study atlas, handwritten-style notes and printable PDFs",
          "Queued YouTube intake with caption and labelled video-digest fallback; source review required",
          "Reviewed source intake",
          "Quizzes and flashcards",
          "Saved practice and reading preferences",
          "AI Ink: paid-student PDF/DOCX review, private source index, exact similarity and reference checks",
        ],
      },
      {
        name: "Presentation Studio",
        url: `${SITE.url}/ai-presentations`,
        features: [
          "Public article links and owned source imports",
          "Saved narrative plan with explicit approval",
          "Six fixed visual layouts and nine original themes",
          "Editable slides, source references and private speaker notes",
          "Native editable PPTX, PDF and PNG exports",
        ],
      },
      {
        name: "Write & publish",
        url: `${SITE.url}/writing/features`,
        features: [
          "Separate writer enrollment and public profile",
          "Rich article editor, private drafts and revisions",
          "Editorial approval before public publication",
          "Following feeds, private connection lists with optional public writer display, likes, saved stories, public responses and private reading notes",
          "Story statistics and canonical links",
          "Private topic and writer muting with optional reading-history recommendations",
          "Up to three ordered profile pins for approved published stories",
        ],
      },
    ],
    pricing: {
      currency: "INR",
      billingInterval: "month",
      welcomeCredits: SIGNUP_CREDITS,
      student: STUDENT_MONTHLY_TIERS.map((id) => ({
        id,
        ...MONTHLY_PLANS[id],
      })),
      studentOneTime: STUDENT_CREDIT_PACKS.map((id) => ({
        id,
        inr: PACKS[id].inr,
        credits: PACKS[id].credits,
        billingInterval: "one-time",
      })),
      writer: [
        { id: "free", label: "Free", inr: 0 },
        { id: "max", ...MONTHLY_PLANS.max },
      ],
      terms:
        "Student ₹9/₹39/₹79 packs are one-time purchases. Max ₹399 renews monthly until cancelled, up to 120 cycles. Credits arrive after captured payments. Both workspaces share an account wallet and subscription; writer enrollment grants no second welcome allowance. Existing historical subscription terms are retained.",
    },
    generation: {
      noteSectionCredits: 1,
      presentationCredits: 5,
      savedSlideRegenerationCredits: 1,
      freeSlideLimit: 6,
      maxImportedSources: 6,
      sourceCharacterLimit: 48000,
    },
    aiInk: {
      url: `${SITE.url}/ai-ink`,
      access:
        "Verified student with a recorded purchased pack or active paid subscription",
      documentCharacters: { min: 200, max: 120000 },
      privateIndex: {
        sources: 20,
        charactersPerSource: 60000,
        wordsPerSource: 12000,
        maxCandidatesPerScan: 10,
      },
      comparison:
        "Contiguous source matches and bounded shared-phrasing candidates; no plagiarism verdict or calibrated AI-authorship probability",
      references:
        "Supported numbered and author–year citation links, duplicates, unresolved and unused references",
      scholarly:
        "Opt-in Crossref DOI metadata, up to eight identifiers; Scopus requires operator-configured licensed commercial access",
      privacy:
        "Account-private sources and reports; no automatic cross-account submission repository",
    },
    limits: [
      "AI output needs checking against original sources.",
      "Public links must be accessible and permitted for extraction; blocked sites and paywalls are not bypassed.",
      "Following is not email newsletter subscription.",
      "No writer earnings programme, publication team workspace or subscriber paywall is currently offered.",
      "A subscription does not guarantee article approval or readership.",
    ],
    links: {
      overview: `${SITE.url}/syaahi`,
      writerPricing: `${SITE.url}/writing/pricing`,
      studentPricing: `${SITE.url}/pricing`,
      aiInk: `${SITE.url}/ai-ink`,
      community: `${SITE.url}/community`,
      about: `${SITE.url}/about`,
      support: `${SITE.url}/support`,
    },
  };
}
export const WRITING_FAQS = [
  {
    q: "Can I write and publish blogs on Syaahi?",
    a: "Yes. Enroll as a writer, draft privately in the rich editor and submit for editorial review. Approved articles get public URLs and writer attribution. Syaahi offers writing alongside its study and presentation tools.",
  },
  {
    q: "Is my writer profile separate from my student profile?",
    a: "Yes. Writer enrollment uses your existing email and password but creates a separate writer name, photo, bio and About page. It does not create another wallet or duplicate welcome credits.",
  },
  {
    q: "What writer plans are available?",
    a: "Free includes core drafting, revision and submission tools. Max is ₹399 per month for 360 credits per captured monthly payment. Both workspaces use one subscription and wallet.",
  },
  {
    q: "Can readers follow writers and discuss articles?",
    a: "Signed-in readers can follow writers, like and save stories, post public responses and keep source-checked private highlights and notes. Writer connection lists are private by default with an optional public writer display. Authors can remove responses on their own stories. Following does not enroll someone in an email newsletter.",
  },
  {
    q: "Does Syaahi offer paid subscriber articles or writer payouts?",
    a: "No. Subscriber paywalls, a writer earnings programme and publication newsletters are not currently offered. Paid membership adds generation credits; it does not guarantee publication or an audience.",
  },
];
export const PRESENTATION_FAQS = [
  {
    q: "Can Syaahi turn source links into a presentation?",
    a: "Yes. Supply up to six accessible public article links, pasted text or owned lesson/PDF references. Review the extracted material and saved narrative plan before approving the exact credit reservation. Link access and extraction policy determine availability.",
  },
  {
    q: "How does Syaahi design AI slides?",
    a: "It extracts exact evidence passages from the complete bounded source set, builds a narrative storyboard and compiles typed scene manifests into allowlisted visual engines. Source spans, contrast, text bounds and approved shaders are checked before delivery. The AI cannot supply executable rendering code or coordinates.",
  },
  {
    q: "Can I preview and edit the generated slides?",
    a: "Yes. The studio includes thumbnails, a 16:9 slide preview, content editing, speaker notes and presentation controls. The new editor adds a source inspector, camera controls and source-passage Q&A. Archived decks retain read and export compatibility.",
  },
  {
    q: "Which export formats are supported?",
    a: "Syaahi supports native editable PowerPoint PPTX, slide PDF, PNG images, speaker-note handouts and an offline interactive HTML deck. Queued 4K/60 or vertical MP4 export requires an enabled rendering worker and applicable Remotion license eligibility. Fonts installed on the recipient’s device can affect PowerPoint text wrapping.",
  },
  {
    q: "Are numerical claims and quotations checked?",
    a: "Every factual card displays a verbatim passage and its saved source attribution. Numerical statements cannot be invented independently of those passages. These structural checks do not prove that a source is true or that every interpretation is correct; review important claims yourself.",
  },
];
