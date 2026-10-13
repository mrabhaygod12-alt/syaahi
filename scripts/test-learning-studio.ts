import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-learning-studio-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  WORKER_MODE: "external",
  APP_ROLE: "all",
  GROQ_API_KEY: "fixture-provider-key",
});
async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    replica = await (
      await import("mongodb-memory-server")
    ).MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  const originalFetch = globalThis.fetch;
  try {
    const auth = await import("../lib/auth/server"),
      jobs = await import("../lib/jobs/store");
    const { markEmailVerified } = await import("../lib/billing/rewards");
    const practice = await import("../app/api/practice/route"),
      quiz = await import("../app/api/student/quiz/route");
    const { readState } = await import("../lib/study/state");
    const { questionId, attemptQuestionIds } =
      await import("../lib/study/quiz");
    const { practiceSettings, practiceSources } =
      await import("../lib/study/practice");
    const owner = await auth.register(
      "CS learner",
      "learning-studio@example.test",
      "safe-fixture-password",
    );
    const other = await auth.register(
      "Other learner",
      "learning-studio-other@example.test",
      "safe-fixture-password",
    );
    await markEmailVerified(owner.id);
    await markEmailVerified(other.id);
    const session = async (u: any) =>
      (await auth.startSession(u, new Request("http://localhost:3198"))).headers
        .get("set-cookie")!
        .split(";")[0];
    const cookie = await session(owner),
      foreign = await session(other);
    const req = (body?: unknown, c = cookie, path = "/api/student/quiz") =>
      new NextRequest("http://localhost:3198" + path, {
        method: body ? "POST" : "GET",
        headers: {
          cookie: c,
          "content-type": "application/json",
          origin: "http://localhost:3198",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const job = await jobs.createJob(
      owner.id,
      ["DBMS normalization", "Transactions"],
      "concise",
      { language: "english", context: "Private syllabus" },
    );
    const lease = (await jobs.claimJob(job.id))!;
    const pages = [
      {
        topic: "DBMS normalization",
        markdown:
          "Normalization reduces redundant data. First normal form requires atomic values.",
        provider: "fixture",
        model: "fixture",
      },
      {
        topic: "Transactions",
        markdown:
          "Atomicity means all operations succeed together or none are committed. Isolation separates concurrent transactions.",
        provider: "fixture",
        model: "fixture",
      },
    ];
    for (let i = 0; i < pages.length; i++)
      await jobs.commitPage(job.id, lease.token, i, pages[i]);
    await jobs.finishJob(job.id, lease.token);
    assert.deepEqual(practiceSources([0, 0, "1", 1, -1, 99], pages), [
      { page: 0, topic: pages[0].topic },
      { page: 1, topic: pages[1].topic },
    ]);
    assert.equal(
      practiceSettings(
        { size: Infinity, cardCount: "500", difficulty: "expert" },
        2,
      ).cardCount,
      6,
    );
    assert.equal(practiceSettings({ size: 300, cardCount: 3 }, 2).size, 30);
    let sent: any,
      calls = 0,
      mutateDuringGeneration = false,
      startDuringGeneration = false;
    const output = {
      quiz: [
        {
          q: "What does normalization reduce?",
          type: "mcq",
          options: [
            "Redundant data",
            "Every record",
            "All keys",
            "Atomic values",
          ],
          answer: "Redundant data",
          explanation:
            "The supplied notes define normalization as reducing redundant data.",
          hint: "Think about unnecessary repetition.",
          topic: pages[0].topic,
          sourcePages: [0],
        },
        {
          q: "Name the property that commits all operations or none.",
          type: "short",
          answer: "Atomicity",
          acceptedAnswers: ["Atomicity property"],
          explanation:
            "The transaction notes define atomicity as all operations succeeding together.",
          topic: pages[1].topic,
          sourcePages: [1],
        },
        {
          q: "Which normal form requires atomic values?",
          type: "mcq",
          options: [
            "First normal form",
            "Third normal form",
            "BCNF",
            "Fourth normal form",
          ],
          answer: "First normal form",
          explanation:
            "The first note section explicitly says first normal form requires atomic values.",
          topic: pages[0].topic,
          sourcePages: [0, 999],
        },
        {
          q: "This invented question is unsupported.",
          type: "short",
          answer: "Unsupported",
          explanation:
            "An invented question must never become a cited practice item.",
          sourcePages: [99],
        },
      ],
      flashcards: [
        {
          front: "What does normalization reduce?",
          back: "Redundant data.",
          type: "basic",
          topic: pages[0].topic,
          sourcePages: [0],
          imageData: "https://untrusted.example/track",
        },
        {
          front: "{{c1::Atomicity}} commits all operations or none.",
          back: "Atomicity groups operations into one indivisible transaction.",
          type: "cloze",
          topic: pages[1].topic,
          sourcePages: [1],
        },
        {
          front: "An invented uncited flashcard",
          back: "Discard this unsupported source claim.",
          sourcePages: [999],
        },
      ],
    };
    globalThis.fetch = async (_url, init) => {
      calls++;
      sent = JSON.parse(String(init?.body));
      if (startDuringGeneration) {
        const started = await quiz.POST(
          req({ lesson: job.id, action: "start", mode: "practice" }),
        );
        assert.equal(started.status, 200);
      }
      if (mutateDuringGeneration)
        await jobs.reviseJob(job.id, (latest) => ({
          ...latest,
          pages: [
            { ...latest.pages[0], markdown: "Changed while generating." },
            latest.pages[1],
          ],
          revision: (latest.revision || 0) + 1,
        }));
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(output) },
            },
          ],
          model: "fixture",
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const settings = {
      size: 5,
      cardCount: 6,
      difficulty: "challenge",
      format: "mixed",
      focus: "Normalization",
    };
    const generated = await practice.POST(
      req(
        {
          jobId: job.id,
          ...settings,
          language: "hindi",
          pages: [{ topic: "Injected", markdown: "Untrusted replacement" }],
        },
        cookie,
        "/api/practice",
      ),
    );
    assert.equal(
      generated.status,
      200,
      JSON.stringify(await generated.clone().json()),
    );
    const data = await generated.json();
    assert.equal(data.quiz.length, 3);
    assert.equal(data.flashcards.length, 2);
    assert.deepEqual(data.settings, settings);
    assert.equal(
      data.flashcards[0].imageData,
      undefined,
      "Model-created image URLs are discarded",
    );
    assert.deepEqual(data.quiz[2].sources, [
      { page: 0, topic: pages[0].topic },
    ]);
    assert.equal(data.quality.requestedCards, 6);
    assert(data.warning);
    assert.equal(sent.response_format.type, "json_object");
    assert(sent.messages[0].content.includes("English"));
    assert(sent.messages[1].content.includes("Saved note section [0]"));
    assert(!sent.messages[1].content.includes("Untrusted replacement"));
    assert.deepEqual((await jobs.getJob(job.id))!.practice!.settings, settings);
    const initialRevision = (await jobs.getJob(job.id))!.revision;
    const questions = data.quiz;
    const act = async (body: any, expected = 200, c = cookie) => {
      const response = await quiz.POST(req({ lesson: job.id, ...body }, c));
      assert.equal(
        response.status,
        expected,
        JSON.stringify(await response.clone().json()),
      );
      return response.json();
    };
    await act({ action: "start", mode: "practice" }, 404, foreign);
    const [first, replay] = await Promise.all([
      act({ action: "start", mode: "practice" }),
      act({ action: "start", mode: "practice" }),
    ]);
    assert.equal(
      first.attempt.id,
      replay.attempt.id,
      "Concurrent starts resume one saved attempt",
    );
    const id = first.attempt.id;
    assert.equal(
      (
        await practice.POST(
          req({ jobId: job.id, ...settings }, cookie, "/api/practice"),
        )
      ).status,
      409,
      "Rebuilding cannot bypass an active attempt by omitting regenerate",
    );
    await act({
      action: "answer",
      attempt: id,
      question: questionId(questions[0]),
      answer: "Every record",
    });
    const locked = await act({
      action: "answer",
      attempt: id,
      question: questionId(questions[0]),
      answer: questions[0].answer,
    });
    assert.equal(
      locked.attempt.answers[questionId(questions[0])],
      "Every record",
    );
    await act({
      action: "position",
      attempt: id,
      question: questionId(questions[2]),
    });
    const loaded = await (
      await quiz.GET(
        req(undefined, cookie, `/api/student/quiz?lesson=${job.id}`),
      )
    ).json();
    assert.equal(
      loaded.attempt.cursor,
      questionId(questions[2]),
      "Position persists across device reloads",
    );
    await act({ action: "submit", attempt: id }, 409);
    for (const q of questions.slice(1))
      await act({
        action: "answer",
        attempt: id,
        question: questionId(q),
        answer: q.answer,
      });
    const result = await act({ action: "submit", attempt: id });
    assert.equal(result.attempt.correct, 2);
    assert.equal(result.attempt.total, 3);
    await act({ action: "submit", attempt: id });
    assert.equal(
      (await readState<any>(owner.id, "learning", {})).attempts.length,
      1,
      "Replay creates no duplicate study history",
    );
    const retry = await act({
      action: "start",
      mode: "practice",
      scope: "missed",
    });
    assert.equal(retry.attempt.total, 1);
    assert.deepEqual(attemptQuestionIds(retry.attempt, questions), [
      questionId(questions[0]),
    ]);
    await act(
      {
        action: "answer",
        attempt: retry.attempt.id,
        question: questionId(questions[2]),
        answer: questions[2].answer,
      },
      409,
    );
    await act(
      {
        action: "position",
        attempt: retry.attempt.id,
        question: questionId(questions[2]),
      },
      409,
    );
    await act({
      action: "answer",
      attempt: retry.attempt.id,
      question: questionId(questions[0]),
      answer: questions[0].answer,
    });
    const retried = await act({ action: "submit", attempt: retry.attempt.id });
    assert.equal(retried.attempt.correct, 1);
    assert.equal(retried.attempt.total, 1);
    await act({ action: "start", mode: "practice", scope: "missed" }, 409);
    const exam = await act({ action: "start", mode: "exam", scope: "all" });
    for (const q of questions) {
      const response = await act({
        action: "answer",
        attempt: exam.attempt.id,
        question: questionId(q),
        answer: q.answer,
      });
      assert.deepEqual(response.feedback, []);
    }
    await act({ action: "submit", attempt: exam.attempt.id });
    const cached = await practice.POST(
      req({ jobId: job.id, ...settings }, cookie, "/api/practice"),
    );
    assert.equal(cached.status, 200);
    assert.equal((await cached.json()).cached, true);
    assert.equal(calls, 1);
    assert((await jobs.getJob(job.id))!.revision! > initialRevision!);
    const savedPractice = (await jobs.getJob(job.id))!.practice;
    startDuringGeneration = true;
    const racing = await practice.POST(
      req(
        { jobId: job.id, ...settings, regenerate: true },
        cookie,
        "/api/practice",
      ),
    );
    assert.equal(
      racing.status,
      409,
      "An attempt opened during AI generation is preserved",
    );
    assert.deepEqual((await jobs.getJob(job.id))!.practice, savedPractice);
    startDuringGeneration = false;
    const activeAfterRace = await (
      await quiz.GET(
        req(undefined, cookie, `/api/student/quiz?lesson=${job.id}`),
      )
    ).json();
    for (const q of questions)
      await act({
        action: "answer",
        attempt: activeAfterRace.attempt.id,
        question: questionId(q),
        answer: q.answer,
      });
    await act({ action: "submit", attempt: activeAfterRace.attempt.id });
    mutateDuringGeneration = true;
    const stale = await practice.POST(
      req(
        { jobId: job.id, ...settings, regenerate: true },
        cookie,
        "/api/practice",
      ),
    );
    assert.equal(stale.status, 409);
    assert.deepEqual(
      (await jobs.getJob(job.id))!.practice,
      savedPractice,
      "A stale generation cannot replace newer notes/practice",
    );
    const revoked = await quiz.GET(
      req(undefined, foreign, `/api/student/quiz?lesson=${job.id}`),
    );
    assert.equal(revoked.status, 404);
    mutateDuringGeneration = false;
    const mcqOnly = await practice.POST(
      req({ pages, ...settings, format: "mcq" }, foreign, "/api/practice"),
    );
    assert.equal(mcqOnly.status, 200);
    const filtered = await mcqOnly.json();
    assert.equal(filtered.quiz.length, 2);
    assert(
      filtered.quiz.every((q: any) => q.type === "mcq"),
      "Wrong-format model items must not override the learner's selection",
    );
    console.log(
      `PASS learning studio (${process.env.DATA_BACKEND}): settings/counts, owned notes, source validation, cached persistence, saved cursor, concurrent starts, missed-only scoring, replay, exam feedback, stale generation, and cross-owner protection.`,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (replica) {
      await (
        await (await import("../lib/storage/mongo")).mongo()
      ).client.close();
      await replica.stop();
    }
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
