import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import {
  getDocument,
  deleteDocument,
  documentEvidence,
} from "@/lib/documents/store";
import { rateLimit } from "@/lib/ratelimit";
type Context = { params: Promise<{ id: string }> };
async function get(req: NextRequest, ctx: Context) {
  const denied = await authError(req);
  if (denied) return denied;
  const owner = (await currentUser(req))!.id,
    id = (await ctx.params).id;
  const doc = await getDocument(owner, id);
  if (!doc)
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const query = req.nextUrl.searchParams.get("q");
  if (query) {
    const limited = await rateLimit(req, "document-search", 30, 60000);
    if (limited) return limited;
    const result = await documentEvidence(owner, id, query.slice(0, 500));
    return NextResponse.json({
      matches: result.matches,
      method: result.method,
    });
  }
  const page = Number(req.nextUrl.searchParams.get("page") || 1);
  if (!Number.isInteger(page) || page < 1 || page > doc.pageCount)
    return NextResponse.json(
      { error: "Choose a valid physical PDF page." },
      { status: 400 },
    );
  return NextResponse.json({
    id,
    name: doc.name,
    pageCount: doc.pageCount,
    page,
    text: doc.chunks
      .filter((chunk) => chunk.page === page)
      .map((chunk) => `[${chunk.id}] ${chunk.text}`)
      .join("\n\n"),
  });
}
async function remove(req: NextRequest, ctx: Context) {
  const denied = await authError(req);
  if (denied) return denied;
  return NextResponse.json({
    deleted: await deleteDocument(
      (await currentUser(req))!.id,
      (await ctx.params).id,
    ),
  });
}
export const GET = apiHandler(get);
export const DELETE = apiHandler(remove);
