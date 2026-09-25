import { apiHandler } from "@/lib/api-handler";
import { chatWithFallback } from "@/lib/ai/router";
import { authError } from "@/lib/auth/server";
import { NextRequest } from "next/server";
import { rankPages, type HistTurn } from "@/lib/ai/grounding";
import { languageLine, normalizeLang } from "@/lib/ai/prompts";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/ask-stream → SSE: data: {"t":"token"} … data: {"usage":…,"model":"…","provider":"…"} … data: [DONE]
// Streams the first provider that yields a token (priority order, skips
// unconfigured). If streaming fails before any token, caller falls back to
// POST /api/ask (non-streaming, full fallback chain).
async function handlePOST(req: NextRequest) {
  const denied = await authError(req);
  if (denied) return denied;
  const limited = await rateLimit(req, "ask-stream", 60, 60_000);
  if (limited)
    return new Response(JSON.stringify({ error: "Too many requests." }), {
      status: 429,
    });
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
  if (!pages.length || !question) {
    return new Response(
      JSON.stringify({ error: "Provide { pages, question }." }),
      { status: 400 },
    );
  }

  const picked = rankPages(pages, question, history);
  const material = picked
    .map((i) => `## ${pages[i].topic}\n${pages[i].markdown}`)
    .join("\n\n")
    .slice(0, 6000);
  const histBlock = history.length
    ? "\nRECENT CHAT:\n" +
      history.map((h) => `Q: ${h.q}\nA: ${h.a}`).join("\n") +
      "\n"
    : "";
  const messages = [
    {
      role: "system" as const,
      content:
        `Answer the student question STRICTLY from the notes below (under 120 words). ${languageLine(lang)} ` +
        'If the notes do not contain the answer, say exactly: "Not in these notes — generate a page on this topic first." Do not invent beyond the notes.',
    },
    {
      role: "user" as const,
      content: `NOTES:\n${material}\n${histBlock}\nQUESTION: ${question}`,
    },
  ];

  try {
    const result = await chatWithFallback(messages, { maxTokens: 1500 });
    const frames = [{ t: result.text }, { usage: result.usage }, "[DONE]"];
    return new Response(
      frames.map((item) => `data: ${JSON.stringify(item)}\n\n`).join(""),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return new Response(
      JSON.stringify({
        error: "The study assistant is temporarily unavailable. Please retry.",
      }),
      { status: 502 },
    );
  }
}

export const POST = apiHandler(handlePOST);
