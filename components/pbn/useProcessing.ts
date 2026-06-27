import { useCallback, useEffect, useRef, useState } from "react";
import {
  GUIProcessManager,
  OutputTab,
  ProcessCallbacks,
  ProcessResult,
} from "@/lib/pbn/guiprocessmanager";
import { CancellationToken, RGB } from "@/lib/pbn/common";
import { Settings } from "@/lib/pbn/settings";
import { svgToPngDataUrl } from "@/lib/pbn/svgExport";
import { OverallStatus, PHASE_LABELS, PHASE_WEIGHTS } from "./constants";
import { RenderOptions } from "./useRenderOptions";

interface UseProcessingArgs {
  buildSettings: () => Settings;
  renderOptions: RenderOptions;
  inputCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  originalImageRef: React.RefObject<string | null>;
  log: (msg: string) => void;
  clearLog: () => void;
  /** Called before the pipeline runs (e.g. to drop stale mixing recipes). */
  onProcessStart: () => void;
  /** Called with the new palette once processing finishes successfully. */
  onComplete: (colors: RGB[]) => void;
}

/**
 * Drives the GUIProcessManager pipeline: progress aggregation across phases,
 * (re)generating the output SVG when render options change, and producing the
 * before/after images for the comparison slider.
 */
export function useProcessing({
  buildSettings,
  renderOptions,
  inputCanvasRef,
  originalImageRef,
  log,
  clearLog,
  onProcessStart,
  onComplete,
}: UseProcessingArgs) {
  const {
    sizeMultiplier,
    fillFacets,
    showBorders,
    showLabels,
    labelFontSize,
    labelFontColor,
    fillOpacity,
  } = renderOptions;

  const [outputTab, setOutputTab] = useState<OutputTab | "log">("output-pane");
  const [compareImgs, setCompareImgs] = useState<{
    original: string;
    processed: string;
  } | null>(null);
  const [overall, setOverall] = useState<OverallStatus>({
    progress: 0,
    label: "",
    state: "idle",
  });
  const [palette, setPalette] = useState<RGB[]>([]);
  const [hasOutput, setHasOutput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // canvases & refs
  const kmeansCanvasRef = useRef<HTMLCanvasElement>(null);
  const reductionCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderPathCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderSegmentationCanvasRef = useRef<HTMLCanvasElement>(null);
  const labelPlacementCanvasRef = useRef<HTMLCanvasElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const processResultRef = useRef<ProcessResult | null>(null);
  const cancellationTokenRef = useRef<CancellationToken>(
    new CancellationToken(),
  );
  const overallProgressRef = useRef(0);
  const overallPctRef = useRef(-1);
  const phaseCompletedRunsRef = useRef<Record<string, number>>({});

  const cancel = useCallback(() => {
    cancellationTokenRef.current.isCancelled = true;
  }, []);

  const updateOutput = useCallback(
    async (standalone = true) => {
      const result = processResultRef.current;
      const container = svgContainerRef.current;
      if (!result || !container) return;

      const pipelineBase = standalone ? 0 : overallProgressRef.current;
      if (standalone) {
        overallProgressRef.current = 0;
        overallPctRef.current = -1;
        setOverall({ progress: 0, label: "SVG generation", state: "active" });
      }

      const svg = await GUIProcessManager.createSVG(
        result.facetResult,
        result.colorsByIndex,
        sizeMultiplier,
        fillFacets,
        showBorders,
        showLabels,
        labelFontSize,
        labelFontColor,
        fillOpacity,
        (svgProg) => {
          if (cancellationTokenRef.current.isCancelled) {
            throw new Error("Cancelled");
          }
          const p = standalone
            ? svgProg
            : pipelineBase + svgProg * PHASE_WEIGHTS.svg;
          const pct = Math.floor(p * 100);
          if (pct !== overallPctRef.current) {
            overallPctRef.current = pct;
            setOverall({
              progress: p,
              label: "SVG generation",
              state: "active",
            });
          }
        },
      );

      container.innerHTML = "";
      container.appendChild(svg);
      setPalette(result.colorsByIndex);
      setOverall({ progress: 1, label: "Done", state: "complete" });
    },
    [
      sizeMultiplier,
      fillFacets,
      showBorders,
      showLabels,
      labelFontSize,
      labelFontColor,
      fillOpacity,
    ],
  );

  const process = useCallback(async () => {
    const canvases = {
      input: inputCanvasRef.current,
      kmeans: kmeansCanvasRef.current,
      reduction: reductionCanvasRef.current,
      borderPath: borderPathCanvasRef.current,
      borderSegmentation: borderSegmentationCanvasRef.current,
      labelPlacement: labelPlacementCanvasRef.current,
    };
    if (Object.values(canvases).some((c) => c === null)) return;

    setIsProcessing(true);
    overallProgressRef.current = 0;
    overallPctRef.current = -1;
    phaseCompletedRunsRef.current = {};
    setOverall({ progress: 0, label: "Starting…", state: "active" });
    clearLog();
    // the palette is about to be regenerated; drop any stale recipes
    onProcessStart();

    // cancel old process & create new
    cancellationTokenRef.current.isCancelled = true;
    cancellationTokenRef.current = new CancellationToken();

    const settings = buildSettings();
    const totalRuns =
      settings.narrowPixelStripCleanupRuns === 0
        ? 1
        : settings.narrowPixelStripCleanupRuns;
    const multiRunPhases = new Set(["facetBuilding", "facetReduction"]);

    const callbacks: ProcessCallbacks = {
      onStatus: (phase, progress, state) => {
        const completedBefore = phaseCompletedRunsRef.current[phase] ?? 0;
        if (state === "complete") {
          phaseCompletedRunsRef.current[phase] = completedBefore + 1;
        }

        let total = 0;
        for (const [key, weight] of Object.entries(PHASE_WEIGHTS)) {
          if (key === "svg") continue;
          const runs = multiRunPhases.has(key) ? totalRuns : 1;
          const done = phaseCompletedRunsRef.current[key] ?? 0;
          if (key === phase && state === "active") {
            total += (weight * (done + progress)) / runs;
          } else {
            total += (weight * Math.min(done, runs)) / runs;
          }
        }

        const clamped = Math.max(
          overallProgressRef.current,
          Math.min(total, 0.95),
        );
        overallProgressRef.current = clamped;

        const pct = Math.floor(clamped * 100);
        if (pct === overallPctRef.current && state !== "complete") return;
        overallPctRef.current = pct;

        const runs = multiRunPhases.has(phase) ? totalRuns : 1;
        let label = PHASE_LABELS[phase];
        if (runs > 1 && state === "active") {
          label += ` (run ${completedBefore + 1}/${runs})`;
        }

        setOverall({ progress: clamped, label, state: "active" });
      },
      onSelectTab: (tab) => setOutputTab(tab),
      log,
    };

    try {
      processResultRef.current = await GUIProcessManager.process(
        settings,
        cancellationTokenRef.current,
        canvases as Parameters<typeof GUIProcessManager.process>[2],
        callbacks,
      );
      setHasOutput(true);
      await updateOutput(false);
      setOutputTab("output-pane");
      // auto-compute the mixing recipes guide for the new palette
      onComplete(processResultRef.current.colorsByIndex);
    } catch (e) {
      const err = e as Error;
      if (err.message === "Cancelled") {
        log("Processing cancelled.");
      } else {
        log("Error: " + err.message + " at " + err.stack);
      }
      setOverall({ progress: 0, label: "", state: "idle" });
    } finally {
      setIsProcessing(false);
    }
  }, [
    buildSettings,
    log,
    clearLog,
    updateOutput,
    onProcessStart,
    onComplete,
    inputCanvasRef,
  ]);

  // re-render the SVG when render options change (after a result exists)
  useEffect(() => {
    if (processResultRef.current) {
      void updateOutput();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showLabels,
    fillFacets,
    showBorders,
    sizeMultiplier,
    labelFontSize,
    labelFontColor,
    fillOpacity,
  ]);

  // build the before/after images for the compare slider from the current input
  // canvas and the freshly rendered output SVG. Runs whenever the output pane is
  // active (and re-runs when the SVG is regenerated via render options).
  useEffect(() => {
    if (outputTab !== "output-pane" || !hasOutput) return;
    let cancelled = false;
    (async () => {
      // wait a tick so any in-flight SVG re-render has committed to the DOM
      await Promise.resolve();
      const svg = svgContainerRef.current?.querySelector("svg");
      const original = originalImageRef.current;
      if (!svg || !original) return;
      const { dataUrl: processed } = await svgToPngDataUrl(svg as SVGSVGElement);
      if (!cancelled) setCompareImgs({ original, processed });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    outputTab,
    hasOutput,
    sizeMultiplier,
    fillFacets,
    showBorders,
    showLabels,
    labelFontSize,
    labelFontColor,
    fillOpacity,
  ]);

  return {
    // refs for the intermediate panes & output container
    kmeansCanvasRef,
    reductionCanvasRef,
    borderPathCanvasRef,
    borderSegmentationCanvasRef,
    labelPlacementCanvasRef,
    svgContainerRef,
    processResultRef,
    // state
    outputTab,
    setOutputTab,
    compareImgs,
    overall,
    palette,
    hasOutput,
    isProcessing,
    // actions
    process,
    cancel,
  };
}
