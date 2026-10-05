"use client";
import { useEffect, useRef, useState } from "react";
import type { ScanPreparation } from "@/lib/intake/image";
export default function ImagePreparation({
  file,
  busy,
  onRead,
  onCancel,
}: {
  file: File;
  busy: boolean;
  onRead: (p: ScanPreparation) => void;
  onCancel: () => void;
}) {
  const [rotation, setRotation] = useState<ScanPreparation["rotation"]>(0),
    [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 }),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    image = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    const url = URL.createObjectURL(file),
      img = new Image();
    img.onload = () => {
      if (!alive) return;
      if (img.naturalWidth * img.naturalHeight > 20_000_000) {
        setError("Use an image under 20 megapixels.");
        return;
      }
      image.current = img;
      setReady(true);
    };
    img.onerror = () =>
      alive &&
      setError("This image could not be decoded. Use PNG, JPEG or WebP.");
    img.src = url;
    return () => {
      alive = false;
      image.current = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    const img = image.current,
      target = canvas.current;
    if (!img || !target || !ready) return;
    const w = rotation % 180 ? img.naturalHeight : img.naturalWidth,
      h = rotation % 180 ? img.naturalWidth : img.naturalHeight;
    const scale = Math.min(1, 1200 / Math.max(w, h)),
      rotated = document.createElement("canvas");
    rotated.width = Math.round(w * scale);
    rotated.height = Math.round(h * scale);
    const ctx = rotated.getContext("2d");
    if (!ctx) return;
    ctx.translate(rotated.width / 2, rotated.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(
      img,
      (-img.naturalWidth * scale) / 2,
      (-img.naturalHeight * scale) / 2,
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    );
    target.width = Math.max(1, Math.round((rotated.width * crop.width) / 100));
    target.height = Math.max(
      1,
      Math.round((rotated.height * crop.height) / 100),
    );
    target
      .getContext("2d")
      ?.drawImage(
        rotated,
        (rotated.width * crop.x) / 100,
        (rotated.height * crop.y) / 100,
        target.width,
        target.height,
        0,
        0,
        target.width,
        target.height,
      );
  }, [ready, rotation, crop]);
  return (
    <section
      className="scan-preparation"
      aria-label="Prepare scan for text extraction"
    >
      <h3>Prepare this scan</h3>
      <p className="small">
        {file.name} · Rotate first, then crop around the text. Review the
        transcription before planning; diagrams and handwriting can be
        uncertain.
      </p>
      <canvas
        ref={canvas}
        role="img"
        aria-label="Preview of the rotated and cropped scan"
      />
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy || !ready}>
        <legend>Scan adjustments</legend>
        <label>
          Rotation
          <select
            value={rotation}
            onChange={(e) => {
              setRotation(Number(e.target.value) as typeof rotation);
              setCrop({ x: 0, y: 0, width: 100, height: 100 });
            }}
          >
            {[0, 90, 180, 270].map((n) => (
              <option key={n} value={n}>
                {n}° clockwise
              </option>
            ))}
          </select>
        </label>
        {(["x", "y", "width", "height"] as const).map((k) => (
          <label key={k}>
            {
              {
                x: "Left crop",
                y: "Top crop",
                width: "Crop width",
                height: "Crop height",
              }[k]
            }{" "}
            (%)
            <input
              type="number"
              min={k === "x" || k === "y" ? 0 : 1}
              max={100}
              value={crop[k]}
              onChange={(e) => {
                const n = Math.max(
                  k === "x" || k === "y" ? 0 : 1,
                  Math.min(100, Number(e.target.value) || 0),
                );
                setCrop((old) => {
                  const c = { ...old, [k]: n };
                  c.x = Math.min(c.x, 99);
                  c.y = Math.min(c.y, 99);
                  c.width = Math.min(c.width, 100 - c.x);
                  c.height = Math.min(c.height, 100 - c.y);
                  return c;
                });
              }}
            />
          </label>
        ))}
        <button
          type="button"
          className="btn light"
          onClick={() => {
            setRotation(0);
            setCrop({ x: 0, y: 0, width: 100, height: 100 });
          }}
        >
          Reset image
        </button>
      </fieldset>
      <div className="composer-stage-actions">
        <button className="btn light" disabled={busy} onClick={onCancel}>
          Cancel scan
        </button>
        <button
          className="btn dark"
          disabled={busy || !ready || !!error}
          onClick={() => onRead({ rotation, crop })}
        >
          Read prepared scan
        </button>
      </div>
      <p className="small">
        The image is sent for extraction only when you select Read prepared
        scan. Syaahi saves the extracted text with your draft; it does not store
        the original image here.
      </p>
    </section>
  );
}
