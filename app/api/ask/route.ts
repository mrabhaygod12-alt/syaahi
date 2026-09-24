import { apiHandler } from "@/lib/api-handler";
import { authError } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { chatWithFallback } from "@/lib/ai/router";
import { languageLine, normalizeLang } from "@/lib/ai/prompts";
import { rankPages, type HistTurn } from "@/lib/ai/grounding";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

// POST /api/ask { pages, question, language?, history?[{q,a}] }
// → { answer, provider, model, ms, usage, cites:[{page, topic}] }
async function handlePOST(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "ask", 60, 60_000);
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  const pages: Array<{ topic: string; markdown: string }> = Array.isArray(
    body.pages,
  )
    ? body.pages
        .slice(0, 48)
        .filter(
          (p: any) =>
            typeof p?.topic === "string" && typeof p?.markdown === "string",
        )
        .map((p: any) => ({
          topic: p.topic.slice(0, 160),
          markdown: p.markdown.slice(0, 20000),
        }))
    : [];
  const question: string = String(body.question ?? "")
    .trim()
    .slice(0, 500);
  const lang = normalizeLang(body.language);
  const history: HistTurn[] = Array.isArray(body.history)
    ? body.history.slice(-4).map((h: any) => ({
        q: String(h?.q ?? "").slice(0, 300),
        a: String(h?.a ?? "").slice(0, 600),
      }))
    : [];
  if (!pages.length || !question)
    return NextResponse.json(
      { error: "Provide { pages, question }." },
      { status: 400 },
    );

  const picked = rankPages(pages, question, history);
  const material = picked
    .map((i) => `## ${pages[i].topic}\n${pages[i].markdown}`)
    .join("\n\n")
    .slice(0, 6000);
  const histBlock = history.length
    ? '\nRECENT CHAT (for follow-ups like "aur detail me"):\n' +
      history.map((h) => `Q: ${h.q}\nA: ${h.a}`).join("\n") +
      "\n"
    : "";

  try {
    const r = await chatWithFallback(
      [
        {
          role: "system",
          content:
            `Answer the student question STRICTLY from the notes below (under 120 words). ${languageLine(lang)} ` +
            'If the notes do not contain the answer, say exactly: "Not in these notes — generate a page on this topic first." Do not invent beyond the notes.',
        },
        {
          role: "user",
          content: `NOTES:\n${material}\n${histBlock}\nQUESTION: ${question}`,
        },
      ],
      { maxTokens: 1500 },
    );
    return NextResponse.json({
      answer: r.text,
      provider: (r as any).provider,
      model: (r as any).model,
      ms: (r as any).ms ?? 0,
      usage: (r as any).usage ?? {
        prompt: 0,
        completion: 0,
        total: 0,
        cost: 0,
      },
      cites: picked.map((i) => ({ page: i, topic: pages[i].topic })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes("NO_KEYS") ? 402 : 502 },
    );
  }
}

export const POST = apiHandler(handlePOST);
