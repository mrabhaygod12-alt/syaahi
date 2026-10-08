import { workerConcurrency } from "./capacity";
import { pendingJobs } from "./store";
import { processJob } from "./runner";
import { collection, useMongo } from "@/lib/storage/mongo";
import { deliverStudyReminders } from "@/lib/study/reminders";
import { indexDocumentBatch } from "@/lib/documents/vectors";
import { processPendingDeck } from "@/lib/presentations/store";
import { publishDueStories } from "@/lib/writing/publishing";
const state = globalThis as unknown as {
  syaahiWorker?: ReturnType<typeof setInterval>;
  syaahiTick?: boolean;
  syaahiReminderTick?: number;
};
export function kickWorker(standalone = false) {
  if (process.env.WORKER_MODE === "external" && !standalone) return;
  const tick = async () => {
    if (state.syaahiTick) return;
    state.syaahiTick = true;
    try {
      // A separate worker can fail while the web service keeps answering
      // requests. Record a cheap heartbeat so monitors can detect that split.
      if (standalone && useMongo()) {
        try {
          await (
            await collection("system_state")
          ).updateOne(
            { _id: "generation_worker" },
            { $set: { seenAt: new Date(), role: "worker" } },
            { upsert: true },
          );
        } catch {
          // Processing still gets a chance when the diagnostic write fails.
        }
      }
      await publishDueStories();
      await Promise.all(
        (await pendingJobs()).slice(0, workerConcurrency()).map(processJob),
      );
      await processPendingDeck();
      if (standalone) await indexDocumentBatch();
      // Email reminders are deliberately throttled; generation keeps priority.
      if (
        standalone &&
        Date.now() - (state.syaahiReminderTick || 0) > 15 * 60_000
      ) {
        state.syaahiReminderTick = Date.now();
        const result = await deliverStudyReminders();
        if (result.delivered)
          console.info(`Delivered ${result.delivered} study reminder(s).`);
      }
    } catch (error) {
      console.error(
        "Worker tick failed",
        error instanceof Error ? error.message : "unknown",
      );
    } finally {
      state.syaahiTick = false;
    }
  };
  if (!state.syaahiWorker) {
    state.syaahiWorker = setInterval(tick, 5000);
    state.syaahiWorker.unref();
  }
  void tick();
}
