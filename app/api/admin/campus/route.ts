import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/ratelimit";
import { applications, reviewApplication } from "@/lib/campus/applications";
async function guard(req: NextRequest) {
  return (
    (await authError(req)) ||
    (!isAdmin(await currentUser(req))
      ? NextResponse.json(
          { error: "Administrator access required." },
          { status: 403 },
        )
      : null)
  );
}
async function get(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({ applications: await applications() });
}
async function post(req: NextRequest) {
  const denied =
    (await guard(req)) || (await rateLimit(req, "campus-review", 30, 60000));
  if (denied) return denied;
  try {
    const body = await req.json();
    return NextResponse.json({
      application: await reviewApplication(
        (await currentUser(req))!.id,
        String(body.id),
        body.status,
        String(body.note || ""),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review failed." },
      { status: 400 },
    );
  }
}
export const GET = apiHandler(get);
export const POST = apiHandler(post);
