import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { rateLimit } from "@/lib/ratelimit";
import { guestPreview } from "@/lib/growth/preview";
export const POST = apiHandler(async (req: NextRequest) => {
  const limited = await rateLimit(req, "guest-preview", 5, 60000);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.topic !== "string" ||
    body.topic.trim().length < 3 ||
    body.topic.length > 160 ||
    /[<>\r\n]/.test(body.topic) ||
    !["english", "hindi"].includes(body.language)
  )
    return NextResponse.json(
      {
        error: "Choose a study topic of 3–160 characters and English or Hindi.",
      },
      { status: 400 },
    );
  if (body.website)
    return NextResponse.json(
      { error: "Preview could not start." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await guestPreview(body.topic.trim(), body.language),
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "The AI preview is temporarily busy. Try a sample topic below; it works without an account.",
      },
      { status: 503 },
    );
  }
});
