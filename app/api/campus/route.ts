import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { applications, apply } from "@/lib/campus/applications";
async function get(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json({
    applications: (await applications((await currentUser(req))!.id)).map(
      ({ history: _history, ...item }) => item,
    ),
  });
}
async function post(req: NextRequest) {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "campus-apply", 3, 3600000));
  if (denied) return denied;
  try {
    const application = await apply(
      (await currentUser(req))!,
      await req.json(),
    );
    return NextResponse.json(
      { id: application.id, status: application.status },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Application failed." },
      { status: 400 },
    );
  }
}
export const GET = apiHandler(get);
export const POST = apiHandler(post);
