"use client";
import { useEffect, useRef } from "react";
import type {
  DeckSlide,
  DeckTemplate,
  BrandKit,
  SlideObject,
} from "@/lib/presentations/model";
import {
  slideObjects,
  deckTheme,
  chartRange,
  presentationLanguage,
  presentationFont,
} from "@/lib/presentations/layout";
export interface PreviewMeasurement {
  slide: string;
  issues: string[];
}
export default function SlideCanvas({
  slide,
  template,
  index = 0,
  brand,
  selected,
  onSelect,
  imageBase = "/api/writing/images/",
  onMeasure,
  language = "english",
}: {
  slide: DeckSlide;
  template: DeckTemplate;
  index?: number;
  brand?: BrandKit;
  selected?: string;
  onSelect?: (o: SlideObject) => void;
  imageBase?: string;
  onMeasure?: (measurement: PreviewMeasurement) => void;
  language?: string;
}) {
  const canvas = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!onMeasure || !canvas.current) return;
    const element = canvas.current;
    let disposed = false;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        const issues: string[] = [];
        if (element.clientWidth < 200 || !element.clientHeight) return;
        element
          .querySelectorAll<HTMLElement>(
            ".deck-object, .deck-data, footer span",
          )
          .forEach((box) => {
            if (box.querySelector("img")) return;
            if (
              box.scrollHeight > box.clientHeight + 2 ||
              box.scrollWidth > box.clientWidth + 2
            ) {
              const description = (box.textContent || "")
                .trim()
                .replace(/\s+/g, " ")
                .slice(0, 48);
              issues.push(
                `Text is clipped in the preview: ${description || "slide content"}.`,
              );
            }
          });
        onMeasure({
          slide: slide.id || slide.title,
          issues: [...new Set(issues)],
        });
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    document.fonts.ready.then(() => {
      if (!disposed) measure();
    });
    document.fonts.addEventListener("loadingdone", measure);
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [slide, template, brand, language, onMeasure]);
  const theme = deckTheme(template, brand),
    objects = slideObjects(slide, theme.ink, theme.accent),
    chart = slide.chart,
    range = chart ? chartRange(chart.values) : null;
  return (
    <article
      ref={canvas}
      lang={presentationLanguage(language)}
      className="deck-canvas"
      aria-label={`Slide ${index + 1}: ${slide.title}`}
      style={{
        background: "#" + theme.background,
        color: "#" + theme.ink,
        fontFamily: `'${presentationFont(language, theme.font)}', Arial, sans-serif`,
      }}
    >
      <div className="deck-accent" style={{ background: "#" + theme.accent }} />
      {objects.map((o) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: o.x + "%",
          top: o.y + "%",
          width: o.w + "%",
          height: o.h + "%",
          fontSize: `${o.fontSize / 9.6}cqw`,
          fontWeight: o.bold ? 700 : 400,
          color: o.color,
          textAlign: o.align,
        };
        return (
          <div
            key={o.id}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={
              onSelect
                ? `Select ${o.type} object: ${o.text.slice(0, 50) || o.imageAlt}`
                : undefined
            }
            aria-pressed={onSelect ? selected === o.id : undefined}
            onClick={() => onSelect?.(o)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(o);
              }
            }}
            className={
              selected === o.id ? "deck-object selected" : "deck-object"
            }
            style={style}
          >
            {o.type === "image" ? (
              <img
                src={imageBase + o.imageId}
                alt={o.imageAlt || "Slide image"}
              />
            ) : (
              o.text
            )}
          </div>
        );
      })}
      {slide.layout === "table" && (
        <div className="deck-data">
          <table>
            <tbody>
              {slide.table.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {slide.layout === "chart" && chart && range && (
        <div className="deck-data deck-chart">
          <p>{chart.label}</p>
          {chart.labels.map((label, i) => {
            const position = ((chart.values[i] - range.min) / range.span) * 100;
            return (
              <div className="deck-chart-row" key={i}>
                <span>{label}</span>
                <div className="deck-plot">
                  <i className="deck-zero" style={{ left: range.zero + "%" }} />
                  <i
                    className="deck-bar"
                    style={{
                      left: Math.min(position, range.zero) + "%",
                      width: Math.abs(position - range.zero) + "%",
                      background: "#" + theme.accent,
                    }}
                  />
                </div>
                <strong>{chart.values[i]}</strong>
              </div>
            );
          })}
        </div>
      )}
      <footer>
        <span>{slide.citations.join(" · ")}</span>
        <b>{index + 1}</b>
      </footer>
    </article>
  );
}
