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
import OutputTabs from "./pbn/OutputTabs";
import ProgressBar from "./pbn/ProgressBar";
import RenderOptionsPane from "./pbn/RenderOptionsPane";
import MixingGuide from "./pbn/MixingGuide";
import ExportControls from "./pbn/ExportControls";
import styles from "./PaintByNumbers.module.css";

export default function PaintByNumbers() {
  const { logLines, log, clearLog } = useLog();
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
    <div className={styles.container}>
      <h2>Paint by number generator</h2>
      <p>
        Paste from clipboard (ctrl+v) to change the image (or browse for a file{" "}
        <input
          ref={input.fileInputRef}
          type="file"
          accept="image/x-png,image/gif,image/jpeg"
          onChange={input.onFileChange}
        />
        ). Large images are very slow to process though.
      </p>

      <InputOptionsPane opts={inputOptions} />

      <div className={styles.pane}>
        <canvas ref={input.inputCanvasRef} className={styles.canvas} />
      </div>

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

      <ProgressBar overall={processing.overall} />

      <OutputTabs
        outputTab={processing.outputTab}
        onSelect={processing.setOutputTab}
      />

      <div
        hidden={processing.outputTab !== "kmeans-pane"}
        className={styles.pane}
      >
        <canvas ref={processing.kmeansCanvasRef} className={styles.canvas} />
      </div>
      <div
        hidden={processing.outputTab !== "reduction-pane"}
        className={styles.pane}
      >
        <canvas ref={processing.reductionCanvasRef} className={styles.canvas} />
      </div>
      <div
        hidden={processing.outputTab !== "borderpath-pane"}
        className={styles.pane}
      >
        <canvas
          ref={processing.borderPathCanvasRef}
          className={styles.canvas}
        />
      </div>
      <div
        hidden={processing.outputTab !== "bordersegmentation-pane"}
        className={styles.pane}
      >
        <canvas
          ref={processing.borderSegmentationCanvasRef}
          className={styles.canvas}
        />
      </div>
      <div
        hidden={processing.outputTab !== "labelplacement-pane"}
        className={styles.pane}
      >
        <canvas
          ref={processing.labelPlacementCanvasRef}
          className={styles.canvas}
        />
      </div>

      {/* output pane */}
      <div
        hidden={processing.outputTab !== "output-pane"}
        className={styles.pane}
      >
        <RenderOptionsPane
          opts={renderOptions}
          palette={processing.palette}
          svgContainerRef={processing.svgContainerRef}
        />

        {processing.compareImgs && (
          <ImageCompareSlider
            originalSrc={processing.compareImgs.original}
            processedSrc={processing.compareImgs.processed}
            leftLabel="Original"
            rightLabel="Resultado"
          />
        )}

        <MixingGuide
          recipes={mixing.recipes}
          palette={processing.palette}
          guideRef={guideRef}
        />

        <ExportControls exp={exp} hasOutput={processing.hasOutput} />
      </div>

      <div hidden={processing.outputTab !== "log"} className={styles.pane}>
        <div className={styles.log}>
          {logLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
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
    </div>
  );
}
