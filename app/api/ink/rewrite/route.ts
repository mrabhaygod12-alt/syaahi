import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { inkAccount } from "@/lib/ink/access";
import { rateLimit } from "@/lib/ratelimit";
import { rewrite, REWRITE_MODES, type RewriteMode } from "@/lib/ink/rewrite";
import { readState } from "@/lib/study/state";

export const runtime = "nodejs";
export const maxDuration = 90;

/** Rewrites are the expensive half of AI Ink, so the window is tight. */
const REWRITES_PER_HOUR = 20;
/** A learner's own writing sample is reused across requests. */
const VOICE_KEY = "ink-voice-sample";

async function handlePOST(req: NextRequest) {
  const access = await inkAccount(req);
  if (access.response) return access.response;
  const denied = await rateLimit(req, "ink-rewrite", REWRITES_PER_HOUR, 3600000);
  if (denied) return denied;
  const user = access.user!;
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Provide a JSON object." }, { status: 400 });

  const action = String(body.action || "rewrite");

  // Persist a writing sample so "your own voice" works on later sections.
  if (action === "voice") {
    const sample = typeof body.sample === "string" ? body.sample.trim() : "";
    if (sample.length > 4000)
      return NextResponse.json(
        { error: "Keep the sample under 4,000 characters." },
        { status: 400 },
      );
    await writeVoice(user.id, sample);
    return NextResponse.json({ ok: true, stored: sample.length > 0 });
  }

  if (action !== "rewrite")
    return NextResponse.json(
      { error: "action must be 'rewrite' or 'voice'." },
      { status: 400 },
    );

  const text = typeof body.text === "string" ? body.text : "";
  const mode = String(body.mode || "tighten") as RewriteMode;
  if (!Object.hasOwn(REWRITE_MODES, mode))
    return NextResponse.json(
      { error: "Choose a supported rewrite mode." },
      { status: 400 },
    );

  const voiceSample =
    mode === "ownvoice"
      ? String(body.voiceSample || "") || (await readVoice(user.id))
      : undefined;

  if (mode === "ownvoice" && !voiceSample)
    return NextResponse.json(
      {
        error:
          "Add a short sample of your own writing first, so the rewrite can follow your voice.",
        needsSample: true,
      },
      { status: 400 },
    );

  try {
    const result = await rewrite({
      text,
      mode,
      voiceSample,
      instruction:
        typeof body.instruction === "string" ? body.instruction : undefined,
    });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
          error: "The rewrite could not be completed. Try a shorter section or retry shortly.",
      },
      { status: 400 },
    );
  }
}

async function readVoice(owner: string): Promise<string> {
  const stored = await readState<{ sample?: string }>(owner, VOICE_KEY, {});
  return stored.sample || "";
}

async function writeVoice(owner: string, sample: string): Promise<void> {
  const { mutateState } = await import("@/lib/study/state");
  await mutateState<{ sample?: string }>(owner, VOICE_KEY, {}, () => ({
    sample: sample.slice(0, 4000),
  }));
}

export const POST = apiHandler(handlePOST);
