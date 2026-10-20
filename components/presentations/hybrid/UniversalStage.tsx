"use client";
import { useEffect, useRef, useState } from "react";
import type { SlideManifest } from "@/lib/presentations/hybrid/model";
import { visualSvg } from "@/lib/presentations/hybrid/visual";
import type { VisualHandle } from "./renderers";
export type StageStats = {
  fps: number | null;
  renderer: string;
  buffers: number | null;
  detail: string;
};
export default function UniversalStage({
  slide,
  index = 0,
  time = 0,
  playing = true,
  interactive = true,
  orbit = false,
  camera = 0,
  audioBeat = 0,
  wordEmphasis = 0,
  onCitation,
  onStats,
  world,
}: {
  slide: SlideManifest;
  index?: number;
  time?: number;
  playing?: boolean;
  interactive?: boolean;
  orbit?: boolean;
  camera?: number;
  audioBeat?: number;
  wordEmphasis?: number;
  onCitation?: (index: number) => void;
  onStats?: (stats: StageStats) => void;
  world?: SlideManifest[];
}) {
  const host = useRef<HTMLDivElement>(null),
    invalidation = useRef(0),
    handle = useRef<VisualHandle | null>(null),
    latest = useRef({
      time,
      playing,
      camera,
      audioBeat,
      wordEmphasis,
      onStats,
      onCitation,
      index,
    }),
    [runtime, setRuntime] = useState("vector"),
    [detail, setDetail] = useState("");
  latest.current = {
    time,
    playing,
    camera,
    audioBeat,
    wordEmphasis,
    onStats,
    onCitation,
    index,
  };
  const renderKey = JSON.stringify(
    (world?.length ? world : [slide]).map((s) => ({
      id: s.id,
      engine: world?.length ? "world" : s.visualEngine,
      metaphor: s.metaphor,
      visual: s.visual,
      genome: s.genome,
    })),
  );
  useEffect(() => {
    if (!host.current || !interactive) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setRuntime("vector");
      setDetail("Reduced-motion vector view");
      latest.current.onStats?.({
        fps: null,
        renderer: "vector",
        buffers: null,
        detail: "Reduced motion",
      });
      return;
    }
    const layer = document.createElement("div");
    layer.className = "cv-runtime-layer";
    host.current.append(layer);
    let disposed = false,
      raf = 0,
      frames = 0,
      period = performance.now(),
      elapsed = 0,
      last = period,
      previousInputs = "",
      settlingUntil = 0;
    const fallback = (message: string) => {
      if (disposed) return;
      setRuntime("vector");
      setDetail(message);
      handle.current?.dispose();
      handle.current = null;
      layer.replaceChildren();
      latest.current.onStats?.({
        fps: null,
        renderer: "vector",
        buffers: null,
        detail: message,
      });
    };
    const loss = (e: Event) => {
      e.preventDefault();
      fallback("Graphics context lost; readable vector view restored.");
    };
    layer.addEventListener("webglcontextlost", loss, true);
    const mounting = world?.length
      ? import("./world").then((m) =>
          m.mountWorld(layer, world, (fact) =>
            latest.current.onCitation?.(fact),
          ),
        )
      : import("./renderers").then((m) =>
          m.mountVisual(layer, slide, (fact) =>
            latest.current.onCitation?.(fact),
          ),
        );
    void mounting
      .then((h) => {
        if (disposed) {
          h.dispose();
          return;
        }
        handle.current = h;
        setRuntime(world?.length ? "three-world" : slide.visualEngine);
        setDetail("");
        const draw = (now: number) => {
          if (disposed || !handle.current) return;
          const current = latest.current;
          if (current.playing && document.visibilityState !== "hidden")
            elapsed += Math.min(0.05, (now - last) / 1000);
          last = now;
          const inputs = [
            current.time,
            current.camera,
            current.audioBeat,
            current.wordEmphasis,
            current.index,
            invalidation.current,
          ].join(":");
          if (inputs !== previousInputs) {
            settlingUntil = now + (world?.length ? 1000 : 60);
            previousInputs = inputs;
          }
          const shouldDraw =
            document.visibilityState !== "hidden" &&
            (current.playing || now < settlingUntil);
          try {
            if (shouldDraw)
              h.draw(
                current.time + elapsed,
                current.audioBeat,
                current.wordEmphasis,
                current.camera,
                current.index,
              );
          } catch {
            fallback("The renderer could not continue; vector view restored.");
            return;
          }
          if (shouldDraw) frames++;
          if (now - period >= 1000) {
            current.onStats?.({
              fps: Math.round((frames * 1000) / (now - period)),
              renderer: world?.length ? "three-world" : slide.visualEngine,
              buffers: h.memoryBytes ?? null,
              detail:
                "Measured frame delivery; GPU VRAM is not exposed by the browser.",
            });
            frames = 0;
            period = now;
          }
          raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
      })
      .catch(() =>
        fallback(
          slide.visualEngine === "spline"
            ? "An owned Spline scene is required. Showing vector view."
            : `${slide.visualEngine} is unavailable on this device. Showing vector view.`,
        ),
      );
    const resize = new ResizeObserver(() => {
      invalidation.current++;
      handle.current?.resize(
        Math.max(1, layer.clientWidth),
        Math.max(1, layer.clientHeight),
      );
    });
    resize.observe(layer);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      layer.removeEventListener("webglcontextlost", loss, true);
      handle.current?.dispose();
      handle.current = null;
      layer.remove();
    };
  }, [renderKey, interactive]);
  const g = slide.genome;
  return (
    <article
      className="cv-slide"
      data-engine={runtime}
      data-slide-id={slide.id}
      style={
        {
          background: g.canvas,
          color: g.ink,
          fontFamily: `${g.font},Arial,sans-serif`,
          "--cv-accent": g.accent,
          "--cv-secondary": g.secondary,
        } as React.CSSProperties
      }
      aria-label={`Slide ${index + 1}: ${slide.headline}`}
    >
      <div className="cv-slide-copy">
        <span className="cv-slide-category">{slide.category}</span>
        <h2 data-fit>{slide.headline}</h2>
        <div className="cv-slide-facts">
          {slide.facts.map((f, i) => (
            <button
              data-fit
              key={f.id + ":" + i}
              type="button"
              onClick={() => onCitation?.(i)}
              disabled={!onCitation}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {f.statement}
              <sup>[{i + 1}]</sup>
            </button>
          ))}
        </div>
      </div>
      {slide.genome.logoId && (
        <img
          className="cv-slide-logo"
          src={`/api/writing/images/${slide.genome.logoId}`}
          alt="Presentation brand logo"
        />
      )}
      <div
        className="cv-slide-visual"
        ref={host}
        onPointerMove={(e) => {
          if (orbit) {
            invalidation.current++;
            const box = e.currentTarget.getBoundingClientRect();
            handle.current?.orbit?.(
              (e.clientX - box.left) / box.width - 0.5,
              0.5 - (e.clientY - box.top) / box.height,
            );
          }
        }}
      >
        <div
          className={
            "cv-vector-view" + (runtime === "vector" ? " visible" : "")
          }
          dangerouslySetInnerHTML={{ __html: visualSvg(slide, time) }}
        />
        {interactive && (
          <div className="cv-visual-hits">
            {slide.facts.map((f, i) => (
              <button
                key={f.id}
                aria-label={`Inspect source ${i + 1}: ${f.documentTitle}`}
                style={{
                  left: `${28 + i * 23}%`,
                  top: `${25 + (i % 2) * 38}%`,
                }}
                onClick={() => onCitation?.(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
      <footer>
        <span>
          {slide.facts.map((f, i) => (
            <button
              key={f.id + ":" + i}
              onClick={() => onCitation?.(i)}
              disabled={!onCitation}
            >
              [{i + 1}] {f.documentTitle.slice(0, 35)}
              {f.pageNumber ? ` · p. ${f.pageNumber}` : ""}
            </button>
          ))}
        </span>
        <b>{String(index + 1).padStart(2, "0")}</b>
      </footer>
      {detail && <span className="cv-renderer-note">{detail}</span>}
    </article>
  );
}
