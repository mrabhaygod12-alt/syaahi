import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchYouTube } from "@/lib/youtube/transcript";
import { chatWithFallback } from "@/lib/ai/router";
import { planPrompt, extractJsonArray, heuristicSplit } from "@/lib/ai/prompts";

// POST /api/youtube { url } → real title + real transcript + planned topics.
// Never fabricates: no captions + no title = honest 422, never fake notes.
async function handlePOST(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string")
    return NextResponse.json({ error: "Provide { url }" }, { status: 400 });

  let yt;
  try {
    yt = await fetchYouTube(url);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }

  let topics: string[] = [];
  let planner = "heuristic";
  try {
    const r = await chatWithFallback(planPrompt(yt.transcript) as any, {
      maxTokens: 1500,
    });
    const got = extractJsonArray(r.text);
    if (got) {
      topics = got;
      planner = `${(r as any).provider}:${(r as any).model}`;
    } else {
      topics = heuristicSplit(yt.transcript);
      planner = "heuristic:planner-parse-fallback";
    }
  } catch (e: any) {
    if (String(e?.message).includes("NO_KEYS")) {
      // Honest split of the REAL transcript (their content, not fabricated).
      topics = heuristicSplit(yt.transcript);
      planner = "heuristic:no-ai-key";
    } else {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
  }
  if (!topics.length && yt.title) topics = [yt.title];

  return NextResponse.json({
    videoId: yt.videoId,
    title: yt.title,
    author: yt.author,
    durationSeconds: yt.durationSeconds,
    durationSource: yt.durationSource,
    transcriptChars: yt.transcriptChars,
    transcript: yt.transcript.slice(0, 100000),
    transcriptSource: yt.transcriptSource,
    topics,
    planner,
    debug: yt.debug,
  });
}

export const POST = apiHandler(handlePOST);
