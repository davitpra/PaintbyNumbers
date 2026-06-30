"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./ImageCompareSlider.module.css";

interface ImageCompareSliderProps {
  /** Shown on the left (revealed) side of the divider. */
  originalSrc: string;
  /** Shown on the right side and defines the rendered size. */
  processedSrc: string;
  leftLabel?: string;
  rightLabel?: string;
}

export default function ImageCompareSlider({
  originalSrc,
  processedSrc,
  leftLabel,
  rightLabel,
}: ImageCompareSliderProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, next)));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      updateFromClientX(e.clientX);
    },
    [updateFromClientX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        updateFromClientX(e.clientX);
      }
    },
    [updateFromClientX],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* base = processed, defines the rendered size */}
      <img
        className={styles.baseImg}
        src={processedSrc}
        alt=""
        draggable={false}
      />
      {/* overlay = original, clipped to the left of the divider */}
      <img
        className={styles.overlayImg}
        src={originalSrc}
        alt=""
        draggable={false}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      {/* transparent guard: absorbs right-click / long-press so it lands on a
          plain div instead of an <img> (no "Save image as"). Pointer events
          still bubble to the wrapper, so the slider drag keeps working. */}
      <div className={styles.guard} aria-hidden />
      {leftLabel && (
        <span className={`${styles.label} ${styles.labelLeft}`}>
          {leftLabel}
        </span>
      )}
      {rightLabel && (
        <span className={`${styles.label} ${styles.labelRight}`}>
          {rightLabel}
        </span>
      )}
      <div className={styles.handle} style={{ left: `${pos}%` }}>
        <span className={styles.handleGrip}>⇄</span>
      </div>
    </div>
  );
}
