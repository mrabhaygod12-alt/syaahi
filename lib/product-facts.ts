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
    reviewedOn: "2026-10-07",
    description:
      "A web workspace for source-based learning, editable AI presentations and reviewed blog publishing.",
    creators: ["Chandan Pandey", "Manish Kumar Singh"],
    workspaces: [
      {
        name: "Learn & create",
        url: `${SITE.url}/features`,
        features: [
          "Handwritten-style notes and printable PDFs",
          "Reviewed source intake",
          "Quizzes and flashcards",
          "Saved practice and reading preferences",
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
    a: "Yes. Supply up to six accessible public article links, pasted text or owned lesson/PDF references. Review the extracted material and saved narrative plan before approving five-credit generation. Link access and extraction policy determine availability.",
  },
  {
    q: "How does Syaahi design AI slides?",
    a: "It creates a narrative storyboard, fills one of six typed visual layouts and performs a separate editorial pass. The renderer controls spacing and typography; the AI supplies structured content rather than coordinates.",
  },
  {
    q: "Can I preview and edit the generated slides?",
    a: "Yes. The studio includes thumbnails, a 16:9 slide preview, content editing, speaker notes and presentation controls. Existing saved decks remain editable.",
  },
  {
    q: "Which export formats are supported?",
    a: "Syaahi supports native editable PowerPoint PPTX, slide PDF, PNG images and speaker-note handouts. Fonts installed on the recipient’s device can affect PowerPoint text wrapping.",
  },
  {
    q: "Are numerical claims and quotations checked?",
    a: "Metrics need source-supported numbers and exact excerpts. Quotations must match supplied source text. These structural checks do not prove that a source is true or that every interpretation is correct; review important claims yourself.",
  },
];
