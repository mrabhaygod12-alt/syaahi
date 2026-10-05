import { loadEnvConfig } from "@next/env";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
loadEnvConfig(process.cwd());
process.env.DATA_DIR =
  process.argv[2] || mkdtempSync(join(tmpdir(), "syaahi-live-engine-"));
process.env.DATA_BACKEND = "sqlite";
process.env.MONGODB_URI = "";
process.env.WORKER_MODE = "external";
// This fixture never syncs an account to hosted authentication.
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.SUPABASE_SECRET_KEY = "";
process.env.SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
async function main() {
  const { register } = await import("../lib/auth/server"),
    { ownedSources, planDeck } = await import("../lib/presentations/drafts"),
    { createDeck, processDeck, ownedDeck, retryDeck } =
      await import("../lib/presentations/store"),
    { exportDeck } = await import("../lib/presentations/native-export"),
    { visualExport } = await import("../lib/presentations/visual-export"),
    { chatWithFallback } = await import("../lib/ai/router"),
    { db } = await import("../lib/db");
  const row = process.argv[2]
    ? (db()
        .prepare(
          "SELECT payload FROM workspace_records WHERE kind='presentation' LIMIT 1",
        )
        .get() as { payload: string } | undefined)
    : undefined;
  let deck: import("../lib/presentations/store").Deck | null = row
    ? JSON.parse(row.payload)
    : null;
  const owner = deck
    ? { id: deck.owner }
    : await register(
        "Live QA fixture",
        "live-engine-" + randomUUID() + "@example.test",
        "safe-fixture-password",
      );
  if (!deck) {
    const sources = await ownedSources(
      owner.id,
      [{ kind: "web", url: "https://www.syaahii.in/about" }],
      48000,
    );
    assert(sources[0].text.length > 150);
    console.log(
      "PASS live public article extraction",
      sources[0].locator,
      sources[0].text.length,
    );
    const draft = await planDeck(owner.id, {
      prompt:
        "Explain Syaahi's purpose to a new learner using the supplied About page. Create a clear six-slide story: hook, context, useful ideas and a takeaway. Use at least three qualitative layouts, concise headings and restrained descriptions. Only use claims supported by the source.",
      language: "english",
      template: "studio",
      count: 6,
      audience: "New learners",
      format: "presenter",
      sources,
      designEngine: 2,
    });
    console.log(
      "PASS live storyboard",
      draft.storyboard?.beats.map((b) => b.archetype),
    );
    deck = await createDeck(owner.id, {
      prompt: draft.prompt,
      context: sources[0].text,
      language: draft.language,
      template: draft.template,
      count: draft.count,
      outline: draft.outline,
      sources,
      designEngine: 2,
      storyboard: draft.storyboard,
    });
  }
  const dir = "output/live-audit/archetype-live";
  mkdirSync(dir, { recursive: true });
  let calls = 0,
    retries = 0;
  if (deck.status === "error") deck = await retryDeck(owner.id, deck.id);
  while (deck.status !== "done") {
    if (deck.leaseUntil > Date.now()) {
      console.log("Waiting for the saved provider retry deadline.");
      await new Promise((r) =>
        setTimeout(r, Math.min(60000, deck!.leaseUntil - Date.now())),
      );
      deck = (await ownedDeck(owner.id, deck.id))!;
      continue;
    }
    let unavailable = false;
    await processDeck(
      deck.id,
      async (
        messages: import("../lib/ai/router").ChatMsg[],
        opts: { maxTokens: number; json?: boolean },
      ) => {
        console.log("Model pass", ++calls);
        try {
          const result = await chatWithFallback(messages, opts);
          writeFileSync(dir + "/pass-" + calls + ".json", result.text);
          console.log("Model provider", result.provider);
          return result;
        } catch (e) {
          unavailable =
            e instanceof Error &&
            e.message.startsWith("AI providers unavailable");
          console.log(
            "Provider failure",
            unavailable ? (e as Error).message : "unavailable",
          );
          throw e;
        }
      },
    );
    deck = (await ownedDeck(owner.id, deck.id))!;
    console.log(
      "Live engine progress",
      deck.slides.length,
      deck.status,
      deck.provider,
    );
    writeFileSync(dir + "/deck.json", JSON.stringify(deck, null, 2));
    if (deck.status === "error" && unavailable && retries++ < 1) {
      console.log(
        "Waiting 60 seconds before one manual resume of the saved deck.",
      );
      await new Promise((r) => setTimeout(r, 60000));
      deck = await retryDeck(owner.id, deck.id);
      continue;
    }
    assert.notEqual(deck.status, "error");
  }
  writeFileSync(dir + "/deck.pptx", await exportDeck(deck));
  writeFileSync(dir + "/deck.pdf", await visualExport(deck, "pdf"));
  for (let i = 0; i < deck.count; i++)
    writeFileSync(
      dir + "/slide-" + (i + 1) + ".png",
      await visualExport(deck, "png", i),
    );
  console.log(
    "PASS real configured-model research → storyboard → slots → editorial → saved slides → PPTX/PDF/PNG. Local fixture wallet only; no customer account or payment used.",
  );
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Live engine failed");
    process.exit(1);
  });
