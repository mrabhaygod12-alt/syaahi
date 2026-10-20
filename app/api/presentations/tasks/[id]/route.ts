import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { record, mutateRecord } from "@/lib/workspace-records";
import {
  publicPlanTask,
  type PlanTask,
} from "@/lib/presentations/hybrid/tasks";
import { kickWorker } from "@/lib/jobs/worker";
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
