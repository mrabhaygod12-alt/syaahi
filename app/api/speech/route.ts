import { geminiFetch } from "@/lib/ai/gemini-fetch";
import { apiHandler } from "@/lib/api-handler";
import { orderedKeys } from "@/lib/ai/keys";
import { NextResponse } from "next/server";
import { authError, currentUser } from "@/lib/auth/server";
import { getJob } from "@/lib/jobs/store";
import { rateLimit } from "@/lib/ratelimit";
export const maxDuration = 120;
async function handlePOST(req: Request) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "speech", 3, 60000));
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const job = typeof b.lesson === "string" ? await getJob(b.lesson) : null;
  if (!job || job.user !== (await currentUser(req))!.id)
    return NextResponse.json({ error: "Unknown lesson." }, { status: 404 });
  const voice = ["Kore", "Puck", "Charon", "Aoede", "Fenrir"].includes(b.voice)
    ? b.voice
    : "Kore";
  const delivery =
    b.delivery === "lively"
      ? "engaging and energetic"
      : b.delivery === "slow"
        ? "slow and patient"
        : "clear and calm";
  const script =
    b.action === "chat" && typeof b.text === "string"
      ? b.text.slice(0, 1500)
      : job.podcastScript;
  if (!script || script.length > 7000)
    return NextResponse.json(
      { error: "Generate a spoken script under 7,000 characters first." },
      { status: 400 },
    );
  const key = orderedKeys("GEMINI_API_KEY")[0];
  if (!key)
    return NextResponse.json(
      {
        error: "Gemini voice generation is not configured.",
      },
      { status: 503 },
    );
  try {
    const r = await geminiFetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    `Read the following study lesson in a ${delivery} style. Do not add content:\n` +
                    script,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        }),
        signal: AbortSignal.timeout(90000),
      },
    );
    if (!r.ok)
      return NextResponse.json(
        {
          error:
            "The audio provider is unavailable or its speech quota is exhausted. Your text remains available; retry later.",
        },
        { status: 503 },
      );
    const data = await r.json();
    const inline = data.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.data,
    )?.inlineData;
    if (
      !inline?.data ||
      !String(inline.mimeType).toLowerCase().includes("audio/l16")
    )
      throw new Error("No PCM audio returned.");
    const pcm = Buffer.from(inline.data, "base64");
    if (pcm.length > 30 * 1024 * 1024)
      throw new Error("Audio output too large.");
    const sampleRate = Number(
      String(inline.mimeType).match(/rate=(\d+)/)?.[1] || 24000,
    );
    const head = Buffer.alloc(44);
    head.write("RIFF");
    head.writeUInt32LE(36 + pcm.length, 4);
    head.write("WAVE", 8);
    head.write("fmt ", 12);
    head.writeUInt32LE(16, 16);
    head.writeUInt16LE(1, 20);
    head.writeUInt16LE(1, 22);
    head.writeUInt32LE(sampleRate, 24);
    head.writeUInt32LE(sampleRate * 2, 28);
    head.writeUInt16LE(2, 32);
    head.writeUInt16LE(16, 34);
    head.write("data", 36);
    head.writeUInt32LE(pcm.length, 40);
    return new Response(new Uint8Array(Buffer.concat([head, pcm])), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": 'attachment; filename="syaahi-study-audio.wav"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Speech generation did not complete. Your saved script is still available.",
      },
      { status: 503 },
    );
  }
}

export const POST = apiHandler(handlePOST);
