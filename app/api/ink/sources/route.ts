import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { inkAccount } from "@/lib/ink/access";
import { rateLimit } from "@/lib/ratelimit";
import { InputValidationError } from "@/lib/security/validation";
import {
  addIndexSource,
  deleteIndexSource,
  indexSummary,
} from "@/lib/ink/source-index";
export const runtime = "nodejs";
export const GET = apiHandler(async (req: NextRequest) => {
  const a = await inkAccount(req);
  if (a.response) return a.response;
  return NextResponse.json({
    sources: await indexSummary(a.user!.id),
    limit: 20,
  });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const a = await inkAccount(req);
  if (a.response) return a.response;
  const limited = await rateLimit(req, "ink-index", 20, 3600000);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b))
    return NextResponse.json(
      { error: "Provide a source document." },
      { status: 400 },
    );
  if (b.action === "delete") {
    if (typeof b.id !== "string" || b.id.length > 100)
      throw new InputValidationError("Unknown private source.");
    await deleteIndexSource(a.user!.id, b.id);
    return NextResponse.json({ ok: true });
  }
  if (
    b.action !== "add" ||
    typeof b.text !== "string" ||
    typeof b.title !== "string"
  )
    return NextResponse.json(
      { error: "Provide a title and source text." },
      { status: 400 },
    );
  return NextResponse.json(await addIndexSource(a.user!.id, b.title, b.text));
});
