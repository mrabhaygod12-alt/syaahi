import { loadEnvConfig } from "@next/env";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
loadEnvConfig(process.cwd());
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-stt-"));
async function main() {
  const auth = await import("../lib/auth/server");
  const stt = await import("../app/api/transcribe/route");
  const user = await auth.register(
    "Speech QA",
    "speech@example.test",
    "long-test-password",
  );
  const cookie = (
    await auth.startSession(user, new Request("http://localhost"))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const data = new FormData();
  data.append(
    "file",
    new File(
      [new Uint8Array(readFileSync("output/qa/study-audio.wav"))],
      "study-audio.wav",
      { type: "audio/wav" },
    ),
  );
  const r = await stt.POST(
    new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { cookie },
      body: data,
    }),
  );
  const result = await r.json();
  const report = {
    at: new Date().toISOString(),
    status: r.status,
    matched: /binary|sorted/i.test(result.transcript || ""),
    error: result.error || null,
  };
  console.log(JSON.stringify(report));
  writeFileSync(
    "output/qa/gemini-transcription.json",
    JSON.stringify(report, null, 2),
  );
  process.exit(r.ok && report.matched ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
