import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchYouTube } from "@/lib/youtube/transcript";
import { assessVideo } from "@/lib/youtube/study";
import { rateLimit } from "@/lib/ratelimit";
export const maxDuration = 180;
async function handlePOST(req: NextRequest) {
  const denied =
    (await authError(req)) || (await rateLimit(req, "youtube", 3, 60000));
  if (denied) return denied;
  const { url } = await req.json().catch(() => ({}));
  if (typeof url !== "string" || url.length > 2048)
    return NextResponse.json(
      { error: "Provide a valid YouTube URL." },
      { status: 400 },
    );
  let yt;
  try {
    yt = await fetchYouTube(url);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Video unavailable",
        canUpload: true,
      },
      { status: 422 },
    );
  }
  try {
    const assessment = await assessVideo(yt.title || "", yt.transcript);
    if (["non_educational", "uncertain"].includes(assessment.classification))
      return NextResponse.json(
        {
          error:
            assessment.classification === "non_educational"
              ? "This video does not contain enough instructional content to create a study lesson. Choose a tutorial, lecture or explanatory video."
              : "We could not identify reliable teaching content. Upload clearer source material or choose another video.",
          assessment,
        },
        { status: 422 },
      );
    return NextResponse.json({
      videoId: yt.videoId,
      title: yt.title,
      author: yt.author,
      durationSeconds: yt.durationSeconds,
      transcript: yt.transcript,
      transcriptSource: yt.transcriptSource,
      transcriptChars: yt.transcriptChars,
      topics: assessment.topics,
      assessment,
      warning:
        yt.transcriptSource === "video-digest"
          ? "Captions were unavailable. This is an AI-extracted video digest, not a verbatim transcript. Review it before generating."
          : assessment.classification === "mixed"
            ? "This video mixes teaching and other content. Review the source and keep only relevant material."
            : null,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Video suitability checking is temporarily unavailable. Please retry; no lesson was created.",
      },
      { status: 503 },
    );
  }
}
export const POST = apiHandler(handlePOST);
