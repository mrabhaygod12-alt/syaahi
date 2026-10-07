"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http-client";
import { growthEvent } from "@/lib/growth/events-client";
import {
  UNIVERSITY_SAMPLES,
  learningLink,
  type NotePreview,
  type PreviewLanguage,
} from "@/lib/growth/samples";
export function PreviewPaper({
  preview,
  compact = false,
}: {
  preview: NotePreview;
  compact?: boolean;
}) {
  return (
    <article className={"growth-paper" + (compact ? " compact" : "")}>
      <div className="growth-paper-label">
        <span>SYAAHI / REVISION NOTES</span>
        <i>01</i>
      </div>
      <h3>{preview.title}</h3>
      <p className="growth-note-summary">{preview.summary}</p>
      {preview.points.map((p, i) => (
        <section key={i}>
          <b>
            {String(i + 1).padStart(2, "0")} / {p.heading}
          </b>
          <p>{p.text}</p>
        </section>
      ))}
      <div className="growth-recall">
        <b>RECALL CHECK</b>
        <p>{preview.question}</p>
        <details>
          <summary>Reveal answer / उत्तर देखें</summary>
          <p>{preview.answer}</p>
        </details>
      </div>
      <small>Made with Syaahi · syaahii.in</small>
    </article>
  );
}
export default function GuestPreview({
  language = "english",
}: {
  language?: PreviewLanguage;
}) {
  const [topic, setTopic] = useState("");
  const [lang, setLang] = useState(language);
  const [preview, setPreview] = useState<NotePreview>(
    UNIVERSITY_SAMPLES[0][language],
  );
  const [kind, setKind] = useState("sample");
  const [reading, setReading] = useState(UNIVERSITY_SAMPLES[0].reading);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const output = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const [outputLanguage, setOutputLanguage] = useState(language);
  const hi = lang === "hindi";
  const t = (en: string, hindi: string) => (hi ? hindi : en);
  useEffect(() => () => request.current?.abort(), []);
  async function make(selected = topic) {
    if (busy) return;
    setTopic(selected);
    setBusy(true);
    setError("");
    growthEvent("preview_start");
    request.current = new AbortController();
    try {
      const r = await requestJson(
        "/api/preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: selected, language: lang }),
          signal: request.current.signal,
        },
        30000,
      );
      if (!r.response.ok) throw new Error(r.data.error);
      setPreview(r.data.preview);
      setOutputLanguage(lang);
      setKind(r.data.kind);
      setReading(r.data.reading || "");
      setCreated(true);
      growthEvent("preview_ready");
      requestAnimationFrame(() => output.current?.focus());
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(e instanceof Error ? e.message : "Preview could not load.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="growth-try" id="try-preview">
      <div className="growth-try-copy">
        <p className="growth-eyebrow">
          {t("TRY BEFORE YOU SIGN UP", "बिना साइनअप आज़माएँ")}
        </p>
        <h2>
          {t(
            "Your topic. A clearer first page.",
            "आपका विषय। एक स्पष्ट पहला पन्ना।",
          )}
        </h2>
        <p>
          {t(
            "Get a short preview here. Create a free account to build, edit and download your full lesson PDF.",
            "यहाँ छोटा प्रीव्यू देखें। पूरा पाठ बनाएँ, संपादित करें और PDF डाउनलोड करने के लिए मुफ़्त खाता बनाएँ।",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void make();
          }}
        >
          <label htmlFor="preview-topic">
            {t("What are you studying?", "आप क्या पढ़ रहे हैं?")}
          </label>
          <input
            id="preview-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            minLength={3}
            maxLength={160}
            required
            placeholder={t(
              "Try DBMS normalization or OS deadlocks",
              "DBMS नॉर्मलाइज़ेशन या OS डेडलॉक लिखें",
            )}
            autoComplete="off"
            data-clarity-mask="true"
          />
          <div className="growth-input-actions">
            <select
              aria-label="Preview language"
              value={lang}
              onChange={(e) => setLang(e.target.value as PreviewLanguage)}
              disabled={busy}
            >
              <option value="english">English</option>
              <option value="hindi">हिंदी</option>
            </select>
            <button className="btn dark" disabled={busy}>
              {busy
                ? t("Preparing preview…", "प्रीव्यू तैयार हो रहा है…")
                : t("Preview my topic →", "मेरा विषय देखें →")}
            </button>
          </div>
        </form>
        <div className="growth-suggestions" aria-label="Sample topics">
          {UNIVERSITY_SAMPLES.map((s) => (
            <button
              key={s.id}
              disabled={busy}
              onClick={() => void make(s.topic)}
            >
              {s.subject}
            </button>
          ))}
        </div>
        {busy && (
          <p role="status">
            {t(
              "Condensing one idea and a recall check. Your account credits are not used.",
              "एक मुख्य विचार और अभ्यास प्रश्न तैयार हो रहा है। खाते के क्रेडिट नहीं लगेंगे।",
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="growth-error">
            {error}
          </p>
        )}
        {created && (
          <a
            className="growth-signup"
            href={`/signup?workspace=student&next=${encodeURIComponent(learningLink(topic, lang))}`}
            onClick={() => growthEvent("signup_start")}
          >
            {t(
              "Build my full lesson & PDF — sign up free ↗",
              "पूरा पाठ और PDF बनाएँ — मुफ़्त साइनअप ↗",
            )}
          </a>
        )}
        <small>
          {t(
            "Sample topics use original hand-authored examples. Other topics use AI and should be checked against your textbook.",
            "नमूना विषय स्वयं लिखे उदाहरण हैं। दूसरे विषयों में AI का उपयोग होता है; पाठ्यपुस्तक से जाँच करें।",
          )}
        </small>
      </div>
      <div
        className="growth-preview-output"
        ref={output}
        tabIndex={-1}
        aria-label="Note preview"
        aria-busy={busy}
      >
        <div className="growth-output-label">
          <span>
            {kind === "sample"
              ? t("Original sample · no AI wait", "मूल नमूना · तुरंत उपलब्ध")
              : t(
                  "AI topic preview · verify key facts",
                  "AI प्रीव्यू · तथ्य जाँचें",
                )}
          </span>
          <span>{outputLanguage === "hindi" ? "हिंदी" : "English"}</span>
        </div>
        <PreviewPaper preview={preview} />
        {reading && (
          <a
            className="growth-reading-link"
            href={reading}
            target="_blank"
            rel="noreferrer"
          >
            {t(
              "Further reading ↗ (external reference)",
              "और पढ़ें ↗ (बाहरी संदर्भ)",
            )}
          </a>
        )}
      </div>
    </div>
  );
}
