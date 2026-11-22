import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

const isMongo = process.argv.includes("--mongo");
Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-assignment-test-")),
  DATA_BACKEND: isMongo ? "mongo" : "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  NEXT_PUBLIC_APP_URL: "http://localhost:3103",
  NODE_ENV: "test",
  OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  TAVILY_API_KEY: "",
});

async function main() {
  let replica: any;
  if (isMongo) {
    replica = await (
      await import("mongodb-memory-server")
    ).MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replica.getUri();
  }
  try {
    const auth = await import("../lib/auth/server");
    const { markEmailVerified } = await import("../lib/billing/rewards");
    const { balance } = await import("../lib/credits/store");
    const { grant } = await import("../lib/credits/store");
    const {
      getAssignment,
      updateOwnedAssignment,
      pendingAssignments,
      claimAssignment,
      saveClaimedAssignment,
    } = await import("../lib/assignments/store");
    const api = await import("../app/api/assignments/route");
    const itemApi = await import("../app/api/assignments/[id]/route");
    const exportApi = await import("../app/api/assignments/[id]/export/route");
    const researchApi = await import("../app/api/assignments/research/route");
    const user = await auth.register(
      "Assignment Learner",
      `assignment-${isMongo ? "mongo" : "sqlite"}@example.test`,
      "assignment-test-password-long",
    );
    await markEmailVerified(user.id);
    await grant(
      user.id,
      32,
      `assignment-test-topup-${isMongo ? "mongo" : "sqlite"}`,
    );
    const origin = "http://localhost:3103";
    const cookie = (await auth.startSession(user, new Request(origin))).headers
      .get("set-cookie")!
      .split(";")[0];
    const request = (
      path: string,
      body?: unknown,
      method?: string,
      session = cookie,
    ) =>
      new NextRequest(origin + path, {
        method: method || (body === undefined ? "GET" : "POST"),
        headers: {
          cookie: session,
          origin,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const initialBalance = await balance(user.id);
    const id = "c44e813a-95ab-4b36-92b1-58c19ee101a4";
    const payload = {
      id,
      title: "Privacy and large language models",
      course: "MSc Computer Science",
      topic: "How should universities govern student data in LLM tools?",
      instructions:
        "Compare privacy risks and mitigation approaches. Include a balanced conclusion and use credible research.",
      format: "Comparative analysis",
      pageCount: 2,
      paper: "ruled",
      font: "Kalam",
      citationStyle: "APA 7",
      dois: [],
    };
    const createdResponse = await api.POST(
      request("/api/assignments", payload),
    );
    assert.equal(createdResponse.status, 202);
    const created = await createdResponse.json();
    assert.equal(created.assignment.id, id);
    assert.equal(created.assignment.chargedCredits, 8);
    assert.equal(created.balance, initialBalance - 8);
    const duplicate = await api.POST(request("/api/assignments", payload));
    assert.equal(duplicate.status, 202);
    assert.equal(
      (await duplicate.json()).balance,
      initialBalance - 8,
      "A retried idempotency key must not charge twice.",
    );
    const listed = await api.GET(request("/api/assignments"));
    assert.equal((await listed.json()).assignments.length, 1);

    const outsider = await auth.register(
      "Other Learner",
      `outsider-${isMongo ? "mongo" : "sqlite"}@example.test`,
      "assignment-test-password-long",
    );
    await markEmailVerified(outsider.id);
    const otherCookie = (
      await auth.startSession(outsider, new Request(origin))
    ).headers
      .get("set-cookie")!
      .split(";")[0];
    const hidden = await itemApi.GET(
      request(`/api/assignments/${id}`, undefined, "GET", otherCookie),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(
      hidden.status,
      404,
      "Assignment records must stay owner-private.",
    );

    await updateOwnedAssignment(id, user.id, (old) => ({
      ...old,
      status: "outline",
      phase: "draft",
      outline: ["Context and scope", "Evidence and conclusion"],
    }));
    const edit = await itemApi.PATCH(
      request(
        `/api/assignments/${id}`,
        {
          action: "outline",
          outline: [
            "Context, question, and scope",
            "Compare evidence and conclude",
          ],
        },
        "PATCH",
      ),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(edit.status, 200);
    const approve = await itemApi.PATCH(
      request(`/api/assignments/${id}`, { action: "approve" }, "PATCH"),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(approve.status, 202);
    assert((await pendingAssignments()).includes(id));
    const claimed = await claimAssignment(id);
    assert(claimed);
    assert.equal(claimed.assignment.phase, "draft");
    const ready = {
      ...claimed.assignment,
      status: "ready" as const,
      progress: 100,
      outline: [
        "Context, question, and scope",
        "Compare evidence and conclude",
      ],
      sections: [
        {
          heading: "Context, question, and scope",
          markdown:
            "## Context, question, and scope\n\nUniversities need a clear, evidence-led approach to student data in language-model tools.\n\nDiagram: flow | Collect minimum data | Set access rules | Review retention",
          provider: "test",
          model: "fixture",
        },
        {
          heading: "Compare evidence and conclude",
          markdown:
            "## Compare evidence and conclude\n\nA balanced comparison should test both potential benefit and risk against the assignment rubric.\n\n- Minimise data collection.\n- State retention limits.",
          provider: "test",
          model: "fixture",
        },
      ],
      sources: [
        {
          doi: "10.1234/example.1",
          title: "Privacy-preserving education systems",
          authors: ["A. Researcher"],
          year: 2025,
          venue: "Journal of Safe Learning",
          url: "https://doi.org/10.1234/example.1",
          abstract:
            "A study abstract used only as verified bibliographic metadata in this test.",
          indexedBy: ["Crossref"] as Array<"Crossref" | "OpenAlex">,
        },
      ],
      finishedAt: new Date().toISOString(),
    };
    assert(await saveClaimedAssignment(id, claimed.token, ready));
    const read = await getAssignment(id, user.id);
    assert.equal(read?.status, "ready");

    const docx = await exportApi.GET(
      request(`/api/assignments/${id}/export?format=docx`, undefined, "GET"),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(docx.status, 200);
    assert.equal(
      docx.headers.get("content-type"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    assert.equal(
      Buffer.from(await docx.arrayBuffer())
        .subarray(0, 2)
        .toString(),
      "PK",
      "DOCX must be a real ZIP-based Word file.",
    );
    const pdf = await exportApi.GET(
      request(`/api/assignments/${id}/export?format=pdf`, undefined, "GET"),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      "%PDF",
      "PDF export must be a valid PDF.",
    );

    const longAssignment = await api.POST(
      request("/api/assignments", {
        ...payload,
        id: "88617fa9-8d71-4dbd-95a3-aab2a15fca22",
        title: "Forty-page assignment stays a flat credit price",
        pageCount: 40,
        dois: [],
      }),
    );
    assert.equal(longAssignment.status, 202);
    const longData = await longAssignment.json();
    assert.equal(longData.assignment.pageCount, 40);
    assert.equal(
      longData.balance,
      initialBalance - 16,
      "Long and short assignments both cost exactly eight credits per assignment.",
    );

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.crossref.org/works?"))
        return new Response(
          JSON.stringify({
            message: {
              items: [
                {
                  DOI: "10.5555/study.2025",
                  title: ["Verified AI governance study"],
                  author: [{ given: "Ada", family: "Scholar" }],
                  published: { "date-parts": [[2025]] },
                  "container-title": ["Computing Review"],
                  URL: "https://doi.org/10.5555/study.2025",
                  abstract:
                    "<p>Study metadata about governance and privacy safeguards.</p>",
                },
              ],
            },
          }),
          { status: 200 },
        );
      if (url.startsWith("https://api.openalex.org/works?"))
        return new Response(
          JSON.stringify({
            results: [
              {
                doi: "https://doi.org/10.5555/study.2025",
                title: "Verified AI governance study",
                publication_year: 2025,
                authorships: [{ author: { display_name: "Ada Scholar" } }],
                primary_location: {
                  source: { display_name: "Computing Review" },
                },
                abstract_inverted_index: { Study: [0], metadata: [1] },
              },
            ],
          }),
          { status: 200 },
        );
      throw new Error("Unexpected external request in research test.");
    }) as typeof fetch;
    try {
      const result = await researchApi.POST(
        request("/api/assignments/research", {
          query: "AI governance in university computing",
        }),
      );
      assert.equal(result.status, 200);
      const sources = (await result.json()).sources;
      assert.equal(
        sources.length,
        1,
        "Crossref and OpenAlex results should merge by DOI.",
      );
      assert.equal(sources[0].doi, "10.5555/study.2025");
      assert.deepEqual(sources[0].indexedBy.sort(), ["Crossref", "OpenAlex"]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log(
      `PASS (${isMongo ? "Mongo replica set" : "SQLite"}): auth ownership, fixed/idempotent 8-credit charge, outline review, queue claim, source discovery, and PDF/DOCX exports.`,
    );
  } finally {
    await (await import("../lib/pdf/server")).closePrintBrowser();
    if (isMongo && replica) {
      try {
        await (
          await import("../lib/storage/mongo")
        )
          .mongo()
          .then(({ client }) => client.close());
      } catch {
        /* replica may already be stopping */
      }
    }
    if (replica) await replica.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
