import { chatWithFallback, type ChatMsg } from "@/lib/ai/router";
import { pagePrompt, normalizeLang, type PageBrief } from "@/lib/ai/prompts";
import { parseNote } from "@/lib/notes/parse";
import {
  claimJob,
  commitPage,
  finishJob,
  renewLease,
  type JobPage,
} from "./store";

export type ChatFn = (
  messages: ChatMsg[],
  opts?: { maxTokens?: number; rotateBy?: number },
) => Promise<{ text: string; provider?: string; model?: string }>;

// Parallel page workers (3 lanes). Each lane starts on a different provider so
// one slow/rate-limited model never blocks the whole lesson (~3x faster).
const PAGE_LANES = 2;

async function makeOnePage(
  topic: string,
  style: "detailed" | "concise",
  extra: PageBrief | undefined,
  chat: ChatFn,
  rotateBy: number,
): Promise<JobPage> {
  // APInex models are heavy reasoners (~800-1500 thinking tokens before
  // the answer). 900/500 budgets truncate them to EMPTY. Use 3500/2500.
  const budget = style === "detailed" ? 3500 : 2500;
  let r = await chat(pagePrompt(topic, style, extra) as ChatMsg[], {
    maxTokens: budget,
    rotateBy,
  });
  // Autonomous self-revise loop (bounded: max 1 repair call per page).
  const wantsVisual =
    /process|cycle|algorithm|search|sort|system|network|forensic|chain|photosynthesis|loop|architecture|workflow|layer|division|circulat/i.test(
      topic,
    );
  const hasVisual = parseNote(r.text).some((b) =>
    ["diagram", "illustration", "table", "timeline"].includes(b.kind),
  );
  const missing = [
    structuralGaps(r.text),
    wantsVisual && !hasVisual
      ? "one accurate labelled flowchart, concept map, comparison table, or decision diagram suited to this topic"
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  if (missing) {
    try {
      const r2 = await chat(
        [
          ...(pagePrompt(topic, style, extra) as ChatMsg[]),
          { role: "assistant", content: r.text },
          {
            role: "user",
            content: `Your draft is missing: ${missing}. Rewrite the FULL page (~200 words) fixing exactly that, keeping all other sections. Markdown only.`,
          },
        ] as ChatMsg[],
        { maxTokens: budget, rotateBy },
      );
      if (scorePage(r2.text) > scorePage(r.text)) r = r2;
    } catch {
      /* keep first attempt */
    }
  }
  return {
    topic,
    markdown: r.text,
    provider: (r as any).provider ?? "unknown",
    model: (r as any).model ?? "unknown",
  };
}

// Structural self-critique: returns what's missing, or null when the page is complete.
function structuralGaps(md: string): string | null {
  const blocks = parseNote(md);
  const gaps: string[] = [];
  if (!blocks.some((b) => b.kind === "title")) gaps.push("a ## title");
  if (!blocks.some((b) => b.kind === "definition"))
    gaps.push("a **Definition:** line");
  const bullets = blocks
    .filter((b) => b.kind === "bullets")
    .reduce((a, b: any) => a + b.items.length, 0);
  const steps = blocks
    .filter((b) => b.kind === "steps")
    .reduce((a, b: any) => a + b.items.length, 0);
  const tables = blocks.filter((b) => b.kind === "table").length;
  if (bullets < 3 && steps < 2 && tables === 0)
    gaps.push("4-6 key-point bullets (or numbered steps / a compare table)");
  if (md.trim().length < 500) gaps.push("more substance (under 500 chars)");
  return gaps.length ? gaps.join(", ") : null;
}

function scorePage(md: string): number {
  const blocks = parseNote(md);
  let s = Math.min(md.trim().length / 100, 20);
  for (const b of blocks) {
    if (b.kind === "title" || b.kind === "definition") s += 3;
    else if (b.kind === "bullets" || b.kind === "steps")
      s += (b as any).items.length;
    else if (b.kind === "table") s += 6;
    else if (b.kind === "timeline") s += 5;
    else if (b.kind === "terms") s += 5;
    else if (b.kind === "diagram") s += 8;
    else if (b.kind === "illustration") s += 8;
    else if (b.kind === "summary") s += 3;
    else if (b.kind === "margin") s += 1;
    else s += 1;
  }
  return structuralGaps(md) ? s - 5 : s;
}

// Shared page-generation loop. Default chat = real AI router.
// extra.context grounds every page in source material (transcript/syllabus);
// extra.brief carries the question-manager answers.
export async function generatePages(
  topics: string[],
  style: "detailed" | "concise",
  onPage?: (page: JobPage, index: number) => Promise<void> | void,
  chat: ChatFn = chatWithFallback as ChatFn,
  extra?: PageBrief,
): Promise<{ pages: JobPage[]; errors: string[] }> {
  const slots: (JobPage | null)[] = new Array(topics.length).fill(null);
  const errors: string[] = [];
  let next = 0;
  let stopped = false;
  // Ordered commit: pages surface strictly in topic order (claim-before-await
  // so concurrent lanes can never double-commit), live polling never scrambles.
  let committed = 0;
  let commitQueue: Promise<void> = Promise.resolve();
  function commit(): Promise<void> {
    commitQueue = commitQueue.then(async () => {
      while (true) {
        const i = committed;
        if (i >= topics.length || !slots[i]) return;
        await onPage?.(slots[i]!, i);
        committed = i + 1;
      }
    });
    return commitQueue;
  }
  async function lane() {
    while (!stopped) {
      const i = next++;
      if (i >= topics.length) return;
      try {
        slots[i] = await makeOnePage(topics[i], style, extra, chat, i);
        await commit();
      } catch (e: any) {
        // Stop dispatching new topics, but keep pages other lanes finished.
        stopped = true;
        errors.push(`${topics[i]}: ${String(e?.message).slice(0, 200)}`);
        return;
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(PAGE_LANES, Math.max(topics.length, 1)) },
      () => lane(),
    ),
  );
  await commit();
  const pages = slots.filter((p): p is JobPage => !!p);
  return { pages, errors };
}

// A job is persisted before work starts. Leases allow recovery after a crash.
// Page content and credit consumption commit together, in topic order.
export async function processJob(id: string): Promise<void> {
  const claimed = await claimJob(id);
  if (!claimed) return;
  const { job, token } = claimed;
  const heartbeat = setInterval(() => {
    void renewLease(id, token).catch(() => {});
  }, 30000);
  try {
    const offset = job.pages.length;
    const result = await generatePages(
      job.topics.slice(offset),
      job.style,
      async (page, index) => {
        await commitPage(id, token, offset + index, page);
      },
      undefined,
      {
        context: job.context || undefined,
        brief: job.brief || undefined,
        language: normalizeLang(job.language),
      },
    );
    await finishJob(id, token, result.errors[0]);
  } catch (error) {
    await finishJob(
      id,
      token,
      error instanceof Error ? error.message : "Generation failed.",
    );
  } finally {
    clearInterval(heartbeat);
  }
}
