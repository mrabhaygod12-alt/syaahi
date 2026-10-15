import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/ratelimit";
import { reviewList, moderateReview, ReviewError } from "@/lib/growth/reviews";
export const GET = apiHandler(async (req: NextRequest) => {
  if (!isAdmin(await currentUser(req)))
    return NextResponse.json(
      { error: "Editorial access and MFA required." },
      { status: 403 },
    );
  return NextResponse.json({ reviews: await reviewList() });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await currentUser(req);
  if (!user || !isAdmin(user))
    return NextResponse.json(
      { error: "Editorial access and MFA required." },
      { status: 403 },
    );
  const denied = await rateLimit(req, "moderate-testimonial", 30, 60000);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (
    typeof body.id !== "string" ||
    body.id.length > 100 ||
    !["publish", "reject"].includes(body.action) ||
    !Number.isInteger(body.revision) ||
    typeof body.reason !== "string" ||
    !body.reason.trim()
  )
    return NextResponse.json(
      { error: "Choose a review, action and moderation reason." },
      { status: 400 },
    );
  try {
    const review = await moderateReview(
      body.id,
      body.action,
      user.id,
      body.revision,
      body.reason.trim(),
    );
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof ReviewError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    throw error;
  }
});
