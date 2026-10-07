export type PreviewLanguage = "english" | "hindi";
export interface NotePreview {
  title: string;
  summary: string;
  points: { heading: string; text: string }[];
  question: string;
  answer: string;
}
export const SAMPLE_NOTES = [
  {
    id: "newton",
    subject: "Physics",
    topic: "Newton's first law",
    match: /newton(?:'s)?\s+(?:first|1st)\s+law|inertia|न्यूटन का पहला नियम|जड़त्व/i,
    reading:
      "https://openstax.org/books/college-physics-2e/pages/4-2-newtons-first-law-of-motion-inertia",
    english: {
      title: "Newton's first law",
      summary:
        "A change in velocity needs a net external force. Balanced forces do not change velocity.",
      points: [
        {
          heading: "Net force",
          text: "Add forces as vectors. If their sum is zero, acceleration is zero.",
        },
        {
          heading: "Inertia",
          text: "Mass measures resistance to acceleration. Greater mass needs more force for the same acceleration.",
        },
        {
          heading: "Everyday example",
          text: "A moving puck slows because friction acts on it. Motion alone does not require a continuing net force.",
        },
      ],
      question: "Can an object move when its net force is zero?",
      answer: "Yes. It can move at constant velocity in a straight line.",
    },
    hindi: {
      title: "न्यूटन का पहला नियम",
      summary:
        "वेग बदलने के लिए परिणामी बाहरी बल चाहिए। संतुलित बल वेग नहीं बदलते।",
      points: [
        {
          heading: "परिणामी बल",
          text: "बलों का सदिश योग करें। कुल बल शून्य है तो त्वरण शून्य होगा।",
        },
        {
          heading: "जड़त्व",
          text: "द्रव्यमान त्वरण का प्रतिरोध दर्शाता है। समान त्वरण के लिए अधिक द्रव्यमान को अधिक बल चाहिए।",
        },
        {
          heading: "उदाहरण",
          text: "चलती वस्तु घर्षण के कारण धीमी होती है। केवल गति बनाए रखने के लिए परिणामी बल आवश्यक नहीं है।",
        },
      ],
      question: "क्या कुल बल शून्य होने पर वस्तु चल सकती है?",
      answer: "हाँ। वह सीधी रेखा में स्थिर वेग से चल सकती है।",
    },
  },
  {
    id: "photosynthesis",
    subject: "Biology",
    topic: "Photosynthesis",
    match: /photosynth|प्रकाश संश्लेषण/i,
    reading:
      "https://openstax.org/books/biology-2e/pages/8-1-overview-of-photosynthesis",
    english: {
      title: "Photosynthesis: light to stored energy",
      summary:
        "Photosynthesis uses light energy to help build carbohydrates from carbon dioxide and water.",
      points: [
        {
          heading: "Capture light",
          text: "Pigments absorb light. The light-dependent reactions produce ATP and NADPH, releasing oxygen from water.",
        },
        {
          heading: "Build sugars",
          text: "The Calvin cycle uses carbon dioxide, ATP and NADPH to produce molecules used to make carbohydrates.",
        },
        {
          heading: "Avoid this mistake",
          text: "The released oxygen comes from water. Plants also carry out cellular respiration.",
        },
      ],
      question: "Why are photosynthesis and respiration different?",
      answer:
        "Photosynthesis stores captured energy in organic molecules; respiration releases usable energy from those molecules.",
    },
    hindi: {
      title: "प्रकाश से संचित ऊर्जा",
      summary:
        "प्रकाश संश्लेषण में प्रकाश ऊर्जा से कार्बन डाइऑक्साइड और जल से कार्बोहाइड्रेट बनते हैं।",
      points: [
        {
          heading: "प्रकाश ग्रहण",
          text: "वर्णक प्रकाश सोखते हैं। प्रकाश-निर्भर अभिक्रियाएँ ATP और NADPH बनाती हैं; जल से ऑक्सीजन निकलती है।",
        },
        {
          heading: "शर्करा निर्माण",
          text: "कैल्विन चक्र कार्बन डाइऑक्साइड, ATP और NADPH का उपयोग करके कार्बोहाइड्रेट के लिए अणु बनाता है।",
        },
        {
          heading: "सामान्य गलती",
          text: "मुक्त ऑक्सीजन जल से आती है। पौधों में कोशिकीय श्वसन भी होता है।",
        },
      ],
      question: "प्रकाश संश्लेषण और श्वसन में क्या अंतर है?",
      answer:
        "प्रकाश संश्लेषण ऊर्जा संचित करता है; श्वसन कार्बनिक अणुओं से उपयोगी ऊर्जा निकालता है।",
    },
  },
  {
    id: "binary-search",
    subject: "Computer science",
    topic: "Binary search",
    match: /binary search|बाइनरी|द्विआधारी खोज/i,
    reading:
      "https://runestone.academy/ns/books/published/pythonds3/SortSearch/TheBinarySearch.html",
    english: {
      title: "Binary search: halve the work",
      summary:
        "Search a sorted list by comparing the target with its middle item and keeping only the possible half.",
      points: [
        {
          heading: "Start sorted",
          text: "The ordering lets you decide which half to discard. An unsorted list does not support this reasoning.",
        },
        {
          heading: "Trace it",
          text: "Find 8 in [2, 4, 6, 8, 10]. Compare 6; keep [8, 10]; then compare 8.",
        },
        {
          heading: "Complexity",
          text: "Each comparison roughly halves the remaining interval, giving logarithmic worst-case comparisons.",
        },
      ],
      question: "What happens when no items remain?",
      answer:
        "The target is absent. Stop rather than searching the same interval again.",
    },
    hindi: {
      title: "बाइनरी सर्च: आधा काम",
      summary:
        "क्रमबद्ध सूची में लक्ष्य को बीच के तत्व से मिलाएँ और केवल सम्भव आधे हिस्से में खोजें।",
      points: [
        {
          heading: "पहले क्रम देखें",
          text: "क्रम के कारण सही आधा हिस्सा चुना जा सकता है। बिना क्रम की सूची पर यह तर्क लागू नहीं होता।",
        },
        {
          heading: "उदाहरण",
          text: "[2, 4, 6, 8, 10] में 8 खोजें। पहले 6 से तुलना करें; [8, 10] रखें और 8 से तुलना करें।",
        },
        {
          heading: "जटिलता",
          text: "हर तुलना में खोज क्षेत्र लगभग आधा होता है। सबसे खराब स्थिति में तुलनाएँ लघुगणकीय होती हैं।",
        },
      ],
      question: "जब कोई तत्व बाकी न बचे तो क्या होगा?",
      answer:
        "लक्ष्य सूची में नहीं है। उसी हिस्से में दोबारा खोजते रहने के बजाय रुकें।",
    },
  },
] satisfies Array<{
  id: string;
  subject: string;
  topic: string;
  match: RegExp;
  reading: string;
  english: NotePreview;
  hindi: NotePreview;
}>;
export const STARTER_TOPICS: Record<string, string[]> = {
  physics: [
    "Newton's first law",
    "Electrostatics: electric field and potential",
    "Ohm's law and circuits",
    "Refraction and lenses",
  ],
  chemistry: [
    "Mole concept: worked calculations",
    "Periodic trends",
    "Chemical bonding",
    "Acids, bases and pH",
  ],
  biology: [
    "Photosynthesis",
    "Mitosis and meiosis",
    "DNA replication",
    "Human circulatory system",
  ],
  maths: [
    "Quadratic equations",
    "Derivatives: first principles",
    "Probability: conditional events",
    "Trigonometric identities",
  ],
  history: [
    "Indian national movement: timeline",
    "Causes of the French Revolution",
    "Industrial Revolution",
    "The Indian Constitution: key principles",
  ],
  "computer-science": [
    "Binary search",
    "DBMS normalization: 10-mark answer",
    "Operating systems: deadlocks",
    "Computer networks: TCP and UDP",
  ],
  interview: [
    "Explain binary search with a trace",
    "SQL joins and examples",
    "REST API design",
    "STAR method: structure your own experience",
  ],
  "hindi-medium": [
    "न्यूटन का पहला नियम",
    "प्रकाश संश्लेषण",
    "द्विघात समीकरण",
    "भारतीय संविधान: मुख्य सिद्धांत",
  ],
};
export const UNIVERSITY_SAMPLES = [
  SAMPLE_NOTES[2],
  {
    id: "dbms",
    subject: "DBMS · UG / PG",
    topic: "DBMS normalization",
    match: /normaliz|normalis|नॉर्मलाइज|सामान्यीकरण/i,
    reading:
      "https://cvw.cac.cornell.edu/RelationalDBs/design-create/third_normal_form",
    english: {
      title: "Normalization: design around dependencies",
      summary:
        "Organize relational tables to reduce repeated facts and avoid update, insertion and deletion anomalies.",
      points: [
        {
          heading: "Start with dependencies",
          text: "Identify candidate keys and functional dependencies before deciding which table decomposition is valid.",
        },
        {
          heading: "Build to 3NF",
          text: "A non-trivial dependency X → A satisfies 3NF when X is a superkey or A belongs to a candidate key.",
        },
        {
          heading: "Check the result",
          text: "Aim for a lossless join and preserve useful dependencies. Normalization does not automatically make every query faster.",
        },
      ],
      question:
        "Why can repeating a department name in many student rows cause trouble?",
      answer:
        "An update may change only some rows, leaving inconsistent department names. Separate facts by their dependencies.",
    },
    hindi: {
      title: "नॉर्मलाइज़ेशन: निर्भरता से डिज़ाइन",
      summary:
        "बार-बार दोहराए तथ्य और अपडेट, इंसर्ट तथा डिलीट की समस्याएँ कम करने के लिए रिलेशनल टेबल व्यवस्थित करें।",
      points: [
        {
          heading: "निर्भरता पहचानें",
          text: "टेबल विभाजन से पहले कैंडिडेट की और फंक्शनल डिपेंडेंसी पहचानें।",
        },
        {
          heading: "3NF जाँचें",
          text: "गैर-साधारण X → A निर्भरता में X सुपरकी हो या A किसी कैंडिडेट की का हिस्सा हो, तो 3NF की शर्त पूरी होती है।",
        },
        {
          heading: "परिणाम जाँचें",
          text: "लॉसलेस जॉइन और उपयोगी निर्भरताएँ बनाए रखें। नॉर्मलाइज़ेशन हर क्वेरी को स्वतः तेज़ नहीं बनाता।",
        },
      ],
      question:
        "कई छात्र पंक्तियों में विभाग का नाम दोहराने से क्या समस्या है?",
      answer:
        "कुछ पंक्तियों में नाम बदलने और कुछ में न बदलने से असंगत डेटा बन सकता है। तथ्य उनकी निर्भरताओं के अनुसार अलग करें।",
    },
  },
  {
    id: "operating-systems",
    subject: "Operating systems · UG / PG",
    topic: "Operating systems: deadlocks",
    match: /deadlock|डेडलॉक/i,
    reading: "https://mit-pdos.github.io/xv6-riscv-book/lock.html",
    english: {
      title: "Deadlocks: a cycle of waiting",
      summary:
        "A group of processes can stop making progress when each waits for a resource held by another in the group.",
      points: [
        {
          heading: "Four necessary conditions",
          text: "Mutual exclusion, hold and wait, no preemption and circular wait must coexist for a resource deadlock.",
        },
        {
          heading: "Prevent or avoid",
          text: "Prevention breaks a necessary condition. Avoidance checks whether granting a request leaves a safe allocation state.",
        },
        {
          heading: "Do not confuse",
          text: "Starvation is indefinite delay while others progress. A long wait alone does not prove deadlock.",
        },
      ],
      question: "How can a consistent lock order help?",
      answer:
        "Requiring all threads to acquire locks in the same order can prevent a circular wait among those locks.",
    },
    hindi: {
      title: "डेडलॉक: प्रतीक्षा का चक्र",
      summary:
        "जब हर प्रक्रिया समूह की दूसरी प्रक्रिया के संसाधन की प्रतीक्षा करे, तो समूह की प्रगति रुक सकती है।",
      points: [
        {
          heading: "चार आवश्यक शर्तें",
          text: "म्यूचुअल एक्सक्लूज़न, होल्ड एंड वेट, नो प्रीएम्प्शन और सर्कुलर वेट साथ होने चाहिए।",
        },
        {
          heading: "रोकें या बचें",
          text: "प्रिवेंशन एक आवश्यक शर्त तोड़ता है। अवॉइडेंस जाँचता है कि अनुरोध देने के बाद आवंटन सुरक्षित रहेगा या नहीं।",
        },
        {
          heading: "अंतर समझें",
          text: "स्टार्वेशन में कुछ प्रक्रियाएँ आगे बढ़ती हैं जबकि कोई प्रक्रिया लंबे समय तक वंचित रहती है। लंबी प्रतीक्षा अकेले डेडलॉक का प्रमाण नहीं।",
        },
      ],
      question: "एक समान लॉक क्रम कैसे मदद करता है?",
      answer:
        "सभी थ्रेड एक ही क्रम में लॉक लें तो उन लॉक के बीच सर्कुलर वेट रोका जा सकता है।",
    },
  },
] satisfies typeof SAMPLE_NOTES;
export const DEPARTMENTS = [
  "CSE",
  "Information technology",
  "BCA / MCA",
  "Data science / AI & ML",
  "Cybersecurity",
  "ECE / computer engineering",
  "Other",
];
export function learningLink(
  topic: string,
  language: PreviewLanguage = "english",
) {
  return `/dashboard?topic=${encodeURIComponent(topic.slice(0, 160))}&language=${language}`;
}
