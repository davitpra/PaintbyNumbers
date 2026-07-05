"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RGB } from "@/lib/pbn/common";
import { getPaperAspect } from "@/lib/pbn/svgExport";
import { buildHighlightOverlayDataUrl } from "@/lib/pbn/highlight";
import CropModal from "./CropModal";
import ImageCompareSlider from "./ImageCompareSlider";
import { PAPER_LABELS } from "./pbn/constants";
import { useLog } from "./pbn/useLog";
import { useImageInput } from "./pbn/useImageInput";
import { useInputOptions } from "./pbn/useInputOptions";
import { useRenderOptions } from "./pbn/useRenderOptions";
import { usePaintMixing } from "./pbn/usePaintMixing";
import { useProcessing } from "./pbn/useProcessing";
import { useExport } from "./pbn/useExport";
import InputOptionsPane from "./pbn/InputOptionsPane";
import ProgressBar from "./pbn/ProgressBar";
import RenderOptionsPane from "./pbn/RenderOptionsPane";
import ColorPalettePane from "./pbn/ColorPalettePane";
import MixingGuide from "./pbn/MixingGuide";
import ExportControls from "./pbn/ExportControls";
import styles from "./PaintByNumbers.module.css";

export default function PaintByNumbers() {
  const { log, clearLog } = useLog();
  const input = useImageInput(log);
  const inputOptions = useInputOptions();
  const renderOptions = useRenderOptions();
  const mixing = usePaintMixing();
  const guideRef = useRef<HTMLDivElement>(null);
  const [showGuide, setShowGuide] = useState(false);
  // color index spotlighted in the preview, or null when none is selected
  const [selectedColor, setSelectedColor] = useState<number | null>(null);

  // Close the mixing-guide modal with Escape.
  useEffect(() => {
    if (!showGuide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowGuide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showGuide]);

  const { setRecipes, computeRecipes } = mixing;
  const onProcessStart = useCallback(() => {
    setRecipes(null);
    // drop any spotlight tied to the palette we're about to replace
    setSelectedColor(null);
  }, [setRecipes]);
  const onComplete = useCallback(
    (colors: RGB[]) => void computeRecipes(colors),
    [computeRecipes],
  );

  const processing = useProcessing({
    buildSettings: inputOptions.buildSettings,
    renderOptions,
    inputCanvasRef: input.inputCanvasRef,
    originalImageRef: input.originalImageRef,
    log,
    clearLog,
    onProcessStart,
    onComplete,
  });

  // Rebuild the spotlight overlay whenever the selected color changes. Keyed on
  // palette so it recomputes against the fresh facet result after a reprocess,
  // and on the render options so the overlay's borders/labels track the toggles.
  const highlightSrc = useMemo(() => {
    const result = processing.processResultRef.current;
    if (selectedColor === null || !result) return undefined;
    return buildHighlightOverlayDataUrl(
      result.facetResult,
      selectedColor,
      result.colorsByIndex,
      {
        showBorders: renderOptions.showBorders,
        showLabels: renderOptions.showLabels,
        fontSize: renderOptions.labelFontSize,
        fontColor: renderOptions.labelFontColor,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedColor,
    processing.palette,
    renderOptions.showBorders,
    renderOptions.showLabels,
    renderOptions.labelFontSize,
    renderOptions.labelFontColor,
  ]);

  const exp = useExport({
    svgContainerRef: processing.svgContainerRef,
    guideRef,
    processResultRef: processing.processResultRef,
    recipes: mixing.recipes,
    palette: processing.palette,
  });

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h2>Paint by number generator</h2>
        <p>
          Paste from clipboard (ctrl+v) to change the image, or browse for a
          file in the upload step. Large images are very slow to process though.
        </p>
      </header>

      <div className={styles.layout}>
        {/* ---- Sidebar: numbered step cards ---- */}
        <aside className={styles.sidebar}>
          {/* Step 1: Upload your image */}
          <section className={styles.stepCard}>
            <h3 className={styles.stepTitle}>
              <span className={styles.stepNum}>1</span>
              Upload your image
            </h3>
            <p className={styles.stepHint}>
              Upload a clear photo with good lighting.
            </p>
            <input
              ref={input.fileInputRef}
              type="file"
              accept="image/x-png,image/gif,image/jpeg"
              onChange={input.onFileChange}
              hidden
            />
            <button
              type="button"
              className={`${styles.dropzone} ${
                input.isDragging ? styles.dropzoneActive : ""
              } ${input.imageSrc ? styles.dropzoneFilled : ""}`}
              onClick={input.openFilePicker}
              onDragOver={input.onDragOver}
              onDragLeave={input.onDragLeave}
              onDrop={input.onDrop}
            >
              {input.imageSrc ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={input.imageSrc}
                    alt="Selected image preview"
                    className={styles.dropzonePreview}
                  />
                  <span className={styles.dropzoneOverlay}>
                    Click or drop to replace
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.dropzoneText}>
                    Drag &amp; drop your image here, or{" "}
                    <strong>click to browse</strong>
                  </span>
                  <span className={styles.dropzoneHint}>
                    Paste from your clipboard (Ctrl+V) · PNG, JPG or GIF
                  </span>
                </>
              )}
            </button>
          </section>

          {/* Step 2: Image settings */}
          <section className={styles.stepCard}>
            <h3 className={styles.stepTitle}>
              <span className={styles.stepNum}>2</span>
              Image settings
            </h3>
            <InputOptionsPane opts={inputOptions} imageSrc={input.imageSrc} />
          </section>
        </aside>

        {/* ---- Main: preview area ---- */}
        <main className={styles.main}>
          <div className={styles.previewBar}>
            <strong>Preview</strong>
            <button
              className={styles.btn}
              onClick={() => void processing.process()}
              disabled={processing.isProcessing}
            >
              {processing.isProcessing ? "Processing..." : "Process image"}
            </button>
            {processing.isProcessing && (
              <button className={styles.btnCancel} onClick={processing.cancel}>
                Cancel
              </button>
            )}
          </div>

          <ProgressBar overall={processing.overall} />

          <div className={styles.previewArea}>
            {/* keep the canvas mounted (the pipeline writes to it) but hide it
                once the comparison slider is available */}
            <div
              className={styles.canvasWrap}
              hidden={!!processing.compareImgs && !processing.isProcessing}
            >
              <canvas ref={input.inputCanvasRef} className={styles.canvas} />
              {processing.isProcessing && (
                <div className={styles.processingOverlay} />
              )}
            </div>
            {processing.compareImgs && !processing.isProcessing && (
              <ImageCompareSlider
                originalSrc={processing.compareImgs.original}
                processedSrc={processing.compareImgs.processed}
                leftLabel="Original"
                rightLabel="Result"
                highlightSrc={highlightSrc}
              />
            )}
          </div>

          {processing.compareImgs && !processing.isProcessing && (
            <>
              <RenderOptionsPane opts={renderOptions} />
              <ColorPalettePane
                palette={processing.palette}
                recipes={mixing.recipes}
                showGuide={showGuide}
                onToggleGuide={() => setShowGuide((v) => !v)}
                selectedColor={selectedColor}
                onSelectColor={(i) =>
                  setSelectedColor((prev) => (prev === i ? null : i))
                }
              />
            </>
          )}

          {/* keep the SVG container mounted (the pipeline writes into it) but
              hide it until the image has finished processing */}
          <div
            ref={processing.svgContainerRef}
            className={styles.svgContainer}
            hidden={!processing.compareImgs || processing.isProcessing}
          />
          {/* The mixing guide opens in a modal when toggled. When closed it
              stays mounted off-screen so PNG/PDF export can still capture it. */}
          {showGuide ? (
            <div
              className={styles.modalBackdrop}
              onClick={() => setShowGuide(false)}
            >
              <div
                className={`${styles.modal} ${styles.guideModal}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <span> </span>
                  <button
                    className={styles.modalClose}
                    onClick={() => setShowGuide(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className={styles.guideModalBody}>
                  <MixingGuide
                    recipes={mixing.recipes}
                    palette={processing.palette}
                    guideRef={guideRef}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.guideOffscreen} aria-hidden>
              <MixingGuide
                recipes={mixing.recipes}
                palette={processing.palette}
                guideRef={guideRef}
              />
            </div>
          )}

          <section className={styles.stepCard}>
            <h3 className={styles.stepTitle}>
              <span className={styles.stepNum}>3</span>
              Preview &amp; download
            </h3>
            <ExportControls exp={exp} hasOutput={processing.hasOutput} />
          </section>
        </main>
      </div>

      {exp.cropModal && (
        <CropModal
          imageSrc={exp.cropModal.src}
          imageWidth={exp.cropModal.w}
          imageHeight={exp.cropModal.h}
          aspect={getPaperAspect(exp.paperFormat, exp.paperOrientation)}
          title={`${PAPER_LABELS[exp.paperFormat]} ${exp.paperOrientation}`}
          onCancel={() => exp.setCropModal(null)}
          onConfirm={exp.handleCropConfirm}
        />
      )}

      {/* intermediate-step canvases: kept in the DOM as draw targets for the
          pipeline, but never shown to the user */}
      <div hidden>
        <canvas ref={processing.kmeansCanvasRef} />
        <canvas ref={processing.reductionCanvasRef} />
        <canvas ref={processing.borderPathCanvasRef} />
        <canvas ref={processing.borderSegmentationCanvasRef} />
        <canvas ref={processing.labelPlacementCanvasRef} />
      </div>
    </div>
  );
}
