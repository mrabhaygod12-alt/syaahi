import { workerConcurrency } from "./capacity";
import { pendingJobs } from "./store";
import { processJob } from "./runner";
import { collection, useMongo } from "@/lib/storage/mongo";
const state = globalThis as unknown as {
  syaahiWorker?: ReturnType<typeof setInterval>;
  syaahiTick?: boolean;
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
      await Promise.all(
        (await pendingJobs()).slice(0, workerConcurrency()).map(processJob),
      );
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
