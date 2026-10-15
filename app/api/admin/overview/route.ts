import { reviewList } from "@/lib/growth/reviews";
import { serviceStatus } from "@/lib/admin/services";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { adminScopes } from "@/lib/auth/admin";
import { recentAudit } from "@/lib/admin/audit";
import { listReviewStories, listContentReports } from "@/lib/writing/stories";
import { listTickets } from "@/lib/support";
export const GET = apiHandler(async (req: Request) => {
  const u = await currentUser(req),
    scopes = adminScopes(u);
  if (!Object.values(scopes).some(Boolean))
    return NextResponse.json(
      { error: "Verified administrator access required." },
      { status: 403 },
    );
  const [review, reports, tickets, events, feedback, services] =
    await Promise.all([
      scopes.editorial ? listReviewStories() : [],
      scopes.editorial ? listContentReports() : [],
      scopes.support ? listTickets() : [],
      scopes.users ? recentAudit() : [],
      scopes.editorial ? reviewList("pending") : [],
      scopes.users ? serviceStatus() : null,
    ]);
  return NextResponse.json({
    scopes,
    reviewQueue: review.length,
    pendingReviews: feedback.length,
    services,
    openReports: reports.filter((t) => t.status === "open").length,
    activeTickets: tickets.filter(
      (t) => !["resolved", "closed"].includes(t.status),
    ).length,
    countsLimitedTo: 100,
    audit: events,
  });
});
