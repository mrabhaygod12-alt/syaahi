import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { searchAssignmentSources } from "@/lib/assignments/research";

export const runtime = "nodejs";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "assignment-research", 8, 60_000));
  if (denied) return denied;
  const user = (await currentUser(req))!;
  if (user.workspace === "writer")
    return NextResponse.json(
      { error: "Switch to your student workspace to use Assignment Studio." },
      { status: 403 },
    );
  const raw = await req.text();
  if (raw.length > 3000)
    return NextResponse.json(
      { error: "Search request is too large." },
      { status: 413 },
    );
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid search request." },
      { status: 400 },
    );
  }
  const query =
    typeof body.query === "string"
      ? body.query.trim().replace(/\s+/g, " ")
      : "";
  if (query.length < 4 || query.length > 180)
    return NextResponse.json(
      { error: "Enter a research topic from 4 to 180 characters." },
      { status: 400 },
    );
  const sources = await searchAssignmentSources(query);
  return NextResponse.json({
    sources,
    coverage: ["Crossref", "OpenAlex"],
    note: "Search results are scholarly metadata and abstracts, not licensed full text. Check each source and follow its DOI before citing it.",
  });
});
