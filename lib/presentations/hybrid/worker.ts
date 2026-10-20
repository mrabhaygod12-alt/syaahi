import { randomUUID } from "node:crypto";
import { mutateRecord } from "@/lib/workspace-records";
import { type Deck, ownedDeck } from "../store";
import { manifestForBeat, manifestSlide, validateHybridPlan } from "./pipeline";
import { inspectManifestSlides } from "./quality";
import { hybridCredits } from "./model";
import { RendererBusy } from "./resources";
export async function processHybridDeck(id: string) {
  const lease = randomUUID();
  let deck: Deck;
  try {
    deck = await mutateRecord<Deck>(id, (old) => {
      if (
        !old ||
        old.designEngine !== 3 ||
        !["queued", "working"].includes(old.status) ||
        old.leaseUntil > Date.now()
      )
        throw new Error("Deck is not available.");
      return {
        ...old,
        status: "working",
        lease,
        leaseUntil: Date.now() + 180000,
        stage: "Building source-backed visual scenes",
        updatedAt: new Date().toISOString(),
      };
    });
  } catch {
    return;
  }
  const change = (fn: (old: Deck) => Deck) =>
    mutateRecord<Deck>(id, (old) => {
      if (!old || old.lease !== lease || old.status !== "working")
        throw new Error("Lease lost.");
      return { ...fn(old), updatedAt: new Date().toISOString() };
    });
  const pulse = setInterval(() => {
    void change((old) => ({ ...old, leaseUntil: Date.now() + 180000 })).catch(
      () => {},
    );
  }, 30000);
  pulse.unref();
  try {
    const plan = validateHybridPlan(
      deck.hybridPlan,
      deck.sources || [],
      deck.count,
    );
    while (deck.slides.length < deck.count) {
      const slide = manifestSlide(
        manifestForBeat(plan, deck.slides.length),
        deck.sources || [],
      );
      deck = await change((old) => ({
        ...old,
        slides: [...old.slides, slide],
        stage: `Scene ${old.slides.length + 1} of ${old.count}: citations verified`,
        leaseUntil: Date.now() + 180000,
      }));
    }
    deck = await change((old) => ({
      ...old,
      stage:
        "Inspecting every scene: typography, contrast, source spans and shaders",
    }));
    const quality = await inspectManifestSlides(
      deck.slides.map((s) => s.manifest!),
      deck.sources || [],
    );
    if (quality.status !== "passed") {
      await change((old) => ({ ...old, quality }));
      throw new Error(quality.issues[0] || "The quality gate did not pass.");
    }
    await change((old) => ({
      ...old,
      status: "done",
      quality,
      stage: "Source checks and visual quality gate passed",
      lease: null,
      leaseUntil: 0,
      error: null,
    }));
  } catch (error) {
    if (error instanceof RendererBusy) {
      await change((old) => ({
        ...old,
        status: "queued",
        lease: null,
        leaseUntil: Date.now() + 10000,
        stage: "Waiting for the shared rendering slot",
      }));
      clearInterval(pulse);
      return ownedDeck(deck.owner, id);
    }
    try {
      await mutateRecord<Deck>(
        id,
        (old) => {
          if (!old || old.lease !== lease || old.status !== "working")
            throw new Error("Lease lost.");
          return {
            ...old,
            status: "error",
            stage: "Review required",
            error: `The presentation did not pass delivery checks. ${error instanceof Error ? error.message : "Please retry."} Reserved credits were returned.`,
            lease: null,
            leaseUntil: 0,
            updatedAt: new Date().toISOString(),
          };
        },
        {
          delta: deck.creditsReserved ?? hybridCredits(deck.count),
          event: `deck-refund:${id}:${deck.attempt}`,
        },
      );
    } catch {
      /* Another worker owns the current reservation. */
    }
  } finally {
    clearInterval(pulse);
  }
  return ownedDeck(deck.owner, id);
}
