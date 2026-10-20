import React from "react";
import {
  AbsoluteFill,
  Composition,
  Sequence,
  registerRoot,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { SlideManifest } from "./model";
import { visualSvg } from "./visual";
export type MovieProps = { slides: SlideManifest[]; vertical: boolean };
export function MovieScene({
  slide,
  index,
  vertical,
}: {
  slide: SlideManifest;
  index: number;
  vertical: boolean;
}) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig(),
    g = slide.genome;
  const enter = Math.min(1, frame / (fps * 0.4)),
    scale = vertical ? 1 : 3;
  return (
    <AbsoluteFill
      style={{
        background: g.canvas,
        color: g.ink,
        fontFamily: `${g.font},Arial,sans-serif`,
        padding: vertical ? 76 : 64 * scale,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: vertical ? 780 : 60 * scale,
          left: vertical ? 80 : 690 * scale,
          width: vertical ? 920 : 540 * scale,
          height: vertical ? 760 : 560 * scale,
          opacity: 0.9,
          transform: `scale(${0.94 + enter * 0.06})`,
        }}
        dangerouslySetInnerHTML={{ __html: visualSvg(slide, frame / fps) }}
      />
      <div
        style={{
          position: "relative",
          width: vertical ? "100%" : "47%",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 18}px)`,
        }}
      >
        <div
          style={{
            fontSize: vertical ? 23 : 13 * scale,
            letterSpacing: 4,
            color: g.accent,
          }}
        >
          {slide.category}
        </div>
        <h1
          style={{
            fontSize: vertical ? 78 : 48 * scale,
            lineHeight: 1.08,
            letterSpacing: -2,
            margin: vertical ? "35px 0 42px" : "78px 0 90px",
            fontWeight: 700,
          }}
        >
          {slide.headline}
        </h1>
        <div style={{ display: "grid", gap: vertical ? 32 : 35 * scale }}>
          {slide.facts.map((f, i) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                gap: vertical ? 22 : 18 * scale,
                fontSize: vertical ? 30 : 20 * scale,
                lineHeight: 1.45,
              }}
            >
              <span
                style={{
                  color: g.accent,
                  fontSize: vertical ? 19 : 12 * scale,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                {f.statement}
                <sup style={{ fontSize: vertical ? 17 : 11 * scale }}>
                  {" "}
                  [{i + 1}]
                </sup>
              </span>
            </div>
          ))}
        </div>
      </div>
      <footer
        style={{
          position: "absolute",
          left: vertical ? 76 : 64 * scale,
          right: vertical ? 76 : 64 * scale,
          bottom: vertical ? 65 : 35 * scale,
          display: "flex",
          gap: 30,
          justifyContent: "space-between",
          color: g.muted,
          fontSize: vertical ? 22 : 11 * scale,
          lineHeight: 1.5,
        }}
      >
        <span>
          {slide.facts
            .map(
              (f, i) =>
                `[${i + 1}] ${f.documentTitle.slice(0, 70)}${f.pageNumber ? `, p. ${f.pageNumber}` : ""}`,
            )
            .join(" · ")}
        </span>
        <span>{String(index + 1).padStart(2, "0")}</span>
      </footer>
    </AbsoluteFill>
  );
}
export function Movie({ slides, vertical }: MovieProps) {
  let from = 0;
  return (
    <AbsoluteFill>
      {slides.map((s, i) => {
        const start = from,
          duration = Math.ceil(s.duration * 60);
        from += duration;
        return (
          <Sequence key={s.id} from={start} durationInFrames={duration}>
            <MovieScene slide={s} index={i} vertical={vertical} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
const Root = () => (
  <Composition
    id="Syaahi"
    component={Movie}
    fps={60}
    width={3840}
    height={2160}
    durationInFrames={60}
    defaultProps={{ slides: [], vertical: false } as MovieProps}
    calculateMetadata={({ props }: { props: MovieProps }) => ({
      width: props.vertical ? 1080 : 3840,
      height: props.vertical ? 1920 : 2160,
      durationInFrames: Math.max(
        1,
        props.slides.reduce((n, s) => n + Math.ceil(s.duration * 60), 0),
      ),
    })}
  />
);
registerRoot(Root);
