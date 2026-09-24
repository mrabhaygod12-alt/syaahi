import { PageHero, Prose, H } from "@/components/site";
const sections = [
  [
    "Terms acceptance and support",
    "Password and Google sign-in require explicit acceptance of the current Terms. We save the accepted version and time with your account. Support tickets retain your subject, category, messages, status and timestamps; you and authorised support staff can access them. Do not include passwords, API keys or payment card details in tickets.",
  ],
  [
    "Account and session data",
    "The service stores your name, email address, salted password hash, and account creation time. Passwords are not stored as plaintext. A hashed session token and expiry are stored on the server; a session cookie signs you in for up to seven days.",
  ],
  [
    "Google sign-in",
    "When configured, Google sign-in uses Supabase to verify your identity. We store the verified identity identifier, name and email, then issue an application session. A matching password account is not automatically merged. Supabase and Google handle their respective authentication records under their own policies.",
  ],
  [
    "Shared lessons and reviews",
    "Folders, quiz attempts, flashcard review dates, collaborator membership and section comments are saved to your account. Anyone holding an active share link can read its generated notes. Joining requires an account; editor links allow editing. Shared lessons exclude the original private source text and source link. Revocation stops future access through that invitation but cannot recall copies already made.",
  ],
  [
    "Referrals",
    "Referral codes link a new account to an inviter. We record eligibility and verified reward events. The referral dashboard shows counts rather than referred users’ email addresses.",
  ],
  [
    "Material and generated content",
    "The app stores lesson topics, extracted source text, source links, generated sections, selected language, and study progress. Uploaded files are processed for extraction; the original uploaded file is not intentionally retained by the application. Extracted text is retained inside a saved lesson until that lesson is deleted.",
  ],
  [
    "AI processing",
    "Relevant note prompts and excerpts are sent to configured AI providers. Groq and Gemini are the default supported route; additional providers can be enabled by the operator. Screenshot extraction uses Gemini; audio transcription uses Gemini when configured. Downloadable study speech uses Gemini; chat voice playback also uses Gemini. Providers apply their own retention and training terms, and free tiers may differ from paid tiers. Do not submit confidential material without checking those terms.",
  ],
  [
    "External requests",
    "Topic research sends your search topic to Wikipedia. YouTube intake requests captions for the supplied video. The public interface may request fonts from Google Fonts. Payment checkout loads Razorpay only when you choose to buy credits.",
  ],
  [
    "Payments and operational data",
    "The server records order IDs, payment IDs, amounts, credit reservations, and ledger entries. Payment credentials are entered in the payment processor’s checkout, not stored by this application. Hosting and provider services may keep technical logs under their own policies.",
  ],
  [
    "Storage and retention",
    "Local mode uses SQLite on its host; cloud mode uses the operator’s configured MongoDB Atlas database. No automatic account-retention schedule or backup-erasure schedule is configured by this code. Deleting an inactive lesson removes its saved payload from the active database; it does not erase records already retained independently by providers or backups.",
  ],
  [
    "Your controls",
    "Review extracted text before generation, remove an attachment before submitting, delete inactive lessons, and sign out on shared devices. Contact the installation operator through Support for account access, correction, or deletion requests. Do not assume an unsent support draft has been received.",
  ],
  [
    "Deployment notice",
    "This page describes current software behaviour. The operator must publish its legal identity, contact details, hosting region, provider arrangements, and applicable retention policy before a public commercial launch. No certification or blanket compliance claim is made here.",
  ],
];
export default function Policy() {
  return (
    <>
      <PageHero
        kicker="Trust & transparency"
        title="Privacy & your study material"
        lede="A factual description of how this installation handles data."
      />
      <Prose>
        <p className="small">
          Updated 24 September 2026 · Current installation
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
