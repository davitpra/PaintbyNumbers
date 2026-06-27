"use client";

import { useCallback, useRef } from "react";
import { RGB } from "@/lib/pbn/common";
import { getPaperAspect } from "@/lib/pbn/svgExport";
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

  const { setRecipes, computeRecipes } = mixing;
  const onProcessStart = useCallback(() => setRecipes(null), [setRecipes]);
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
            <InputOptionsPane opts={inputOptions} />
          </section>

          {/* Step 3: Preview & download */}
          <section className={styles.stepCard}>
            <h3 className={styles.stepTitle}>
              <span className={styles.stepNum}>3</span>
              Preview &amp; download
            </h3>
            <ExportControls exp={exp} hasOutput={processing.hasOutput} />
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
            <div className={styles.canvasWrap}>
              <canvas ref={input.inputCanvasRef} className={styles.canvas} />
              {processing.isProcessing && (
                <div className={styles.processingOverlay} />
              )}
            </div>
            {processing.compareImgs && (
              <ImageCompareSlider
                originalSrc={processing.compareImgs.original}
                processedSrc={processing.compareImgs.processed}
                leftLabel="Original"
                rightLabel="Resultado"
              />
            )}
          </div>

          <div className={styles.zoomBar}>
            <RenderOptionsPane
              opts={renderOptions}
              palette={processing.palette}
              svgContainerRef={processing.svgContainerRef}
            />
          </div>

          <section className={styles.paletteSection}>
            <strong>Color Palette</strong>
          </section>

          <MixingGuide
            recipes={mixing.recipes}
            palette={processing.palette}
            guideRef={guideRef}
          />
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
