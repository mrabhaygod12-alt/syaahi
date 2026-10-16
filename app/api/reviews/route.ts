import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { record } from "@/lib/workspace-records";
import {
  publicReviews,
  reviewEligibility,
  submitReview,
  ReviewError,
  type Testimonial,
} from "@/lib/growth/reviews";
export const GET = apiHandler(async (req: NextRequest) => {
  if (new URL(req.url).searchParams.get("mine") === "1") {
    const denied = await authError(req);
    if (denied) return denied;
    const user = (await currentUser(req))!;
    const item = await record<Testimonial>(`testimonial-${user.id}`);
    return NextResponse.json({
      eligible: await reviewEligibility(user),
      review: item
        ? {
            stars: item.stars,
            category: item.category || "general",
            text: item.text,
            status: item.status,
            revision: item.revision,
          }
        : null,
    });
  }
  return NextResponse.json({ reviews: await publicReviews() });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "testimonial", 3, 3600000));
  if (denied) return denied;
  try {
    const review = await submitReview(
      (await currentUser(req))!,
      await req.json().catch(() => null),
    );
    return NextResponse.json({
      status: review.status,
      revision: review.revision,
    });
  } catch (error) {
    if (error instanceof ReviewError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    throw error;
  }
});
