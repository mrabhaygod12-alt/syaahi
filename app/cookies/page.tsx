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
    "Payment checkout and provider websites may use their own cookies when opened. Their policies apply to those interactions. The application does not currently install an advertising tracker or an optional analytics SDK.",
  ],
  [
    "Your controls",
    "You can remove cookies and site data in your browser settings. This signs you out and can remove local drafts and practice history. Download anything important first. Blocking session cookies prevents account features from working.",
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
        <p className="small">
          Updated 21 September 2026 · Current installation
        </p>
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
