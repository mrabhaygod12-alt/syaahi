import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { ownedDraft, approveDraft } from "@/lib/presentations/drafts";
import { rateLimit } from "@/lib/ratelimit";
import { isDeckTemplate } from "@/lib/presentations/store";
export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const denied = await authError(req);
    if (denied) return denied;
    const draft = await ownedDraft(
      (await currentUser(req))!.id,
      (await ctx.params).id,
    );
    return NextResponse.json(
      draft ? { draft } : { error: "Draft not found." },
      { status: draft ? 200 : 404 },
    );
  },
);
export const PATCH = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const denied =
      (await authError(req)) ||
      (await rateLimit(req, "deck-outline-save", 30, 60000));
    if (denied) return denied;
    const b = await req.json().catch(() => ({}));
    try {
      return NextResponse.json({
        draft: await approveDraft(
          (await currentUser(req))!.id,
          (await ctx.params).id,
          b.revision,
          b.outline,
          {
            ...(isDeckTemplate(b.template) ? { template: b.template } : {}),
            ...(b.storyboard ? { storyboard: b.storyboard } : {}),
          },
        ),
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not save outline." },
        { status: 409 },
      );
    }
  },
);
