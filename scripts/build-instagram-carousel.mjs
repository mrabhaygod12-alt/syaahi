import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const output = path.join(
  process.cwd(),
  "marketing",
  "instagram",
  "syaahi-study-carousel",
);
await mkdir(output, { recursive: true });

const slides = [
  {
    tag: "A STUDY WORKFLOW, REIMAGINED",
    title: "One topic.<br><em>A whole study system.</em>",
    deck: "Turn the material you have into notes you can read, practice and revisit.",
    art: `<div class="cover-art"><div class="cover-note paper"><span class="scribble">make room for understanding</span><b>THE BIG IDEA</b><i></i><i></i><i class="short"></i><div class="mini-flow"><span>Understand</span><b>↓</b><span>Remember</span></div></div><div class="orbit o1">✦ NOTES</div><div class="orbit o2">↗ PRACTICE</div><div class="orbit o3">◷ REVISIT</div><div class="spark s1">✳</div><div class="spark s2">✦</div></div>`,
    foot: "Swipe through the Syaahi study loop",
    alt: "A notebook page sits at the center of three connected study actions: notes, practice and review.",
  },
  {
    tag: "01 · START WITH YOUR MATERIAL",
    title: "Bring what you<br>already have.",
    deck: "Begin with a topic, a document, a lecture recording or a supported YouTube source.",
    art: `<div class="source-stage"><div class="source-card source-a"><span class="source-icon">Aa</span><b>A topic</b><small>One question is enough</small><div class="fake-line"></div></div><div class="source-card source-b"><span class="source-icon">▤</span><b>A PDF</b><small>Keep the course source close</small><div class="fake-line"></div></div><div class="source-card source-c"><span class="source-icon">▶</span><b>A lecture</b><small>Transcript support can vary</small><div class="fake-line"></div></div><div class="source-arrow">↓</div><div class="input-pill">One starting point <strong>→</strong></div></div>`,
    foot: "Supported sources depend on access and transcript availability.",
    alt: "Three input cards show a topic, a PDF and a lecture feeding into one study workspace.",
  },
  {
    tag: "02 · MAKE THE NOTES YOURS",
    title: "Notes with a<br>learning shape.",
    deck: "Clear headings, explanations, examples and visual cues turn a topic into a notebook you can actually work through.",
    art: `<div class="open-book"><div class="book-page left-page"><span class="hand-label">key idea</span><h3>Digital evidence</h3><p>Information stored or sent by a digital device that can help answer an investigation question.</p><div class="highlight-line"></div><p class="tiny-copy">Preserve first. Examine a verified copy.</p><div class="page-number">01</div></div><div class="book-page right-page"><span class="hand-label">follow the trail</span><div class="flow-vertical"><span>Acquire</span><b>↓</b><span>Hash + preserve</span><b>↓</b><span>Analyze</span><b>↓</b><span>Report</span></div><div class="margin-note">keep a clear chain of custody</div><div class="page-number">02</div></div><div class="book-spine"></div></div>`,
    foot: "Handwritten-style pages, designed for comfortable revision.",
    alt: "An open handwritten-style notebook explains digital evidence and diagrams an acquire, preserve, analyze, report workflow.",
  },
  {
    tag: "03 · LEARN IN SMALLER STEPS",
    title: "Follow the idea,<br>one section at a time.",
    deck: "A lesson can break a broad subject into a starting point, key concepts and checkpoints you can return to.",
    art: `<div class="lesson-board"><div class="lesson-progress"><span>YOUR LESSON</span><b>01 / 05</b></div><div class="progress-line"><i></i></div><div class="lesson-row active"><span class="step">01</span><div><b>Start with the question</b><small>Build a useful overview</small></div><span class="check">✓</span></div><div class="lesson-row"><span class="step">02</span><div><b>Learn the core idea</b><small>Examples make it concrete</small></div></div><div class="lesson-row"><span class="step">03</span><div><b>Try a checkpoint</b><small>Pause and recall</small></div></div><div class="lesson-row muted"><span class="step">04</span><div><b>Connect the concepts</b><small>Keep moving at your pace</small></div></div></div>`,
    foot: "Read, pause, ask a question, then continue.",
    alt: "A lesson outline shows a learner moving from the opening question to core concepts and a checkpoint.",
  },
  {
    tag: "04 · ASK THE FOLLOW-UP",
    title: "Ask until it<br>clicks.",
    deck: "Use the lesson tutor to ask for a simpler explanation, a worked example or a clarification grounded in the material.",
    art: `<div class="chat-card"><div class="chat-top"><span class="status-dot"></span><b>LESSON TUTOR</b><span class="grounded">grounded in this lesson</span></div><div class="bubble user-bubble">Why do investigators hash digital evidence?</div><div class="bubble answer-bubble"><span class="tutor-mark">S</span><div><b>Think of it as a tamper check.</b><p>A cryptographic hash gives the evidence a digital fingerprint. Matching hashes before and after analysis help show the copy has not changed.</p><span class="source-chip">From this lesson · digital evidence</span></div></div><div class="chat-input">Ask a follow-up… <span>↗</span></div></div>`,
    foot: "Use AI explanations as a study aid; check important facts against your course source.",
    alt: "A lesson tutor answers why forensic investigators hash evidence, then labels the answer's lesson context.",
  },
  {
    tag: "05 · PRACTICE ACTIVE RECALL",
    title: "Turn ideas into<br>something you can recall.",
    deck: "Flashcards give you a small prompt, a moment to think and a clear answer to check.",
    art: `<div class="flash-stage"><div class="floating-card back-card"><span>ANSWER</span><h3>Confidentiality<br>Integrity<br>Availability</h3><small>The CIA triad</small></div><div class="floating-card front-card"><span>QUICK RECALL · 01</span><div class="card-stamp">?</div><h3>What are the<br>three goals of<br>the CIA triad?</h3><div class="tap-hint">Think first, then flip <b>↻</b></div></div><div class="recall-dots"><i></i><i></i><i></i><i></i><i></i><span>01 / 08</span></div></div>`,
    foot: "Recall first. Reveal the answer when you're ready.",
    alt: "A flashcard asks for the three parts of the CIA triad, with the answer shown on a second card behind it.",
  },
  {
    tag: "06 · CHECK WHAT STUCK",
    title: "Find the gap<br>before exam day.",
    deck: "A quiz turns the source material into questions, answer choices and feedback that help you spot what to revisit.",
    art: `<div class="quiz-window"><div class="quiz-head"><span>KNOWLEDGE CHECK</span><b>02 / 08</b></div><div class="quiz-bar"><i></i></div><h3>Which property helps show that evidence stayed unchanged?</h3><div class="quiz-option">A <span>Confidentiality</span></div><div class="quiz-option correct">B <span>Integrity</span><b>✓</b></div><div class="quiz-option">C <span>Availability</span></div><div class="quiz-feedback"><span>GOOD RECALL</span><p>Integrity is about maintaining accuracy and preventing unauthorized changes.</p></div></div>`,
    foot: "Practice from your lesson and review the explanation, not just the score.",
    alt: "A quiz asks which security property helps show evidence remained unchanged and gives a short explanation for integrity.",
  },
  {
    tag: "07 · TAKE IT WITH YOU",
    title: "Listen when<br>reading isn't practical.",
    deck: "Turn study material into audio and revisit the key ideas while you walk, commute or take a screen break.",
    art: `<div class="audio-player"><div class="audio-cover"><div class="cover-spark">✳</div><span>SYAAHI<br>STUDY AUDIO</span><div class="cover-book">▤</div></div><div class="audio-main"><span class="audio-label">AUDIO REVIEW · DIGITAL EVIDENCE</span><h3>Keep the key ideas<br>within reach.</h3><div class="waveform">${Array.from({ length: 38 }, (_, i) => `<i style="--h:${18 + ((i * 31 + 17) % 58)}px"></i>`).join("")}</div><div class="audio-controls"><span>0:46</span><b>▶</b><span>08:12</span></div></div></div>`,
    foot: "Listen with your device's available audio support.",
    alt: "A Syaahi audio review card displays a waveform and playback controls for a digital evidence lesson.",
  },
  {
    tag: "08 · KEEP THE WHOLE LOOP CONNECTED",
    title: "One source.<br>More than one way in.",
    deck: "Move from understanding to practice, and use the next review to find what still needs work.",
    art: `<div class="loop-map"><div class="loop-node source-node"><span>START</span><b>Your topic<br>or source</b></div><div class="loop-connector c-a">↘</div><div class="loop-node note-node"><span>MAKE</span><b>Visual<br>notes</b></div><div class="loop-connector c-b">↘</div><div class="loop-node lesson-node"><span>LEARN</span><b>Lesson<br>+ tutor</b></div><div class="loop-bottom"><div class="loop-connector c-c">↙</div><div class="loop-node quiz-node"><span>RECALL</span><b>Quiz<br>+ cards</b></div><div class="loop-connector c-d">↖</div><div class="loop-node revisit-node"><span>RETURN</span><b>Revisit the<br>hard parts</b></div></div><div class="loop-center">THE<br>STUDY<br>LOOP</div></div>`,
    foot: "Save your work and come back when it's time to revise.",
    alt: "A diagram connects a learner's source to notes, a lesson tutor, quizzes, flashcards and a return to difficult ideas.",
  },
  {
    tag: "YOUR NEXT STUDY SESSION",
    title: "Make room for<br><em>understanding.</em>",
    deck: "Try Syaahi with the topic you're studying next.",
    art: `<div class="cta-stack"><div class="cta-sheet sheet-3"><span>QUIZ</span><b>Can you explain<br>the key idea?</b><i>Practice · reflect · return</i></div><div class="cta-sheet sheet-2"><span>LESSON</span><b>Build a clear<br>learning path</b><i>One section at a time</i></div><div class="cta-sheet sheet-1"><span>NOTES</span><b>Start with a<br>single question</b><i>Topic · PDF · lecture</i></div><div class="cta-spark">✳</div></div><div class="cta-url">syaahii.in <span>↗</span></div>`,
    foot: "Save this guide · Share it with your study partner · Follow @abhay_hacks",
    alt: "Three layered study cards for notes, lessons and quizzes sit above the Syaahi website address and Instagram handle abhay_hacks.",
  },
];

const caption = `Some topics need more than a quick summary. They need a clear explanation, a way to practise, and a reason to come back to the tricky parts.\n\nThat is the study loop behind Syaahi: bring a topic or source, shape it into handwritten-style study notes, follow a lesson, ask a tutor, then practise with quizzes and flashcards. Audio review is there for the moments when you want to listen.\n\nStart with what you are studying next at https://www.syaahii.in/\n\nSave this carousel for revision season, share it with a friend, and follow @abhay_hacks for more.\n\n#Syaahi #StudyWithMe #ExamPrep #StudyNotes #HandwrittenNotes #ActiveRecall #Flashcards #StudyTips #AIForStudents #StudentLife #Revision #StudyGram`;

const altText = slides
  .map((slide, i) => `${String(i + 1).padStart(2, "0")}. ${slide.alt}`)
  .join("\n");

const caveatFont = await readFile(
  path.join(
    process.cwd(),
    "node_modules/@fontsource/caveat/files/caveat-latin-700-normal.woff2",
  ),
)
  .then((font) => font.toString("base64"))
  .catch(() => "");

const style = `
@font-face{font-family:Caveat;src:url(data:font/woff2;base64,${caveatFont}) format('woff2');font-weight:700}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#deded8;color:#183a33;font-family:Arial,'Segoe UI',sans-serif}body{display:grid;place-items:center}.slide{position:relative;width:1080px;height:1350px;overflow:hidden;padding:62px 72px 54px;background:#f7f2e8;display:flex;flex-direction:column;isolation:isolate}.slide:before{content:'';position:absolute;width:820px;height:820px;border-radius:50%;right:-360px;top:340px;background:radial-gradient(circle,#dce8d7 0,#e8ecdf 48%,transparent 71%);z-index:-2}.slide:after{content:'';position:absolute;width:420px;height:420px;border-radius:50%;left:-240px;bottom:-180px;background:radial-gradient(circle,#ecdcc2 0,transparent 72%);z-index:-2}.top{display:flex;align-items:center;justify-content:space-between;min-height:52px}.brand{display:flex;align-items:center;gap:13px;font:700 27px Georgia,serif;color:#214b40}.book-icon{width:42px;height:42px;border-radius:13px;background:#214b40;position:relative;display:grid;place-items:center;color:#f7f2e8;font-size:19px}.book-icon:after{content:'';position:absolute;left:20px;top:9px;height:23px;border-left:1px solid #f7f2e8}.slide-no{font-size:16px;color:#738077;letter-spacing:2px}.slide-no b{color:#214b40}.main{flex:1;display:flex;flex-direction:column;justify-content:center;padding:12px 2px 4px}.tag{font-size:17px;letter-spacing:3px;font-weight:700;color:#ae7533;margin-bottom:24px}.title{font-size:78px;line-height:1.045;letter-spacing:-2.6px;font-weight:750;margin:0;max-width:900px;color:#183a33}.title em{font-family:Caveat,Georgia,serif;font-weight:700;color:#8a4aa0;font-size:1.18em;letter-spacing:-1px}.deck{font-size:27px;line-height:1.45;color:#52645b;max-width:790px;margin:22px 0 0}.art{position:relative;height:570px;width:100%;margin-top:36px;display:grid;place-items:center}.foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #d6d9cf;padding-top:20px;color:#65756c;font-size:16px;letter-spacing:.2px}.foot b{color:#214b40;font-size:15px;letter-spacing:1.4px}.paper{background:#fffdf7;border:1px solid #ded9cc;border-radius:5px;box-shadow:0 20px 45px #344c3820}.cover-art{position:relative;width:100%;height:100%;display:grid;place-items:center}.cover-note{width:390px;height:440px;padding:42px 44px;transform:rotate(-4deg);position:relative;display:flex;flex-direction:column;gap:24px}.scribble{font:700 27px Caveat,Georgia,serif;color:#8a4aa0;transform:rotate(-2deg)}.cover-note>b{font:700 28px Georgia,serif;color:#214b40}.cover-note>i,.fake-line{display:block;height:11px;border-radius:8px;background:#e8ebe1;width:100%}.cover-note>i.short{width:62%}.mini-flow{display:grid;justify-items:center;gap:4px;margin-top:5px}.mini-flow span{padding:9px 26px;border:1px solid #8fa693;border-radius:8px;background:#f5f8f0;font-weight:700}.mini-flow b{color:#b67a34;font-size:22px}.orbit{position:absolute;padding:15px 23px;border-radius:30px;background:#fff;border:1px solid #d7ddcf;box-shadow:0 8px 20px #214b4013;font-size:15px;font-weight:700;letter-spacing:1px;color:#214b40}.o1{left:9%;top:15%}.o2{right:8%;top:36%;background:#efe4f2;color:#713b82}.o3{left:13%;bottom:12%;background:#e5eddf}.spark{position:absolute;color:#b67a34;font-size:46px}.s1{right:15%;top:13%}.s2{left:22%;bottom:7%;font-size:26px}.source-stage{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:center;width:100%;padding:20px 0 74px}.source-card{min-height:245px;padding:28px 24px;background:#fff;border:1px solid #dce0d6;border-radius:20px;box-shadow:0 18px 40px #214b4012;display:flex;flex-direction:column;align-items:flex-start;gap:14px}.source-card.source-b{transform:translateY(-24px);background:#f4f1e8}.source-card.source-c{transform:translateY(18px);background:#eaf0e5}.source-icon{width:54px;height:54px;border-radius:15px;background:#e6ecdf;display:grid;place-items:center;font:700 24px Georgia;color:#214b40}.source-card b{font:700 24px Georgia;color:#214b40}.source-card small{font-size:17px;line-height:1.35;color:#708076}.source-card .fake-line{height:8px;margin-top:auto}.source-arrow{position:absolute;left:calc(50% - 16px);bottom:31px;font-size:38px;color:#b67a34}.input-pill{position:absolute;bottom:0;left:50%;transform:translateX(-50%);background:#214b40;color:white;padding:17px 28px;border-radius:30px;font-size:18px;white-space:nowrap}.input-pill strong{margin-left:28px;color:#e8bd7c}.open-book{position:relative;width:840px;height:490px;display:grid;grid-template-columns:1fr 1fr;filter:drop-shadow(0 23px 35px #214b4019)}.book-page{background:#fffdf7;border:1px solid #e1dac9;padding:36px 35px;position:relative}.left-page{border-radius:20px 4px 4px 20px;transform:rotate(-1.2deg);box-shadow:inset -8px 0 20px #234b400a}.right-page{border-radius:4px 20px 20px 4px;transform:rotate(1.2deg);box-shadow:inset 8px 0 20px #234b400a}.book-spine{position:absolute;left:50%;height:100%;border-left:2px solid #d4cebd}.hand-label{font:700 22px Caveat,Georgia,serif;color:#a25472}.book-page h3{font:700 30px Georgia,serif;margin:14px 0;color:#214b40}.book-page p{font:19px/1.45 Georgia,serif;color:#53675c}.highlight-line{height:12px;background:#f2dd9f;border-radius:6px;width:88%;margin:24px 0}.book-page p.tiny-copy{font-size:16px;color:#7d8174}.page-number{position:absolute;bottom:22px;right:28px;color:#9b9a8c}.flow-vertical{display:grid;justify-items:center;gap:2px;margin:18px auto;width:220px}.flow-vertical span{padding:8px 18px;background:#f2f5ed;border:1px solid #9caf9b;border-radius:8px;font-weight:700}.flow-vertical b{font-size:18px;color:#b67a34}.margin-note{font:700 20px Caveat,Georgia,serif;color:#825181;position:absolute;bottom:65px;left:42px;transform:rotate(-4deg)}.lesson-board{width:760px;padding:30px 38px;background:#fff;border:1px solid #dce1d7;border-radius:22px;box-shadow:0 20px 48px #214b4014}.lesson-progress{display:flex;justify-content:space-between;font-size:15px;letter-spacing:1.5px;color:#79877c}.lesson-progress b{color:#214b40}.progress-line{height:8px;background:#e9ece4;border-radius:6px;margin:15px 0 24px}.progress-line i{display:block;width:28%;height:100%;border-radius:6px;background:#8a4aa0}.lesson-row{display:flex;align-items:center;gap:18px;padding:18px 10px;border-top:1px solid #edf0e9;color:#25463b}.lesson-row.active{background:#f2f6ef;border-radius:14px}.lesson-row .step{display:grid;place-items:center;width:43px;height:43px;border:1px solid #b7c7b5;border-radius:50%;font-weight:700;background:white}.lesson-row>div{display:grid;gap:7px;flex:1}.lesson-row b{font:700 21px Georgia,serif}.lesson-row small{font-size:16px;color:#78857b}.lesson-row .check{color:#4c8a5e;font-size:23px}.lesson-row.muted{opacity:.53}.chat-card{width:800px;padding:26px;background:#fff;border:1px solid #dddccd;border-radius:22px;box-shadow:0 20px 45px #214b4017}.chat-top{display:flex;align-items:center;gap:10px;font-size:14px;letter-spacing:1.6px;color:#214b40;border-bottom:1px solid #e7e6dc;padding-bottom:16px}.status-dot{width:10px;height:10px;border-radius:50%;background:#64a673}.grounded{margin-left:auto;color:#79877d;letter-spacing:0;font-size:14px}.bubble{padding:18px 22px;border-radius:18px;margin-top:18px;font-size:18px;line-height:1.45}.user-bubble{background:#f2f3ed;margin-left:140px}.answer-bubble{display:flex;gap:14px;background:#eef4ea;margin-right:45px}.tutor-mark{flex:none;width:36px;height:36px;display:grid;place-items:center;background:#214b40;color:white;border-radius:12px;font:700 18px Georgia}.answer-bubble b{font:700 20px Georgia}.answer-bubble p{font-size:17px;line-height:1.5;color:#51645a;margin:9px 0}.source-chip{display:inline-block;background:#fff;padding:8px 12px;border:1px solid #d9e1d4;border-radius:20px;color:#6c7f71;font-size:13px}.chat-input{margin-top:20px;padding:15px 19px;border:1px solid #dcded3;border-radius:14px;color:#98a097;display:flex;justify-content:space-between}.chat-input span{color:#214b40;font-size:22px}.flash-stage{position:relative;width:740px;height:500px;display:grid;place-items:center}.floating-card{position:absolute;width:430px;height:350px;border-radius:24px;padding:32px;display:flex;flex-direction:column;box-shadow:0 22px 42px #214b401b}.floating-card span{font-size:14px;letter-spacing:2px;color:#7a897c;font-weight:700}.front-card{background:#fffdf7;border:1px solid #e2ddcf;z-index:2;transform:rotate(-3deg);justify-content:space-between}.front-card h3{font:700 32px/1.23 Georgia,serif;color:#214b40;margin:20px 0}.card-stamp{position:absolute;right:30px;top:55px;font:700 48px Caveat,Georgia,serif;color:#b57936}.tap-hint{color:#819085;font-size:15px}.tap-hint b{margin-left:12px;color:#8a4aa0;font-size:21px}.back-card{background:#e7eee0;border:1px solid #cad8c3;transform:translate(155px,35px) rotate(7deg);justify-content:center;padding-left:52px}.back-card h3{font:700 25px/1.6 Georgia,serif;color:#214b40}.back-card small{color:#78877d}.recall-dots{position:absolute;bottom:8px;display:flex;align-items:center;gap:9px}.recall-dots i{width:10px;height:10px;border-radius:50%;background:#bdcbb8}.recall-dots i:first-child{background:#8a4aa0}.recall-dots span{margin-left:13px;color:#718074;font-size:14px;letter-spacing:1px}.quiz-window{width:760px;padding:32px;background:#fff;border:1px solid #dddccd;border-radius:24px;box-shadow:0 20px 45px #214b4015}.quiz-head{display:flex;justify-content:space-between;font-size:14px;letter-spacing:1.5px;color:#68776c}.quiz-head b{color:#214b40}.quiz-bar{height:8px;background:#ebeee7;border-radius:7px;margin:15px 0 24px}.quiz-bar i{display:block;height:100%;width:27%;background:#8a4aa0;border-radius:7px}.quiz-window h3{font:700 25px/1.35 Georgia,serif;max-width:620px;margin:0 0 20px}.quiz-option{height:54px;border:1px solid #dce1d7;border-radius:12px;margin:11px 0;display:flex;align-items:center;padding:0 16px;gap:14px;color:#889188}.quiz-option span{color:#344c40;font-size:18px}.quiz-option.correct{background:#edf5e9;border-color:#84a785;color:#438455}.quiz-option b{margin-left:auto}.quiz-feedback{margin-top:19px;background:#f3f5ed;border-left:4px solid #6e9573;border-radius:4px 14px 14px 4px;padding:16px 18px}.quiz-feedback span{font-size:13px;letter-spacing:1.5px;font-weight:700;color:#55825d}.quiz-feedback p{margin:8px 0 0;line-height:1.45;color:#54645b}.audio-player{width:790px;height:390px;background:#fff;border:1px solid #deddd2;border-radius:24px;box-shadow:0 20px 50px #214b4018;padding:28px;display:flex;gap:28px;align-items:center}.audio-cover{width:280px;height:320px;border-radius:18px;background:linear-gradient(155deg,#254d42,#59755f);color:#f8f3e9;padding:25px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;font:700 21px Georgia,serif;letter-spacing:2px}.audio-cover:after{content:'';position:absolute;width:270px;height:270px;border:1px solid #ffffff3a;border-radius:50%;right:-90px;bottom:-90px;box-shadow:0 0 0 22px #ffffff0d,0 0 0 50px #ffffff0d}.cover-spark{font-size:47px;color:#e3b46e}.cover-book{font-size:76px;color:#e3b46e;align-self:flex-end}.audio-main{flex:1}.audio-label{font-size:12px;letter-spacing:1.5px;color:#8a4aa0;font-weight:700}.audio-main h3{font:700 27px/1.3 Georgia,serif;color:#214b40}.waveform{height:92px;display:flex;align-items:center;justify-content:space-between;gap:5px;border-bottom:1px solid #dfe3d9}.waveform i{display:block;width:7px;height:var(--h);border-radius:5px;background:#72947b}.waveform i:nth-child(3n){background:#b67a34}.audio-controls{display:flex;justify-content:space-between;align-items:center;margin-top:18px;color:#738178;font-size:14px}.audio-controls b{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#214b40;color:white;padding-left:4px;font-size:18px}.loop-map{width:800px;height:520px;position:relative}.loop-node{position:absolute;width:188px;min-height:120px;padding:19px;background:#fff;border:1px solid #dbe1d6;border-radius:18px;box-shadow:0 12px 26px #214b4010;display:grid;gap:9px;z-index:2}.loop-node span{font-size:12px;letter-spacing:2px;color:#9b7138;font-weight:700}.loop-node b{font:700 20px/1.2 Georgia,serif;color:#214b40}.source-node{left:20px;top:38px}.note-node{left:290px;top:5px;background:#f7f0e3}.lesson-node{right:20px;top:38px;background:#eee7f1}.quiz-node{right:165px;bottom:15px;background:#edf3e9}.revisit-node{left:160px;bottom:15px;background:#fff}.loop-connector{position:absolute;font-size:46px;color:#8a4aa0;z-index:3}.c-a{left:225px;top:53px;transform:rotate(-11deg)}.c-b{right:222px;top:53px;transform:rotate(9deg)}.c-c{right:351px;bottom:115px;transform:rotate(65deg)}.c-d{left:352px;bottom:115px;transform:rotate(-68deg)}.loop-bottom{position:absolute;inset:0}.loop-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:124px;height:124px;border-radius:50%;display:grid;place-items:center;text-align:center;background:#214b40;color:#f7f2e8;font:700 14px/1.3 Georgia,serif;letter-spacing:1.4px;z-index:1;box-shadow:0 0 0 12px #f7f2e8}.cta-stack{position:relative;width:760px;height:425px}.cta-sheet{position:absolute;width:510px;height:260px;border:1px solid #d6ded1;border-radius:20px;box-shadow:0 18px 36px #214b4019;padding:28px 34px;display:flex;flex-direction:column;justify-content:space-between}.cta-sheet span{font-size:13px;letter-spacing:2px;color:#ae7533;font-weight:700}.cta-sheet b{font:700 28px/1.2 Georgia,serif;color:#214b40}.cta-sheet i{font-style:normal;color:#77857b}.sheet-3{background:#eee6f0;transform:rotate(7deg);right:20px;top:50px}.sheet-2{background:#e9efe4;transform:rotate(-5deg);left:55px;top:55px}.sheet-1{background:#fffdf7;transform:rotate(1deg);left:130px;top:125px;z-index:2}.cta-spark{position:absolute;right:65px;bottom:12px;color:#b67a34;font-size:58px;z-index:4}.cta-url{position:absolute;bottom:0;left:50%;transform:translateX(-50%);display:flex;gap:35px;align-items:center;background:#214b40;color:#fff;padding:18px 32px;border-radius:40px;font:700 24px Georgia,serif;box-shadow:0 10px 26px #214b4030}.cta-url span{color:#e7b477}.contact-sheet{margin:0;width:1000px;background:#f7f2e8;padding:32px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.contact-sheet figure{margin:0}.contact-sheet img{display:block;width:100%;border-radius:8px;box-shadow:0 6px 16px #214b401c}.contact-sheet figcaption{text-align:center;padding:8px;color:#214b40;font:700 13px Arial,sans-serif}
`;

const htmlForSlide = (slide, index) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body><section class="slide"><header class="top"><div class="brand"><span class="book-icon">▤</span><span>Syaahi</span></div><div class="slide-no"><b>${String(index + 1).padStart(2, "0")}</b> / 10</div></header><main class="main"><div class="tag">${slide.tag}</div><h1 class="title">${slide.title}</h1><p class="deck">${slide.deck}</p><div class="art">${slide.art}</div></main><footer class="foot"><span>${slide.foot}</span><b>${index === slides.length - 1 ? "@ABHAY_HACKS" : "SWIPE  →"}</b></footer></section></body></html>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 1,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let i = 0; i < slides.length; i += 1) {
    await page.setContent(htmlForSlide(slides[i], i), {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".slide").screenshot({
      path: path.join(output, `slide-${String(i + 1).padStart(2, "0")}.png`),
      animations: "disabled",
    });
  }

  const thumbs = [];
  for (let i = 0; i < slides.length; i += 1) {
    const filename = `slide-${String(i + 1).padStart(2, "0")}.png`;
    const bytes = await readFile(path.join(output, filename));
    thumbs.push(
      `<figure><img src="data:image/png;base64,${bytes.toString("base64")}"><figcaption>${String(i + 1).padStart(2, "0")} / 10</figcaption></figure>`,
    );
  }
  const contact = await browser.newPage({
    viewport: { width: 1000, height: 1800 },
  });
  await contact.setContent(
    `<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#e8e6de}.contact-sheet{width:1000px;padding:32px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.contact-sheet figure{margin:0}.contact-sheet img{display:block;width:100%;border-radius:8px;box-shadow:0 6px 16px #214b401c}.contact-sheet figcaption{text-align:center;padding:8px;color:#214b40;font:700 13px Arial}</style></head><body><main class="contact-sheet">${thumbs.join("")}</main></body></html>`,
    { waitUntil: "load" },
  );
  await contact.locator(".contact-sheet").screenshot({
    path: path.join(output, "contact-sheet.png"),
  });
} finally {
  await browser.close();
}

await writeFile(path.join(output, "instagram-caption.md"), `${caption}\n`);
await writeFile(
  path.join(output, "alt-text.md"),
  `# Carousel alt text\n\n${altText}\n`,
);
await writeFile(
  path.join(output, "README.md"),
  `# Syaahi Instagram carousel\n\nTen 1080 × 1350 PNG slides, ready for an Instagram 4:5 carousel. Upload slide-01 through slide-10 in order. The caption and per-slide alt text are included. The artwork uses verified Syaahi features and avoids user-count or learning-outcome claims.\n\nRun npm run make:carousel to regenerate the PNGs.\n`,
);
console.log(`Created ${slides.length} carousel slides in ${output}`);
