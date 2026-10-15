import { SITE } from "@/lib/seo";
export const VIDEO_NOTE_FAQS = [
  {
    q: "How do I make AI-generated notes from a YouTube video?",
    a: "Sign in to Syaahii, paste a public YouTube lecture link into the learning workspace and select Prepare. Review the extracted source and outline before generating notes. Completed notes support editing, printable PDF export, lesson chat, quizzes and flashcards.",
  },
  {
    q: "What happens if a YouTube video has no transcript?",
    a: "Syaahii first tries available captions. With a configured video-reading provider, it can attempt an AI-extracted digest of the public video. The digest is labelled as AI-extracted and must be reviewed. If reliable reading is unavailable, upload a recording you are allowed to use or paste a transcript. Syaahii does not invent a lecture from its title.",
  },
  {
    q: "Can Syaahii read every YouTube link?",
    a: "No. The current limit is a public lecture up to 60 minutes. Private, unavailable, blocked or unsupported videos may need another source. Video reading depends on provider access, limits and availability.",
  },
  {
    q: "Will a long lecture cause a request timeout?",
    a: "Video reading runs as a saved background job. The workspace checks its progress with short requests. Preparing the same link again resumes the owned job, so a closed browser does not lose the queue record. Processing still depends on a running worker; sleeping services can delay it.",
  },
  {
    q: "Are the notes guaranteed to be accurate?",
    a: "No. AI may omit context or make mistakes. Check the extracted material, source references, formulas and examples against the lecture. An AI-extracted digest is not a verbatim transcript or proof of a timestamp.",
  },
];
export const AI_NOTE_FAQS = [
  {
    q: "What are AI-generated notes?",
    a: "AI-generated notes turn supplied material or a selected topic into structured study content. Syaahii lets you review an outline before generation, then edit handwritten-style notes with definitions, examples, comparisons, diagrams and takeaways.",
  },
  {
    q: "Which sources can I use?",
    a: "Use a topic, pasted material, a PDF, a supported public YouTube lecture or a recording you are allowed to use. Source availability and extraction limits vary. Review extracted text and scans before generating.",
  },
  {
    q: "Does Syaahii support university computer science?",
    a: "Yes. Syaahii focuses on UG and PG study, including CSE, IT, BCA and MCA topics such as DBMS, algorithms, operating systems, networks and machine learning. You can specify your syllabus, goal and language.",
  },
  {
    q: "Can I edit, download and practise from my notes?",
    a: "Yes. Saved lessons support section editing, printable PDF export, source-aware chat, quizzes and flashcards. Completed sections remain saved if generation is interrupted.",
  },
  {
    q: "Can I try it before signing up?",
    a: "The homepage offers a short guest topic preview. A verified account is needed for a full saved lesson and its private practice workspace. See the pricing page for current credits and plans.",
  },
];
export function notesSchema(video = false) {
  const path = video ? "/youtube-video-to-notes" : "/ai-generated-notes";
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE.url}${path}#software`,
    name: video ? "Syaahii YouTube lecture notes" : "Syaahii AI study notes",
    url: SITE.url + path,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web browser",
    description: video
      ? "Review public lecture sources and generate editable study notes, with caption and video-digest fallbacks."
      : "Create editable, structured study notes with diagrams, PDF export and recall practice.",
    featureList: [
      "Source review",
      "Editable outline",
      "Illustrated study atlas",
      "PDF export",
      "Lesson chat",
      "Quizzes",
      "Flashcards",
    ],
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}
