import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import { fixtureSource } from "./hybrid-fixture";
import { factFromQuote } from "../lib/presentations/hybrid/grounding";
import {
  DEFAULT_GENOME,
  type SlideManifest,
} from "../lib/presentations/hybrid/model";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-media-test-"));
Object.assign(process.env, {
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  PRESENTATION_NARRATION_ENABLED: "false",
  PRESENTATION_VISION_QA: "false",
});
async function main() {
  const slide: SlideManifest = {
    version: 3,
    id: "test-scene",
    headline: "Protect every database transaction",
    category: "THE BIG IDEA",
    thesis: "Use transaction guarantees deliberately",
    role: "hook",
    visualEngine: "three",
    metaphor: "architecture",
    facts: [
      factFromQuote(
        fixtureSource,
        "A database transaction groups related changes into one unit.",
      ),
    ],
    notes: "PRIVATE_NOTE",
    duration: 5,
    visual: { seed: 17, density: 0.6, speed: 0.35, exploded: false },
    genome: DEFAULT_GENOME,
  };
  const { boundedJson, neuralNarration, inspectVision } =
    await import("../lib/presentations/hybrid/services");
  await assert.rejects(
    () => boundedJson(new Response("x".repeat(100)), 20),
    /size/,
  );
  await assert.rejects(
    () => neuralNarration("fixture", slide),
    /not configured/,
  );
  assert.equal(await inspectVision(Buffer.from("x")), null);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    PRESENTATION_NARRATION_ENABLED: "true",
    KOKORO_BASE_URL: "https://voice.example.test/",
    KOKORO_VOICE: "af_bella",
    PRESENTATION_VISION_QA: "true",
    GEMINI_API_KEY: "fixture-not-external",
    PRESENTATION_VISION_MODEL: "gemini-fixture",
  });
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("captioned_speech")) {
      assert.equal(JSON.parse(String(init?.body)).stream, false);
      return Response.json({
        audio: Buffer.from("fixture-mp3-data").toString("base64"),
        timestamps: [{ word: "Protect", start: 0, end: 0.4 }],
      });
    }
    assert(String(url).includes("gemini-fixture"));
    return Response.json({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ passed: true, issues: [] }) }],
          },
        },
      ],
    });
  };
  try {
    const voice = await neuralNarration("fixture", slide);
    assert.equal(voice.timestamps[0].word, "Protect");
    assert.equal((await inspectVision(Buffer.from("png")))?.passed, true);
    globalThis.fetch = async () =>
      Response.json({
        audio: "AAAA",
        timestamps: [{ word: "bad", start: 10, end: 1 }],
      });
    await assert.rejects(
      () => neuralNarration("another-fixture", slide),
      /timing/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env.PRESENTATION_VISION_QA = "false";
  }
  const dir = "output/live-audit/hybrid-video";
  mkdirSync(dir, { recursive: true });
  const serveUrl = await bundle({
      entryPoint: join(process.cwd(), "lib/presentations/hybrid/VideoRoot.tsx"),
      publicDir: null,
    }),
    browserExecutable = chromium.executablePath(),
    inputProps = { slides: [slide], vertical: false };
  const composition = await selectComposition({
    serveUrl,
    id: "Syaahi",
    inputProps,
    browserExecutable,
  });
  assert.equal(composition.width, 3840);
  assert.equal(composition.height, 2160);
  assert.equal(composition.fps, 60);
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: "h264",
    outputLocation: join(dir, "4k-60-two-frame-smoke.mp4"),
    frameRange: [0, 1],
    browserExecutable,
    concurrency: 1,
    isProduction: false,
  });
  assert.equal(
    readFileSync(join(dir, "4k-60-two-frame-smoke.mp4"))
      .subarray(4, 8)
      .toString(),
    "ftyp",
  );
  const portraitProps = { slides: [slide], vertical: true },
    portrait = await selectComposition({
      serveUrl,
      id: "Syaahi",
      inputProps: portraitProps,
      browserExecutable,
    });
  assert.equal(portrait.width, 1080);
  assert.equal(portrait.height, 1920);
  await renderStill({
    composition: portrait,
    serveUrl,
    inputProps: portraitProps,
    output: join(dir, "vertical.png"),
    frame: 45,
    browserExecutable,
  });
  console.log(
    "PASS media: configured neural/vision contracts, bounded responses and invalid timing rejection; actual Remotion 4K/60 two-frame MP4 smoke and 1080×1920 portrait frame. Full-length hosted throughput and live voice/vision are not claimed.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
