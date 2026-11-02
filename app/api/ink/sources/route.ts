import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { inkAccount } from "@/lib/ink/access";
import { rateLimit } from "@/lib/ratelimit";
import { InputValidationError } from "@/lib/security/validation";
import { researchLink, publicResearchUrl } from "@/lib/presentations/research";
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
  if (b.action === "import-url") {
    if (typeof b.url !== "string" || b.url.length > 2000)
      throw new InputValidationError("Provide a public HTTPS article URL.");
    try {
      const url = publicResearchUrl(b.url);
      if (
        /(^|\.)(scholar\.google\.[a-z.]+|scopus\.com|sciencedirect\.com|elsevier\.com)$/.test(
          url.hostname,
        )
      )
        throw Error(
          "This collection requires manual lookup or licensed access. Add a document you have permission to use instead.",
        );
      const source = await researchLink(
        url.href,
        AbortSignal.any([req.signal, AbortSignal.timeout(20000)]),
      );
      const saved = await addIndexSource(a.user!.id, source.name, source.text, {
        url: source.locator,
        scope: "page-text",
        provider: "Permitted public page",
        retrievedAt: source.retrievedAt,
        truncated: source.truncated,
      });
      return NextResponse.json({
        ...saved,
        title: source.name,
        url: source.locator,
      });
    } catch (e) {
      // Never expose DNS addresses, proxy internals or URL credentials in errors.
      const message =
        e instanceof Error &&
        /requires manual lookup|does not permit|published terms|enough readable|HTML article|public HTTPS|private access credentials|Private, local/.test(
          e.message,
        )
          ? e.message
          : "This public page could not be imported. It may block access or require sign-in. Upload a source you can use instead.";
      return NextResponse.json({ error: message }, { status: 422 });
    }
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
