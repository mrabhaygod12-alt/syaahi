import { createHash, randomUUID } from "node:crypto";
import {
  record,
  mutateRecord,
  type WorkspaceRecord,
} from "@/lib/workspace-records";
import { collection, useMongo } from "@/lib/storage/mongo";
import { db } from "@/lib/db";
import { createHybridDraft } from "./create";
import { balance } from "@/lib/credits/store";
import type { HybridGenerate } from "./pipeline";
import { AIUnavailableError } from "@/lib/ai/router";
type Input = Parameters<typeof createHybridDraft>[1];
export interface PlanTask extends WorkspaceRecord {
  kind: "presentation-plan-task";
  input: Input;
  status: "queued" | "researching" | "done" | "error" | "cancelled";
  stage: string;
  lease: string | null;
  leaseUntil: number;
  draftId?: string;
  error?: string;
  createdAt: string;
  providerRetries?: number;
  manualRetries?: number;
}
export function publicPlanTask({
  id,
  status,
  stage,
  draftId,
  error,
  updatedAt,
  leaseUntil,
  manualRetries,
}: PlanTask) {
  return {
    id,
    status,
    stage,
    draftId,
    error,
    updatedAt,
    canRetry: status === "error" && (manualRetries || 0) < 2,
    retryAt: status === "error" ? leaseUntil : undefined,
  };
}
export async function retryPlan(owner: string, id: string) {
  const existing = await record<PlanTask>(id);
  if (
    !existing ||
    existing.kind !== "presentation-plan-task" ||
    existing.owner !== owner
  )
    throw new Error("Research task not found.");
  if (["queued", "researching"].includes(existing.status)) return existing;
  await assertPendingCapacity(owner);
  if ((await balance(owner)) < 5)
    throw new Error(
      "At least five available credits are needed. Retrying does not charge them.",
    );
  return mutateRecord<PlanTask>(id, (old) => {
    if (!old || old.kind !== "presentation-plan-task" || old.owner !== owner)
      throw new Error("Research task not found.");
    // A repeated click cannot create another task or reset a running lease.
    if (["queued", "researching"].includes(old.status)) return old;
    if (old.status !== "error")
      throw new Error("Only a failed research task can be retried.");
    if ((old.manualRetries || 0) >= 2)
      throw new Error(
        "Saved-brief retry limit reached. Review your sources and start a new brief.",
      );
    if (old.leaseUntil > Date.now())
      throw new Error(
        "Please wait one minute after the failure before retrying this saved brief.",
      );
    return {
      ...old,
      status: "queued",
      stage: "Retrying your saved sources and brief",
      error: undefined,
      providerRetries: 0,
      manualRetries: (old.manualRetries || 0) + 1,
      lease: null,
      leaseUntil: 0,
      updatedAt: new Date().toISOString(),
    };
  });
}
export async function queuePlan(owner: string, event: string, input: Input) {
  if (
    typeof event !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(event) ||
    typeof input.prompt !== "string" ||
    input.prompt.length < 12 ||
    input.prompt.length > 3000 ||
    !Number.isInteger(input.count) ||
    input.count < 5 ||
    input.count > 30 ||
    !Array.isArray(input.sources) ||
    input.sources.length > 6
  )
    throw new Error("Use a valid brief, source selection and slide budget.");
  const id = `plan-task-${createHash("sha256")
    .update(owner + ":" + event)
    .digest("hex")}`;
  const previous = await record<PlanTask>(id);
  if (previous) {
    if (
      previous.owner !== owner ||
      previous.kind !== "presentation-plan-task" ||
      JSON.stringify(previous.input) !== JSON.stringify(input)
    )
      throw new Error("Use a new request ID for a different brief.");
    return previous;
  }
  await assertPendingCapacity(owner);
  const since = new Date(Date.now() - 86400000).toISOString(),
    daily = useMongo()
      ? await (
          await collection("workspace_records")
        ).countDocuments(
          {
            kind: "presentation-plan-task",
            owner,
            "payload.createdAt": { $gte: since },
          },
          { limit: 20 },
        )
      : Number(
          db()
            .prepare(
              "SELECT COUNT(*) AS n FROM workspace_records WHERE kind='presentation-plan-task' AND owner=? AND json_extract(payload,'$.createdAt')>=?",
            )
            .get(owner, since)?.n || 0,
        );
  if (daily >= 20)
    throw new Error(
      "Daily planning limit reached. Reuse an existing storyboard or return tomorrow. No credits were charged.",
    );
  if ((await balance(owner)) < 5)
    throw new Error(
      "At least five available credits are needed to plan this presentation. Planning does not charge them.",
    );
  return mutateRecord<PlanTask>(
    id,
    (old) =>
      old || {
        id,
        owner,
        kind: "presentation-plan-task",
        input,
        status: "queued",
        stage: "Queued for source ingestion",
        lease: null,
        leaseUntil: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
  );
}
async function assertPendingCapacity(owner: string) {
  const pending = useMongo()
    ? await (
        await collection("workspace_records")
      ).countDocuments(
        {
          kind: "presentation-plan-task",
          owner,
          "payload.status": { $in: ["queued", "researching"] },
        },
        { limit: 2 },
      )
    : Number(
        db()
          .prepare(
            "SELECT COUNT(*) AS n FROM workspace_records WHERE kind='presentation-plan-task' AND owner=? AND json_extract(payload,'$.status') IN ('queued','researching')",
          )
          .get(owner)?.n || 0,
      );
  if (pending >= 2)
    throw new Error("Finish or cancel a pending research task first.");
}
let active = false;
export function kickPlanTasks() {
  if (active) return;
  active = true;
  void runPendingPlan()
    .catch(() => {})
    .finally(() => {
      active = false;
    });
}
export async function runPendingPlan(generate?: HybridGenerate) {
  const now = Date.now();
  const row = useMongo()
    ? await (
        await collection("workspace_records")
      ).findOne(
        {
          kind: "presentation-plan-task",
          "payload.status": { $in: ["queued", "researching"] },
          "payload.leaseUntil": { $lte: now },
        },
        { sort: { "payload.createdAt": 1 } },
      )
    : db()
        .prepare(
          "SELECT payload FROM workspace_records WHERE kind='presentation-plan-task' AND json_extract(payload,'$.status') IN ('queued','researching') AND json_extract(payload,'$.leaseUntil')<=? ORDER BY updated_at ASC LIMIT 1",
        )
        .get(now);
  const pending: PlanTask | null = row
    ? typeof row.payload === "string"
      ? JSON.parse(row.payload)
      : row.payload
    : null;
  if (!pending) return;
  const lease = randomUUID();
  let task: PlanTask;
  try {
    task = await mutateRecord<PlanTask>(pending.id, (old) => {
      if (
        !old ||
        !["queued", "researching"].includes(old.status) ||
        old.leaseUntil > Date.now()
      )
        throw new Error("Task already claimed.");
      return {
        ...old,
        status: "researching",
        stage: "Reading complete sources and researching evidence",
        lease,
        leaseUntil: Date.now() + 480000,
        updatedAt: new Date().toISOString(),
      };
    });
  } catch {
    return;
  }
  const pulse = setInterval(() => {
    void mutateRecord<PlanTask>(task.id, (old) => {
      if (!old || old.lease !== lease || old.status !== "researching")
        throw new Error("Lease lost.");
      return { ...old, leaseUntil: Date.now() + 480000 };
    }).catch(() => {});
  }, 30000);
  pulse.unref();
  try {
    const draft = await createHybridDraft(
      task.owner,
      task.input,
      generate,
      task.id.replace("plan-task-", "hybrid-draft-"),
    );
    await mutateRecord<PlanTask>(task.id, (old) => {
      if (!old || old.lease !== lease || old.status !== "researching")
        throw new Error("Task cancelled or changed.");
      return {
        ...old,
        status: "done",
        stage: "Source-backed storyboard ready for review",
        draftId: draft.id,
        lease: null,
        leaseUntil: 0,
        updatedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    if (
      error instanceof AIUnavailableError &&
      error.retryable &&
      (task.providerRetries || 0) < 2
    ) {
      await mutateRecord<PlanTask>(task.id, (old) => {
        if (!old || old.lease !== lease || old.status !== "researching")
          throw new Error("Task cancelled or changed.");
        return {
          ...old,
          status: "queued",
          stage:
            "The AI provider is busy. Your saved brief is safe; waiting before a bounded retry.",
          providerRetries: (old.providerRetries || 0) + 1,
          lease: null,
          leaseUntil: Date.now() + Math.max(10000, error.retryAfterMs),
          updatedAt: new Date().toISOString(),
        };
      }).catch(() => {});
      return;
    }
    await mutateRecord<PlanTask>(task.id, (old) => {
      if (!old || old.lease !== lease || old.status !== "researching")
        throw new Error("Lease lost.");
      return {
        ...old,
        status: "error",
        stage: "Research needs attention",
        error:
          "The storyboard could not be verified. No credits were charged. Check source readability, provider capacity and the research query, then try again.",
        lease: null,
        leaseUntil: Date.now() + 60000,
        updatedAt: new Date().toISOString(),
      };
    }).catch(() => {});
  } finally {
    clearInterval(pulse);
  }
}
