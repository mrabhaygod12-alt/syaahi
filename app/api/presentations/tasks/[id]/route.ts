import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { record, mutateRecord } from "@/lib/workspace-records";
import {
  publicPlanTask,
  retryPlan,
  type PlanTask,
} from "@/lib/presentations/hybrid/tasks";
import { kickWorker } from "@/lib/jobs/worker";
import { rateLimit } from "@/lib/ratelimit";
type Context = { params: Promise<{ id: string }> };
async function owned(req: Request, id: string) {
  const task = await record<PlanTask>(id);
  return task?.kind === "presentation-plan-task" &&
    task.owner === (await currentUser(req))!.id
    ? task
    : null;
}
export const GET = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  const task = await owned(req, (await ctx.params).id);
  if (!task)
    return NextResponse.json(
      { error: "Research task not found." },
      { status: 404 },
    );
  kickWorker();
  return NextResponse.json({ task: publicPlanTask(task) });
});
export const DELETE = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied = await authError(req);
  if (denied) return denied;
  const task = await owned(req, (await ctx.params).id);
  if (!task)
    return NextResponse.json(
      { error: "Research task not found." },
      { status: 404 },
    );
  const changed = await mutateRecord<PlanTask>(task.id, (old) => {
    if (!old || old.owner !== task.owner) throw new Error("Task changed.");
    return {
      ...old,
      status: "cancelled",
      stage: "Delivery cancelled",
      lease: null,
      leaseUntil: 0,
      updatedAt: new Date().toISOString(),
    };
  });
  return NextResponse.json({ task: publicPlanTask(changed) });
});
export const POST = apiHandler(async (req: NextRequest, ctx: Context) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "presentation-plan-retry", 4, 60000));
  if (denied) return denied;
  const task = await owned(req, (await ctx.params).id);
  if (!task)
    return NextResponse.json(
      { error: "Research task not found." },
      { status: 404 },
    );
  try {
    const changed = await retryPlan(task.owner, task.id);
    kickWorker();
    return NextResponse.json(
      { task: publicPlanTask(changed) },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not retry this brief.",
      },
      { status: 409 },
    );
  }
});
