import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { NextRequest } from "next/server";
loadEnvConfig(process.cwd());
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-live-tools-"));
delete process.env.MONGODB_URI;
process.env.DATA_BACKEND = "sqlite";
async function main() {
  const { register, startSession } = await import("../lib/auth/server");
  const jobs = await import("../lib/jobs/store");
  const tools = await import("../app/api/lesson-tools/route");
  const speech = await import("../app/api/speech/route");
  const practice = await import("../app/api/practice/route");
  const user = await register(
    "Live QA",
    "live@example.test",
    "long-test-password",
  );
  const cookie = (
    await startSession(user, new Request("http://localhost:3101"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const req = (b: unknown) =>
    new NextRequest("http://localhost:3101/api/lesson-tools", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify(b),
    });
  const job = await jobs.createJob(user.id, ["Binary search"], "concise");
  const lease = (await jobs.claimJob(job.id))!;
  await jobs.commitPage(job.id, lease.token, 0, {
    topic: "Binary search",
    markdown:
      "## Binary search\nBinary search requires a sorted array. Compare the middle element with the target. Discard the half that cannot contain the target. Repeat until found or empty. Time complexity O(log n). Iterative auxiliary space O(1). Example: find 7 in [1,3,5,7,9]. Start at 5, then inspect the right half.\nDiagram: flow | Sorted input | Compare middle | Discard half | Repeat",
    provider: "fixture",
    model: "fixture",
  });
  await jobs.finishJob(job.id, lease.token);
  const rewrite = await tools.POST(
    req({
      action: "rewrite",
      lesson: job.id,
      index: 0,
      instruction: "Clarify the precondition and preserve the flow diagram.",
    }),
  );
  assert.equal(rewrite.status, 200);
  assert((await rewrite.json()).proposal.length > 40);
  const mixed = await practice.POST(
    req({ jobId: job.id, format: "mixed", size: 5 }),
  );
  assert.equal(mixed.status, 200);
  const quiz = await mixed.json();
  assert(quiz.quiz.some((q: any) => q.type !== "mcq"));
  const script = await tools.POST(
    req({ action: "podcast", lesson: job.id, depth: "quick" }),
  );
  assert.equal(script.status, 200);
  assert((await script.json()).script.length > 100);
  await jobs.updateJob(job.id, {
    podcastScript:
      "Binary search needs sorted data. Compare the middle value with your target, discard the impossible half, and repeat. Why must the data be sorted? Because that ordering tells you which half to discard.",
  });
  const audio = await speech.POST(req({ lesson: job.id }));
  mkdirSync("output/qa", { recursive: true });
  const results = {
    at: new Date().toISOString(),
    rewrite: rewrite.status,
    mixedQuiz: quiz.quiz.map((q: any) => q.type),
    podcast: script.status,
    audio: audio.status,
    audioMessage: "",
    speechToText:0,
  };
  if (audio.ok) {
    const wav = Buffer.from(await audio.arrayBuffer());
    assert.equal(wav.subarray(0, 4).toString(), "RIFF");
    assert(wav.length > 1000);
    writeFileSync("output/qa/study-audio.wav", wav);
    const stt=await import('../app/api/transcribe/route');const form=new FormData();form.append('file',new File([new Uint8Array(wav)],'study-audio.wav',{type:'audio/wav'}));const transcribed=await stt.POST(new Request('http://localhost:3101/api/transcribe',{method:'POST',headers:{cookie},body:form}));results.speechToText=transcribed.status;const transcription=await transcribed.json();if(transcribed.ok)assert(/binary|sorted/i.test(transcription.transcript));else results.audioMessage='Gemini transcription: '+transcription.error;
  } else {
    results.audioMessage = (await audio.json()).error;
  }
  writeFileSync(
    "output/qa/live-study-tools.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
