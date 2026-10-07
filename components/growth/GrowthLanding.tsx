import PreviewCta from "./PreviewCta";
import GuestPreview, { PreviewPaper } from "./GuestPreview";
import LandingMotion from "../LandingMotion";
import InstallApp from "../InstallApp";
import {
  UNIVERSITY_SAMPLES,
  learningLink,
  type PreviewLanguage,
} from "@/lib/growth/samples";
import { Faq } from "../site";

import "./growth.css";
export const GROWTH_FAQS = [
  {
    q: "Can I try Syaahi before signing up?",
    a: "Yes. Try a short topic preview without an account. Original sample topics load immediately; other study topics use a bounded AI preview. A verified account is needed to generate, save and download your own full lesson PDF.",
  },
  {
    q: "What can I create from my own material?",
    a: "Upload your PDF or other supported material, review the source and edit the outline, then approve the generation cost. Your lesson brings together notes, explanations, quizzes and flashcards. You can also create editable presentations.",
  },
  {
    q: "How much does it cost?",
    a: "New verified accounts receive 19 welcome generation credits. Student ₹9, ₹39 and ₹79 packs are one-time purchases. Max is ₹399 per month and renews until cancelled. Planning is free; a generated note section uses one credit and a presentation uses five.",
  },
  {
    q: "Are AI notes always correct?",
    a: "No. Check explanations against your original source and report errors from the lesson. Topic-only previews are general AI knowledge, not source-verified research or guaranteed exam coverage.",
  },
  {
    q: "Can I also write and publish?",
    a: "Yes. The separate writer space includes private drafts, a rich editor, a public profile and editorial review. Writer signup is required, with the same existing email and password. Writer plans are Free and ₹399/month; the wallet stays shared.",
  },
];
export default function GrowthLanding({
  language = "english",
}: {
  language?: PreviewLanguage;
}) {
  const hi = language === "hindi",
    t = (en: string, hindi: string) => (hi ? hindi : en);
  return (
    <div className="landing-page growth-landing" lang={hi ? "hi" : "en-IN"}>
      <LandingMotion />
      <div className="landing-scroll-progress" aria-hidden="true" />
      <section className="growth-hero growth-wrap">
        <div className="growth-hero-copy" data-reveal>
          <p className="growth-eyebrow">
            {t(
              "BUILT FOR UG & PG · COMPUTER SCIENCE",
              "UG और PG · कंप्यूटर साइंस के लिए",
            )}
          </p>
          <h1>
            {t("Turn a topic or PDF into", "विषय या PDF से बनाएँ")}{" "}
            <em>{t("notes you can revise.", "आसान रिविज़न नोट्स।")}</em>
          </h1>
          <p>
            {t(
              "For CSE, IT, BCA/MCA and related departments: handwritten-style notes, clear diagrams and recall practice in one study space. Review your outline, make it yours, and download a printable PDF.",
              "CSE, IT, BCA/MCA और संबंधित विभागों के लिए: हस्तलेखन जैसे नोट्स, चित्र और अभ्यास एक स्थान में। रूपरेखा जाँचें, बदलाव करें और PDF डाउनलोड करें।",
            )}
          </p>
          <PreviewCta hindi={hi} />
          <div className="growth-hero-proof">
            <span>
              ✓ {t("No signup for preview", "प्रीव्यू के लिए साइनअप नहीं")}
            </span>
            <span>✓ {t("Hindi & English", "हिंदी और अंग्रेज़ी")}</span>
          </div>
          <a className="growth-secondary" href="/writing">
            {t(
              "Here to write? Explore your writer space ↗",
              "लिखना चाहते हैं? लेखक स्थान देखें ↗",
            )}
          </a>
        </div>
        <div className="growth-hero-note" data-reveal>
          <span className="growth-orbit" aria-hidden="true" />
          <span className="growth-annotation">
            {t("One idea. One useful page.", "एक विचार। एक उपयोगी पन्ना।")}
          </span>
          <PreviewPaper preview={UNIVERSITY_SAMPLES[0][language]} compact />
          <span className="growth-note-stamp">
            {t("Original sample · live rendering", "मूल नमूना · असली प्रीव्यू")}
          </span>
        </div>
      </section>
      <section className="growth-proof-strip">
        <div className="growth-wrap">
          <span>{t("TOPIC / PDF / LECTURE", "विषय / PDF / लेक्चर")}</span>
          <i>→</i>
          <span>{t("EDITABLE OUTLINE", "संपादन योग्य रूपरेखा")}</span>
          <i>→</i>
          <span>{t("NOTES + RECALL", "नोट्स + अभ्यास")}</span>
          <i>→</i>
          <span>{t("PRINTABLE PDF", "प्रिंट योग्य PDF")}</span>
        </div>
      </section>
      <section className="growth-wrap growth-preview-section" data-reveal>
        <GuestPreview language={language} />
      </section>
      <section className="growth-wrap growth-gallery" id="learn">
        <div className="growth-section-heading" data-reveal>
          <p className="growth-eyebrow">
            {t(
              "SEE THE OUTPUT, NOT JUST THE PROMISE",
              "दावे नहीं, परिणाम देखें",
            )}
          </p>
          <h2>
            {t(
              "From a question to something useful.",
              "एक सवाल से उपयोगी सीख तक।",
            )}
          </h2>
          <p>
            {t(
              "Three original examples show how the note format works. These are samples, not student testimonials or claimed exam results.",
              "तीन मूल उदाहरण नोट्स का रूप दिखाते हैं। ये नमूने हैं, छात्र समीक्षाएँ या परीक्षा के परिणाम नहीं।",
            )}
          </p>
        </div>
        <div className="growth-sample-grid">
          {UNIVERSITY_SAMPLES.map((s) => (
            <article key={s.id} data-reveal>
              <div className="growth-sample-input">
                <span>{s.subject}</span>
                <small>{t("YOU START WITH", "शुरुआत")}</small>
                <h3>{s.topic}</h3>
              </div>
              <div className="growth-sample-after">
                <small>{t("YOU LEAVE WITH", "आपको मिलता है")}</small>
                <h3>{s[language].title}</h3>
                <p>{s[language].summary}</p>
                <div className="growth-mini-flow">
                  {s[language].points.map((p) => (
                    <span key={p.heading}>{p.heading}</span>
                  ))}
                </div>
                <a href={`/examples?sample=${s.id}`}>
                  {t("See the note →", "नोट देखें →")}
                </a>
                <a href={learningLink(s.topic, language)}>
                  {t("Generate this topic ↗", "इस विषय के नोट्स बनाएँ ↗")}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="growth-routine">
        <div className="growth-wrap growth-two">
          <div data-reveal>
            <p className="growth-eyebrow">
              {t(
                "SMALL SESSIONS. STEADY PROGRESS.",
                "छोटे सत्र। लगातार प्रगति।",
              )}
            </p>
            <h2>
              {t(
                "A study plan you can return to.",
                "ऐसी योजना जिसमें लौटना आसान हो।",
              )}
            </h2>
            <p>
              {t(
                "Choose your exam, subject and language. Start with a suggested topic, set your own daily goal and revisit the concepts your saved quiz attempts show you missed.",
                "परीक्षा, विषय और भाषा चुनें। सुझाए विषय से शुरू करें, अपना दैनिक लक्ष्य तय करें और क्विज़ में छूटे विचारों पर दोबारा काम करें।",
              )}
            </p>
            <a className="btn dark" href="/signup?workspace=student">
              {t(
                "Start with 19 welcome credits ↗",
                "19 स्वागत क्रेडिट से शुरुआत करें ↗",
              )}
            </a>
          </div>
          <div className="growth-routine-cards" data-reveal>
            {[
              [
                "01",
                t("Plan for your exam", "अपनी परीक्षा की योजना"),
                t(
                  "A countdown based on the date you choose, with your saved revision tasks.",
                  "आपकी चुनी तारीख और सहेजे रिविज़न कार्यों पर आधारित काउंटडाउन।",
                ),
              ],
              [
                "02",
                t("Recall, then revisit", "अभ्यास करें, फिर दोहराएँ"),
                t(
                  "Saved quiz results, due flashcards and optional study reminders.",
                  "सहेजे क्विज़ परिणाम, दोहराने वाले फ्लैशकार्ड और वैकल्पिक रिमाइंडर।",
                ),
              ],
              [
                "03",
                t("Keep your progress", "अपनी प्रगति सुरक्षित रखें"),
                t(
                  "Private lessons and drafts. In-app updates when your new lesson is ready.",
                  "निजी पाठ और ड्राफ्ट। नया पाठ तैयार होने पर ऐप में सूचना।",
                ),
              ],
            ].map(([n, h, p]) => (
              <article key={n}>
                <span>{n}</span>
                <div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="growth-wrap growth-two growth-product-section">
        <div
          className="growth-deck-art"
          data-reveal
          aria-label="Illustration of the six-layout presentation studio"
        >
          <div>
            <small>SOURCE → STORY → SLIDES</small>
            <h3>
              {t("An idea worth presenting.", "प्रस्तुत करने लायक विचार।")}
            </h3>
            <div className="growth-deck-bento">
              <span>
                01
                <br />
                Context
              </span>
              <span>
                02
                <br />
                Evidence
              </span>
              <span>
                03
                <br />
                Takeaway
              </span>
            </div>
            <span>16:9 · Preview · Edit · PPTX / PDF</span>
          </div>
        </div>
        <div data-reveal>
          <p className="growth-eyebrow">
            {t(
              "WHEN A NOTE BECOMES A PRESENTATION",
              "जब नोट्स से प्रेज़ेंटेशन बने",
            )}
          </p>
          <h2>
            {t(
              "Build the story before the slides.",
              "स्लाइड से पहले कहानी बनाएँ।",
            )}
          </h2>
          <p>
            {t(
              "Bring your sources. Review the narrative plan. Use six structured layouts and nine themes, then preview, edit and export your deck.",
              "अपने स्रोत लाएँ। कहानी की योजना जाँचें। छह लेआउट और नौ थीम से स्लाइड बनाएँ, प्रीव्यू देखें, संपादन और एक्सपोर्ट करें।",
            )}
          </p>
          <a className="growth-text-link" href="/ai-presentations">
            {t("Explore AI presentations ↗", "AI प्रेज़ेंटेशन देखें ↗")}
          </a>
        </div>
      </section>
      <section className="growth-writer">
        <div className="growth-wrap growth-two">
          <div data-reveal>
            <p className="growth-eyebrow">
              {t(
                "A SEPARATE SPACE FOR YOUR WORDS",
                "आपके शब्दों के लिए अलग स्थान",
              )}
            </p>
            <h2>{t("Have something to say?", "कुछ कहना चाहते हैं?")}</h2>
            <p>
              {t(
                "Write in a focused editor, save private drafts and build your public profile. Articles go through editorial review. Your writer space has its own home and navigation.",
                "केंद्रित एडिटर में लिखें, निजी ड्राफ्ट सहेजें और सार्वजनिक प्रोफ़ाइल बनाएँ। लेख संपादकीय समीक्षा से प्रकाशित होते हैं। लेखक स्थान की अपनी होम और नेविगेशन है।",
              )}
            </p>
            <a className="btn gold" href="/writing">
              {t("Meet your writing space ↗", "अपना लेखक स्थान देखें ↗")}
            </a>
          </div>
          <div className="growth-writer-page" data-reveal>
            <small>DRAFT / PRIVATE UNTIL REVIEWED</small>
            <h3>
              {t(
                "Your perspective deserves a page.",
                "आपके विचारों को एक पन्ना मिले।",
              )}
            </h3>
            <div className="growth-editor-ribbon">
              <b>B</b>
              <em>I</em>
              <u>U</u>
              <span>≡</span>
              <span>＋</span>
            </div>
            <p>
              {t(
                "Draft. Refine. Submit for review.",
                "लिखें। सुधारें। समीक्षा के लिए भेजें।",
              )}
            </p>
            <div className="growth-write-lines" />
          </div>
        </div>
      </section>
      <section className="growth-wrap growth-two growth-trust">
        <div data-reveal>
          <p className="growth-eyebrow">
            {t("BUILT FOR UNDERSTANDING", "समझने के लिए बनाया गया")}
          </p>
          <h2>
            {t(
              "Keep the source. Check the explanation.",
              "स्रोत रखें। व्याख्या जाँचें।",
            )}
          </h2>
          <p>
            {t(
              "Source references stay with your lesson. Report an error, return to the original material and edit the note. Your private material is not public unless you choose to share it.",
              "स्रोत संदर्भ पाठ के साथ रहते हैं। गलती रिपोर्ट करें, मूल सामग्री देखें और नोट सुधारें। आपकी निजी सामग्री आपकी अनुमति के बिना सार्वजनिक नहीं होती।",
            )}
          </p>
          <a href="/disclaimer">
            {t("Responsible AI use →", "ज़िम्मेदार AI उपयोग →")}
          </a>
        </div>
        <div className="growth-resource-cards" data-reveal>
          <a href="/resources">
            <span>↙</span>
            <h3>{t("Free revision templates", "मुफ़्त रिविज़न टेम्पलेट")}</h3>
            <p>
              {t(
                "Download a revision planner and an active-recall worksheet.",
                "रिविज़न प्लानर और एक्टिव-रिकॉल वर्कशीट डाउनलोड करें।",
              )}
            </p>
          </a>
          <a href="/refer">
            <span>↗</span>
            <h3>{t("Study with a friend", "दोस्त के साथ पढ़ें")}</h3>
            <p>
              {t(
                "Share your invitation. Verified referral rewards follow the published rules.",
                "अपना आमंत्रण शेयर करें। सत्यापित रेफ़रल पुरस्कार प्रकाशित नियमों के अनुसार मिलते हैं।",
              )}
            </p>
          </a>
          <div>
            <InstallApp />
            <p>
              {t(
                "Add Syaahi to your home screen for a quicker return.",
                "जल्दी लौटने के लिए Syaahi को होम स्क्रीन पर जोड़ें।",
              )}
            </p>
          </div>
        </div>
      </section>
      <section className="growth-wrap growth-faq">
        <Faq
          items={
            hi
              ? [
                  {
                    q: "क्या बिना साइनअप प्रीव्यू देख सकता हूँ?",
                    a: "हाँ। छोटा विषय प्रीव्यू बिना खाते के देखें। पूरा पाठ बनाने, सहेजने और PDF डाउनलोड करने के लिए सत्यापित खाता चाहिए।",
                  },
                  {
                    q: "क्या हिंदी में नोट्स बनते हैं?",
                    a: "हाँ। प्रीव्यू और अपना पाठ बनाते समय हिंदी चुनें। रूपरेखा और सामग्री हमेशा अपने मूल स्रोत से जाँचें।",
                  },
                  {
                    q: "क्या नोट्स हमेशा सही होते हैं?",
                    a: "AI में गलती हो सकती है। पाठ्यपुस्तक से तथ्य जाँचें और पाठ में गलती रिपोर्ट करें। परीक्षा कवरेज या अंक की गारंटी नहीं है।",
                  },
                ]
              : GROWTH_FAQS
          }
        />
      </section>
      <section className="growth-final">
        <p className="growth-eyebrow">
          {t("MAKE THE NEXT TOPIC CLICK", "अगला विषय समझें")}
        </p>
        <h2>{t("Start with one question.", "एक सवाल से शुरू करें।")}</h2>
        <a href="#try-preview" className="btn gold">
          {t("Try a free note preview →", "मुफ़्त नोट प्रीव्यू देखें →")}
        </a>
        <p>
          {t(
            "No account needed for the short preview.",
            "छोटे प्रीव्यू के लिए खाता ज़रूरी नहीं।",
          )}
        </p>
      </section>
    </div>
  );
}
