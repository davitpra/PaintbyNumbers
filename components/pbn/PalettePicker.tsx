import { useCallback, useEffect, useRef, useState } from "react";
import { RGB } from "@/lib/pbn/common";
import { extractDominantColors, sampleColorAt } from "@/lib/pbn/palettePicker";
import { InputOptions } from "./useInputOptions";
import styles from "../PaintByNumbers.module.css";

const rgbCss = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const rgbKey = (c: RGB) => `${c[0]},${c[1]},${c[2]}`;
const sameColor = (a: RGB, b: RGB) =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// Loupe magnification and the size of the source region it magnifies.
const LOUPE_SIZE = 120;
const LOUPE_SRC = 15; // odd, so there's a centered pixel under the crosshair

/** A single clickable color chip; shows a check when active. */
function Swatch({
  color,
  active,
  onClick,
  onRemove,
  title,
}: {
  color: RGB;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  title?: string;
}) {
  return (
    <span className={styles.paletteSwatchWrap}>
      <button
        type="button"
        className={active ? styles.paletteSwatchActive : styles.paletteSwatch}
        style={{ background: rgbCss(color) }}
        onClick={onClick}
        title={title ?? rgbCss(color)}
        aria-label={title ?? rgbCss(color)}
      >
        {active && <span className={styles.paletteSwatchCheck}>✓</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          className={styles.paletteSwatchRemove}
          onClick={onRemove}
          aria-label={`Remove ${rgbCss(color)}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export default function PalettePicker({
  opts,
  imageSrc,
}: {
  opts: InputOptions;
  imageSrc: string | null;
}) {
  const [suggested, setSuggested] = useState<RGB[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Extract dominant colors whenever the source image changes.
  useEffect(() => {
    if (!imageSrc) {
      setSuggested([]);
      return;
    }
    let cancelled = false;
    extractDominantColors(imageSrc, 12)
      .then((colors) => {
        if (!cancelled) setSuggested(colors);
      })
      .catch(() => {
        if (!cancelled) setSuggested([]);
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const isPicked = useCallback(
    (c: RGB) => opts.pickedColors.some((p) => sameColor(p, c)),
    [opts.pickedColors],
  );

  return (
    <div className={styles.optGroup}>
      <span className={styles.optGroupTitle}>Palette</span>
      <span className={styles.fieldSub}>
        Pick the colors your paint-by-number should use. Leave empty to let the
        app choose them automatically.
      </span>

      {opts.pickedColors.length > 0 && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Your colors</span>
          <div className={styles.paletteRow}>
            {opts.pickedColors.map((c) => (
              <Swatch
                key={rgbKey(c)}
                color={c}
                onRemove={() => opts.removePickedColor(c)}
              />
            ))}
            <button
              type="button"
              className={styles.paletteClear}
              onClick={opts.clearPickedColors}
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {suggested.length > 0 && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Suggested from photo</span>
          <div className={styles.paletteRow}>
            {suggested.map((c) => (
              <Swatch
                key={rgbKey(c)}
                color={c}
                active={isPicked(c)}
                onClick={() => opts.togglePickedColor(c)}
              />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className={styles.presetBtn}
        onClick={() => setPickerOpen(true)}
        disabled={!imageSrc}
      >
        Pick from photo
      </button>

      {opts.pickedColors.length > 0 && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>How to use them</span>
          <div className={styles.segmented} role="radiogroup">
            <label
              className={
                opts.paletteMode === "exact"
                  ? styles.segmentActive
                  : styles.segment
              }
            >
              <input
                type="radio"
                name="palettemode"
                className={styles.segmentInput}
                checked={opts.paletteMode === "exact"}
                onChange={() => opts.setPaletteMode("exact")}
              />
              Only my colors
            </label>
            <label
              className={
                opts.paletteMode === "complement"
                  ? styles.segmentActive
                  : styles.segment
              }
            >
              <input
                type="radio"
                name="palettemode"
                className={styles.segmentInput}
                checked={opts.paletteMode === "complement"}
                onChange={() => opts.setPaletteMode("complement")}
              />
              My colors + auto
            </label>
          </div>
        </div>
      )}

      {pickerOpen && imageSrc && (
        <EyedropperModal
          imageSrc={imageSrc}
          suggested={suggested}
          pickedColors={opts.pickedColors}
          isPicked={isPicked}
          onPick={opts.addPickedColor}
          onToggleSuggested={opts.togglePickedColor}
          onRemove={opts.removePickedColor}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function EyedropperModal({
  imageSrc,
  suggested,
  pickedColors,
  isPicked,
  onPick,
  onToggleSuggested,
  onRemove,
  onClose,
}: {
  imageSrc: string;
  suggested: RGB[];
  pickedColors: RGB[];
  isPicked: (c: RGB) => boolean;
  onPick: (c: RGB) => void;
  onToggleSuggested: (c: RGB) => void;
  onRemove: (c: RGB) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [hoverColor, setHoverColor] = useState<RGB | null>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);

  // Draw the pristine image into the canvas at its natural resolution; CSS
  // scales it down for display while sampling stays pixel-accurate.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Convert a pointer event to canvas pixel coordinates.
  const toCanvasXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return {
      x,
      y,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y, offsetX, offsetY } = toCanvasXY(e);
    setHoverColor(sampleColorAt(canvas, x, y));
    setLoupe({ x: offsetX, y: offsetY });

    // render the magnified region into the loupe canvas
    const loupeCanvas = loupeRef.current;
    if (loupeCanvas) {
      const lctx = loupeCanvas.getContext("2d");
      if (lctx) {
        lctx.imageSmoothingEnabled = false;
        lctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
        const sx = Math.round(x) - (LOUPE_SRC - 1) / 2;
        const sy = Math.round(y) - (LOUPE_SRC - 1) / 2;
        lctx.drawImage(
          canvas,
          sx,
          sy,
          LOUPE_SRC,
          LOUPE_SRC,
          0,
          0,
          LOUPE_SIZE,
          LOUPE_SIZE,
        );
        // crosshair over the centered pixel
        const px = LOUPE_SIZE / 2;
        const cell = LOUPE_SIZE / LOUPE_SRC;
        lctx.strokeStyle = "rgba(0,0,0,0.9)";
        lctx.lineWidth = 1;
        lctx.strokeRect(px - cell / 2, px - cell / 2, cell, cell);
        lctx.strokeStyle = "rgba(255,255,255,0.9)";
        lctx.strokeRect(
          px - cell / 2 - 1,
          px - cell / 2 - 1,
          cell + 2,
          cell + 2,
        );
      }
    }
  };

  const onLeave = () => {
    setLoupe(null);
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = toCanvasXY(e);
    onPick(sampleColorAt(canvas, x, y));
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.eyedropperModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span>Pick colors from your photo</span>
          <button
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className={styles.modalHint}>
          Click anywhere on the photo to add that color to your palette. The
          swatches below are the colors detected automatically.
        </p>
        <div className={styles.eyedropperStage}>
          <div className={styles.eyedropperCanvasWrap}>
            <canvas
              ref={canvasRef}
              className={styles.eyedropperCanvas}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
              onClick={onClick}
            />
            {loupe && (
              <div
                className={styles.loupe}
                style={{
                  left: loupe.x,
                  top: loupe.y,
                  width: LOUPE_SIZE,
                  height: LOUPE_SIZE,
                }}
              >
                <canvas
                  ref={loupeRef}
                  width={LOUPE_SIZE}
                  height={LOUPE_SIZE}
                  className={styles.loupeCanvas}
                />
              </div>
            )}
          </div>
        </div>
        <div className={styles.eyedropperFooter}>
          <div className={styles.eyedropperCurrent}>
            <span
              className={styles.eyedropperCurrentSwatch}
              style={{
                background: hoverColor ? rgbCss(hoverColor) : "transparent",
              }}
            />
            <span className={styles.eyedropperCurrentLabel}>
              {hoverColor
                ? `rgb(${hoverColor[0]}, ${hoverColor[1]}, ${hoverColor[2]})`
                : "Hover over the photo"}
            </span>
          </div>
          {pickedColors.length > 0 && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Your colors</span>
              <div className={styles.paletteRow}>
                {pickedColors.map((c) => (
                  <Swatch
                    key={rgbKey(c)}
                    color={c}
                    onRemove={() => onRemove(c)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
