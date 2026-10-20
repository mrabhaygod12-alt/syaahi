import { randomUUID } from "node:crypto";
import { mutateState } from "@/lib/study/state";
export class RendererBusy extends Error {
  constructor() {
    super("The presentation renderer is busy. Your job will retry shortly.");
    this.name = "RendererBusy";
  }
}
/** A shared database lease caps Chromium work across the web process and worker. */
export async function rendererLease() {
  const token = randomUUID();
  await mutateState(
    "presentation-system",
    "render-slot",
    { token: "", until: 0 },
    (old) => {
      if (old.until > Date.now()) throw new RendererBusy();
      return { token, until: Date.now() + 120000 };
    },
  );
  const pulse = setInterval(
    () =>
      void mutateState(
        "presentation-system",
        "render-slot",
        { token: "", until: 0 },
        (old) =>
          old.token === token ? { token, until: Date.now() + 120000 } : old,
      ).catch(() => {}),
    30000,
  );
  pulse.unref();
  return async () => {
    clearInterval(pulse);
    await mutateState(
      "presentation-system",
      "render-slot",
      { token: "", until: 0 },
      (old) => (old.token === token ? { token: "", until: 0 } : old),
    );
  };
}
