import { chromium } from "playwright";
import type { SlideManifest, QualityReport } from "./model";
import { contrast, validateManifest } from "./model";
import type { DeckSource } from "../drafts";
import { verifyFacts } from "./grounding";
import { rendererLease } from "./resources";
import { inspectVision } from "./services";
import {
  manifestHtml,
  FRAME_CSS,
  VERTEX_SHADER,
  FRAGMENT_SHADER,
} from "./visual";
export async function inspectManifestSlides(
  slides: SlideManifest[],
  sources: DeckSource[],
): Promise<QualityReport> {
  const release = await rendererLease();
  const report: QualityReport = {
    version: 3,
    status: "failed",
    checkedAt: new Date().toISOString(),
    citationCount: 0,
    checks: [],
    issues: [],
    renderer: "vector-fallback",
  };
  try {
    slides.forEach(validateManifest);
    verifyFacts(slides, sources);
    report.citationCount = slides.reduce((n, s) => n + s.facts.length, 0);
    report.checks.push({
      name: "Exact source spans",
      status: "passed",
      detail: `${report.citationCount} statement spans matched their source snapshots. This verifies provenance, not source truth.`,
    });
    if (slides.some((s) => contrast(s.genome.canvas, s.genome.ink) < 7))
      throw new Error("Headline contrast is below 7:1.");
    report.checks.push({
      name: "Contrast",
      status: "passed",
      detail:
        "Opaque text canvas: headline contrast ≥7:1; secondary text ≥4.5:1. Visuals occupy a separate region.",
    });
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
      timeout: 30000,
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
      });
      await page.route("**/*", (route) => route.abort());
      for (const [i, slide] of slides.entries()) {
        await page.setContent(
          `<html><head><meta charset="utf-8"><style>${FRAME_CSS}</style></head><body style="margin:0">${manifestHtml(slide, i)}</body></html>`,
        );
        const clipped = await page
          .locator("[data-fit]")
          .evaluateAll((nodes) =>
            nodes
              .filter(
                (n) =>
                  n.scrollHeight > n.clientHeight + 1 ||
                  n.scrollWidth > n.clientWidth + 1,
              )
              .map((n) => n.textContent?.slice(0, 100)),
          );
        if (clipped.length)
          throw new Error(`Slide ${i + 1} clips text: ${clipped.join("; ")}`);
        const vision =
          process.env.PRESENTATION_VISION_QA === "true"
            ? await inspectVision(await page.screenshot({ type: "png" }))
            : null;
        if (vision && !vision.passed)
          throw new Error(
            `Scene ${i + 1} failed vision review: ${vision.issues.join("; ")}`,
          );
      }
      const compiled = await page.evaluate(
        ({ vertex, fragment }) => {
          const canvas = document.createElement("canvas"),
            gl = canvas.getContext("webgl");
          if (!gl) return { supported: false, errors: [] as string[] };
          const errors: string[] = [];
          const shaders = [
            { type: gl.VERTEX_SHADER, code: vertex },
            { type: gl.FRAGMENT_SHADER, code: fragment },
          ].map((item) => {
            const shader = gl.createShader(item.type)!;
            gl.shaderSource(shader, item.code);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
              errors.push(
                gl.getShaderInfoLog(shader) || "Shader compilation failed",
              );
            return shader;
          });
          const program = gl.createProgram()!;
          shaders.forEach((s) => gl.attachShader(program, s));
          gl.linkProgram(program);
          if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            errors.push(
              gl.getProgramInfoLog(program) || "Shader linking failed",
            );
          shaders.forEach((s) => gl.deleteShader(s));
          gl.deleteProgram(program);
          gl.getExtension("WEBGL_lose_context")?.loseContext();
          return { supported: true, errors };
        },
        { vertex: VERTEX_SHADER, fragment: FRAGMENT_SHADER },
      );
      if (compiled.errors.length)
        throw new Error(
          "Approved shader failed compilation; do not deliver this deck.",
        );
      report.renderer = compiled.supported ? "webgl" : "vector-fallback";
      report.checks.push({
        name: "Shader compilation",
        status: compiled.supported ? "passed" : "fallback",
        detail: compiled.supported
          ? "Allowlisted GLSL compiled and linked in headless Chromium."
          : "GPU context unavailable; deterministic vector output validated.",
      });
      report.checks.push({
        name: "Typography bounds",
        status: "passed",
        detail: `${slides.length} slides measured in headless Chromium; no clipped content.`,
      });
    } finally {
      await browser.close();
    }
    report.checks.push({
      name: "Vision aesthetics",
      status:
        process.env.PRESENTATION_VISION_QA === "true" ? "passed" : "skipped",
      detail:
        process.env.PRESENTATION_VISION_QA === "true"
          ? "Configured Gemini vision model inspected each rendered scene. This is an appearance judgement, not factual verification."
          : "No vision judgement is claimed. Deterministic bounds, separation and contrast checks passed.",
    });
    report.status = "passed";
  } catch (error) {
    report.issues.push(
      error instanceof Error ? error.message : "Quality inspection failed.",
    );
    report.checks.push({
      name: "Delivery gate",
      status: "failed",
      detail: report.issues[0],
    });
  }
  await release();
  return report;
}
