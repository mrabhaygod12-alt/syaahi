import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Cookies & Local Storage",
  description:
    "Learn how Syaahi uses cookies and browser storage for login, preferences and the study experience.",
  path: "/cookies",
});
import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Session cookie",
    "The server issues an HttpOnly session cookie to authenticate requests. It uses SameSite=Lax and is marked Secure on HTTPS. It expires after seven days. Signing out invalidates the server session.",
  ],
  [
    "Browser storage",
    "The app may store a display-only account cache, local study preferences, chat drafts, quiz or flashcard progress, and study streaks in your browser. Local data is specific to that browser and may remain after a tab closes. The server does not trust this cache for authorisation.",
  ],
  [
    "Third-party services",
    "Payment checkout and provider websites may use their own cookies when opened. Their policies apply to those interactions. Optional Vercel Web Analytics loads only if you choose Allow analytics. It measures page visits; no advertising tracker is installed by the application. Your choice is stored in this browser under syaahi-privacy-v1. Essential only keeps optional analytics disabled.",
  ],
  [
    "Optional product measurement",
    "With Allow analytics, Syaahi uses HttpOnly syaahi-measurement and syaahi-visitor cookies for up to 90 days. Consented visit, preview, signup, lesson-ready, practice, payment and sharing events use pseudonymous IDs and daily dates. Note text, topics, source URLs, email addresses and payment secrets are not collected in this dataset. It expires after 90 days of inactivity. Essential only stops collection and deletes the current browser/account cohort from Syaahi's own measurement store. It does not erase historical data received separately by Vercel Analytics. Consented visitors may see one of two preview-button labels for product testing.",
  ],
  [
    "Your controls",
    "Use Privacy preferences in the footer to change your analytics choice at any time. Turning it off stops future analytics events from this page; it does not erase events already received by the provider. You can also remove cookies and site data in your browser settings. This signs you out and can remove local drafts. Blocking session cookies prevents account features from working.",
  ],
];
export default function Policy() {
  return (
    <>
      <PageHero
        kicker="Trust & transparency"
        title="Cookies & local storage"
        lede="Small pieces of data that keep your study workspace working."
      />
      <Prose>
        <p className="small">Updated 7 October 2026</p>
        {sections.map(([title, body], i) => (
          <section key={title}>
            <H>
              {i + 1}. {title}
            </H>
            <p>{body}</p>
          </section>
        ))}
        <p>
          Questions? <a href="/support">Contact the operator</a>.
        </p>
      </Prose>
    </>
  );
}
