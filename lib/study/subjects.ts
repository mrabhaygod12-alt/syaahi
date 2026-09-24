export interface Subject {
  slug: string;
  name: string;
  desc: string;
  match: string[];
}

export const SUBJECTS: Subject[] = [
  {
    slug: "physics",
    name: "Physics",
    desc: "Laws, derivations, circuits, optics and mechanics — one page per concept.",
    match: ["physics"],
  },
  {
    slug: "chemistry",
    name: "Chemistry",
    desc: "Reactions, mole concept, periodic trends and organic mechanisms.",
    match: ["chemistry"],
  },
  {
    slug: "biology",
    name: "Biology",
    desc: "Diagrams-first notes: photosynthesis, cell division, human systems.",
    match: ["biology"],
  },
  {
    slug: "maths",
    name: "Maths",
    desc: "Identities, theorems and step-by-step solved patterns.",
    match: ["maths"],
  },
  {
    slug: "history",
    name: "History",
    desc: "Timelines, causes-effects chains and map-point revision.",
    match: ["history"],
  },
  {
    slug: "computer-science",
    name: "Computer Science",
    desc: "Algorithms, DBMS, OS and CN — tracing-friendly pages.",
    match: ["cs", "computer"],
  },
  {
    slug: "interview",
    name: "Interview Prep",
    desc: "Cloud, DBMS, DSA and HR rounds in crisp one-pagers.",
    match: ["interview"],
  },
  {
    slug: "hindi-medium",
    name: "Hindi Medium",
    desc: "हिंदी माध्यम नोट्स — सरल भाषा में अवधारणाएँ और अभ्यास।",
    match: ["hindi"],
  },
];
