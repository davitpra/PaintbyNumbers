"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  GUIProcessManager,
  OutputTab,
  ProcessCallbacks,
  ProcessPhase,
  ProcessResult,
} from "@/lib/pbn/guiprocessmanager";
import { CancellationToken, RGB } from "@/lib/pbn/common";
import { ClusteringColorSpace, Settings } from "@/lib/pbn/settings";
import {
  CropRect,
  downloadPDF,
  downloadPDFCropped,
  downloadPNG,
  downloadSVG,
  getPaperAspect,
  PaperFormat,
  PaperOrientation,
  PdfSize,
  svgToPngDataUrl,
} from "@/lib/pbn/svgExport";
import { downloadPalettePng } from "@/lib/pbn/paletteExport";
import { DEFAULT_BASE_PAINTS } from "@/lib/pbn/basePaints";
import CropModal from "./CropModal";
import styles from "./PaintByNumbers.module.css";

const PAPER_LABELS: Record<PaperFormat, string> = {
  a3: "A3",
  a4: "A4",
  a5: "A5",
  letter: "Letter",
  legal: "Legal",
  tabloid: "Tabloid",
};

const EXAMPLE_IMAGES: Record<string, string> = {
  trivial: "https://i.imgur.com/o5CqO57.png",
  small: "https://i.imgur.com/YgYLDGP.png",
  medium: "https://i.imgur.com/nLeNgYbr.jpg",
};

const PHASE_WEIGHTS: Record<ProcessPhase | "svg", number> = {
  kMeans: 0.25,
  facetBuilding: 0.1,
  facetReduction: 0.3,
  facetBorderPath: 0.15,
  facetBorderSegmentation: 0.07,
  facetLabelPlacement: 0.08,
  svg: 0.05,
};

const PHASE_LABELS: Record<ProcessPhase | "svg", string> = {
  kMeans: "K-means clustering",
  facetBuilding: "Facet building",
  facetReduction: "Small facet pruning",
  facetBorderPath: "Border detection",
  facetBorderSegmentation: "Border segmentation",
  facetLabelPlacement: "Label placement",
  svg: "SVG generation",
};

const OUTPUT_TABS: { key: OutputTab; label: string }[] = [
  { key: "kmeans-pane", label: "Quantized image" },
  { key: "reduction-pane", label: "Facet reduction" },
  { key: "borderpath-pane", label: "Border tracing" },
  { key: "bordersegmentation-pane", label: "Border segmentation" },
  { key: "labelplacement-pane", label: "Label placement" },
  { key: "output-pane", label: "Output" },
];

type OverallStatus = {
  progress: number;
  label: string;
  state: "idle" | "active" | "complete";
};

interface PresetValues {
  resizeWidth: number;
  resizeHeight: number;
  nrOfClusters: number;
  removeFacetsSmallerThan: number;
  narrowPixelCleanupRuns: number;
  halveBorderSegments: number;
}

const PRESETS: { key: string; label: string; apply: PresetValues }[] = [
  {
    key: "photo",
    label: "Photo (fast)",
    apply: {
      resizeWidth: 600,
      resizeHeight: 600,
      nrOfClusters: 12,
      removeFacetsSmallerThan: 60,
      narrowPixelCleanupRuns: 1,
      halveBorderSegments: 2,
    },
  },
  {
    key: "illustration",
    label: "Illustration (default)",
    apply: {
      resizeWidth: 1024,
      resizeHeight: 1024,
      nrOfClusters: 16,
      removeFacetsSmallerThan: 20,
      narrowPixelCleanupRuns: 3,
      halveBorderSegments: 2,
    },
  },
  {
    key: "detailed",
    label: "Detailed (slow)",
    apply: {
      resizeWidth: 1280,
      resizeHeight: 1280,
      nrOfClusters: 24,
      removeFacetsSmallerThan: 12,
      narrowPixelCleanupRuns: 3,
      halveBorderSegments: 1,
    },
  },
];

export default function PaintByNumbers() {
  // input options
  const [resizeImage, setResizeImage] = useState(true);
  const [resizeWidth, setResizeWidth] = useState(1024);
  const [resizeHeight, setResizeHeight] = useState(1024);
  const [nrOfClusters, setNrOfClusters] = useState(16);
  const [clusterPrecision, setClusterPrecision] = useState(1);
  const [randomSeed, setRandomSeed] = useState(0);
  const [colorSpace, setColorSpace] = useState<ClusteringColorSpace>(
    ClusteringColorSpace.RGB,
  );
  const [colorRestrictions, setColorRestrictions] = useState(
    "//0,0,0\n//255,255,255\n",
  );
  const [narrowPixelCleanupRuns, setNarrowPixelCleanupRuns] = useState(3);
  const [removeFacetsSmallerThan, setRemoveFacetsSmallerThan] = useState(20);
  const [maximumNumberOfFacets, setMaximumNumberOfFacets] = useState(100000);
  const [largeToSmall, setLargeToSmall] = useState(true);
  const [halveBorderSegments, setHalveBorderSegments] = useState(2);

  // output render options
  const [showLabels, setShowLabels] = useState(true);
  const [fillFacets, setFillFacets] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [sizeMultiplier, setSizeMultiplier] = useState(3);
  const [labelFontSize, setLabelFontSize] = useState(50);
  const [labelFontColor, setLabelFontColor] = useState("#000");
  const [fillOpacity, setFillOpacity] = useState(1);

  // pdf export options
  const [pdfUnit, setPdfUnit] = useState<"cm" | "in">("cm");
  const [pdfWidth, setPdfWidth] = useState<number>(21);
  const [pdfHeight, setPdfHeight] = useState<number>(29.7);
  const [paperFormat, setPaperFormat] = useState<PaperFormat>("a4");
  const [paperOrientation, setPaperOrientation] =
    useState<PaperOrientation>("portrait");
  const [cropModal, setCropModal] = useState<{
    src: string;
    w: number;
    h: number;
  } | null>(null);

  // ui state
  const [inputTab, setInputTab] = useState<"input" | "options">("input");
  const [outputTab, setOutputTab] = useState<OutputTab | "log">("output-pane");
  const [overall, setOverall] = useState<OverallStatus>({
    progress: 0,
    label: "",
    state: "idle",
  });
  const [logLines, setLogLines] = useState<string[]>([]);
  const [palette, setPalette] = useState<RGB[]>([]);
  const [hasOutput, setHasOutput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipes, setRecipes] = useState<
    import("@/lib/pbn/paintMixing").MixRecipe[] | null
  >(null);
  const [mixingBusy, setMixingBusy] = useState(false);
  const [mixingProgress, setMixingProgress] = useState(0);
  const [showBasePaints, setShowBasePaints] = useState(false);

  // canvases & refs
  const inputCanvasRef = useRef<HTMLCanvasElement>(null);
  const kmeansCanvasRef = useRef<HTMLCanvasElement>(null);
  const reductionCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderPathCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderSegmentationCanvasRef = useRef<HTMLCanvasElement>(null);
  const labelPlacementCanvasRef = useRef<HTMLCanvasElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processResultRef = useRef<ProcessResult | null>(null);
  const cancellationTokenRef = useRef<CancellationToken>(
    new CancellationToken(),
  );
  const overallProgressRef = useRef(0);
  const overallPctRef = useRef(-1);
  const phaseCompletedRunsRef = useRef<Record<string, number>>({});

  const log = useCallback((msg: string) => {
    setLogLines((prev) => [...prev, msg]);
  }, []);

  const drawImageToInput = useCallback((img: HTMLImageElement) => {
    const c = inputCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0);
  }, []);

  const loadExample = useCallback(
    (name: keyof typeof EXAMPLE_IMAGES) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => drawImageToInput(img);
      img.onerror = () => log("Unable to load example image: " + name);
      img.src = EXAMPLE_IMAGES[name];
    },
    [drawImageToInput, log],
  );

  // load a default example & wire up clipboard paste
  useEffect(() => {
    loadExample("small");

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            drawImageToInput(img);
            URL.revokeObjectURL(url);
          };
          img.src = url;
          e.preventDefault();
          return;
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [loadExample, drawImageToInput]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => drawImageToInput(img);
        img.onerror = () => alert("Unable to load image");
        img.src = reader.result as string;
      };
      reader.readAsDataURL(files[0]);
    },
    [drawImageToInput],
  );

  const applyPreset = (p: PresetValues) => {
    setResizeImage(true);
    setResizeWidth(p.resizeWidth);
    setResizeHeight(p.resizeHeight);
    setNrOfClusters(p.nrOfClusters);
    setRemoveFacetsSmallerThan(p.removeFacetsSmallerThan);
    setNarrowPixelCleanupRuns(p.narrowPixelCleanupRuns);
    setHalveBorderSegments(p.halveBorderSegments);
  };

  // derived: a preset is "active" when the current options match it exactly,
  // so hand-editing any field simply deselects all presets
  const isPresetActive = (p: PresetValues) =>
    resizeImage &&
    resizeWidth === p.resizeWidth &&
    resizeHeight === p.resizeHeight &&
    nrOfClusters === p.nrOfClusters &&
    removeFacetsSmallerThan === p.removeFacetsSmallerThan &&
    narrowPixelCleanupRuns === p.narrowPixelCleanupRuns &&
    halveBorderSegments === p.halveBorderSegments;

  const cancel = useCallback(() => {
    cancellationTokenRef.current.isCancelled = true;
  }, []);

  const buildSettings = useCallback((): Settings => {
    const settings = new Settings();
    settings.kMeansClusteringColorSpace = colorSpace;
    settings.removeFacetsFromLargeToSmall = largeToSmall;
    settings.randomSeed = randomSeed;
    settings.kMeansNrOfClusters = nrOfClusters;
    settings.kMeansMinDeltaDifference = clusterPrecision;
    settings.removeFacetsSmallerThanNrOfPoints = removeFacetsSmallerThan;
    settings.maximumNumberOfFacets = maximumNumberOfFacets;
    settings.nrOfTimesToHalveBorderSegments = halveBorderSegments;
    settings.narrowPixelStripCleanupRuns = narrowPixelCleanupRuns;
    settings.resizeImageIfTooLarge = resizeImage;
    settings.resizeImageWidth = resizeWidth;
    settings.resizeImageHeight = resizeHeight;

    settings.kMeansColorRestrictions = [];
    for (const line of colorRestrictions.split("\n")) {
      const tline = line.trim();
      if (tline.indexOf("//") === 0) continue;
      const rgbparts = tline.split(",");
      if (rgbparts.length === 3) {
        let red = parseInt(rgbparts[0]);
        let green = parseInt(rgbparts[1]);
        let blue = parseInt(rgbparts[2]);
        if (red < 0) red = 0;
        if (red > 255) red = 255;
        if (green < 0) green = 0;
        if (green > 255) green = 255;
        if (blue < 0) blue = 0;
        if (blue > 255) blue = 255;
        if (!isNaN(red) && !isNaN(green) && !isNaN(blue)) {
          settings.kMeansColorRestrictions.push([red, green, blue]);
        }
      }
    }
    return settings;
  }, [
    colorSpace,
    largeToSmall,
    randomSeed,
    nrOfClusters,
    clusterPrecision,
    removeFacetsSmallerThan,
    maximumNumberOfFacets,
    halveBorderSegments,
    narrowPixelCleanupRuns,
    resizeImage,
    resizeWidth,
    resizeHeight,
    colorRestrictions,
  ]);

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
      setRecipes(null);
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

  const computeRecipes = useCallback(async (pal: RGB[]) => {
    if (pal.length === 0) return;
    setMixingBusy(true);
    setMixingProgress(0);
    try {
      const { findRecipes } = await import("@/lib/pbn/paintMixing");
      const result = await findRecipes(pal, undefined, (done, total) =>
        setMixingProgress(done / total),
      );
      setRecipes(result);
    } finally {
      setMixingBusy(false);
    }
  }, []);

  const handleComputeRecipes = () => void computeRecipes(palette);

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
    setLogLines([]);

    // cancel old process & create new
    cancellationTokenRef.current.isCancelled = true;
    cancellationTokenRef.current = new CancellationToken();

    const totalRuns = narrowPixelCleanupRuns === 0 ? 1 : narrowPixelCleanupRuns;
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
      const settings = buildSettings();
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
      void computeRecipes(processResultRef.current.colorsByIndex);
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
    updateOutput,
    narrowPixelCleanupRuns,
    computeRecipes,
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

  const handleDownloadSVG = () => {
    const svg = svgContainerRef.current?.querySelector("svg");
    if (svg) downloadSVG(svg as SVGSVGElement);
  };
  const handleDownloadPNG = () => {
    const svg = svgContainerRef.current?.querySelector("svg");
    if (svg) void downloadPNG(svg as SVGSVGElement);
  };
  const handleDownloadPalette = () => {
    if (processResultRef.current) {
      downloadPalettePng(
        processResultRef.current.colorsByIndex,
        recipes ?? undefined,
      );
    }
  };

  const getSvgAspect = (): number | null => {
    const svg = svgContainerRef.current?.querySelector("svg");
    if (!svg) return null;
    const w = parseInt(svg.getAttribute("width") || "0", 10) || svg.clientWidth;
    const h =
      parseInt(svg.getAttribute("height") || "0", 10) || svg.clientHeight;
    return h > 0 ? w / h : null;
  };

  const onPdfWidthChange = (val: number) => {
    setPdfWidth(val);
    const aspect = getSvgAspect();
    if (aspect && val > 0) setPdfHeight(Math.round((val / aspect) * 10) / 10);
  };

  const onPdfHeightChange = (val: number) => {
    setPdfHeight(val);
    const aspect = getSvgAspect();
    if (aspect && val > 0) setPdfWidth(Math.round(val * aspect * 10) / 10);
  };

  const onPdfUnitChange = (newUnit: "cm" | "in") => {
    const factor = newUnit === "in" ? 1 / 2.54 : 2.54;
    setPdfWidth((w) => Math.round(w * factor * 10) / 10);
    setPdfHeight((h) => Math.round(h * factor * 10) / 10);
    setPdfUnit(newUnit);
  };

  const handleDownloadPDF = () => {
    const svg = svgContainerRef.current?.querySelector("svg");
    if (svg)
      void downloadPDF(
        svg as SVGSVGElement,
        { unit: pdfUnit, width: pdfWidth, height: pdfHeight } as PdfSize,
      );
  };

  const handleDownloadPDFStandard = async () => {
    const svg = svgContainerRef.current?.querySelector("svg");
    if (!svg) return;
    const { dataUrl, width, height } = await svgToPngDataUrl(
      svg as SVGSVGElement,
    );
    setCropModal({ src: dataUrl, w: width, h: height });
  };

  const handleCropConfirm = (crop: CropRect) => {
    if (cropModal) {
      void downloadPDFCropped(
        cropModal.src,
        crop,
        paperFormat,
        paperOrientation,
      );
    }
    setCropModal(null);
  };

  return (
    <div className={styles.container}>
      <h2>Paint by number generator</h2>
      <p>
        Paste from clipboard (ctrl+v) to change the image (or browse for a file{" "}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/x-png,image/gif,image/jpeg"
          onChange={onFileChange}
        />
        ). Large images are very slow to process though.
      </p>
      <p>
        Example images:{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            loadExample("trivial");
          }}
        >
          trivial
        </a>{" "}
        -{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            loadExample("small");
          }}
        >
          small
        </a>{" "}
        -{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            loadExample("medium");
          }}
        >
          medium
        </a>
      </p>

      {/* input / options tabs */}
      <div className={styles.tabs}>
        <button
          className={inputTab === "input" ? styles.tabActive : styles.tab}
          onClick={() => setInputTab("input")}
        >
          Input
        </button>
        <button
          className={inputTab === "options" ? styles.tabActive : styles.tab}
          onClick={() => setInputTab("options")}
        >
          Options
        </button>
      </div>

      <div hidden={inputTab !== "input"} className={styles.pane}>
        <canvas ref={inputCanvasRef} className={styles.canvas} />
      </div>

      <div hidden={inputTab !== "options"} className={styles.pane}>
        <div className={styles.optionRow}>
          <span>Presets</span>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={
                isPresetActive(p.apply)
                  ? styles.presetBtnActive
                  : styles.presetBtn
              }
              onClick={() => applyPreset(p.apply)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className={styles.optionRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={resizeImage}
              onChange={(e) => setResizeImage(e.target.checked)}
            />
            Resize image larger than
          </label>
          <label>
            width
            <input
              type="number"
              min={1}
              value={resizeWidth}
              onChange={(e) => setResizeWidth(parseInt(e.target.value) || 0)}
            />
          </label>
          <label>
            height
            <input
              type="number"
              min={1}
              value={resizeHeight}
              onChange={(e) => setResizeHeight(parseInt(e.target.value) || 0)}
            />
          </label>
        </div>

        <div className={styles.optionRow}>
          <label>
            Number of colors
            <input
              type="number"
              min={1}
              value={nrOfClusters}
              onChange={(e) => setNrOfClusters(parseInt(e.target.value) || 1)}
            />
          </label>
          <label>
            Cluster precision
            <input
              type="number"
              min={1}
              step={0.05}
              value={clusterPrecision}
              onChange={(e) =>
                setClusterPrecision(parseFloat(e.target.value) || 1)
              }
            />
          </label>
          <label>
            Random seed
            <input
              type="number"
              min={0}
              step={1}
              value={randomSeed}
              onChange={(e) => setRandomSeed(parseInt(e.target.value) || 0)}
            />
          </label>
        </div>

        <div className={styles.optionRow}>
          <span>Clustering color space</span>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="colorspace"
              checked={colorSpace === ClusteringColorSpace.RGB}
              onChange={() => setColorSpace(ClusteringColorSpace.RGB)}
            />
            RGB
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="colorspace"
              checked={colorSpace === ClusteringColorSpace.HSL}
              onChange={() => setColorSpace(ClusteringColorSpace.HSL)}
            />
            HSL
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="colorspace"
              checked={colorSpace === ClusteringColorSpace.LAB}
              onChange={() => setColorSpace(ClusteringColorSpace.LAB)}
            />
            Lab
          </label>
        </div>

        <div className={styles.optionColumn}>
          <label>
            Restrict clustering colors (one r,g,b per line, // to comment)
            <textarea
              className={styles.textarea}
              value={colorRestrictions}
              onChange={(e) => setColorRestrictions(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.optionRow}>
          <label>
            Narrow pixel cleanup runs
            <input
              type="number"
              min={0}
              value={narrowPixelCleanupRuns}
              onChange={(e) =>
                setNarrowPixelCleanupRuns(parseInt(e.target.value) || 0)
              }
            />
          </label>
          <label>
            Remove facets smaller than (pixels)
            <input
              type="number"
              min={1}
              value={removeFacetsSmallerThan}
              onChange={(e) =>
                setRemoveFacetsSmallerThan(parseInt(e.target.value) || 1)
              }
            />
          </label>
          <label>
            Maximum number of facets
            <input
              type="number"
              min={1}
              value={maximumNumberOfFacets}
              onChange={(e) =>
                setMaximumNumberOfFacets(parseInt(e.target.value) || 1)
              }
            />
          </label>
        </div>

        <div className={styles.optionRow}>
          <span>Small facet removal order</span>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="facetremovalorder"
              checked={largeToSmall}
              onChange={() => setLargeToSmall(true)}
            />
            Largest to smallest
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="facetremovalorder"
              checked={!largeToSmall}
              onChange={() => setLargeToSmall(false)}
            />
            Smallest to largest
          </label>
        </div>

        <div className={styles.optionRow}>
          <label>
            Times to halve border segment complexity
            <input
              type="number"
              min={0}
              value={halveBorderSegments}
              onChange={(e) =>
                setHalveBorderSegments(parseInt(e.target.value) || 0)
              }
            />
          </label>
        </div>
      </div>

      <button
        className={styles.btn}
        onClick={() => void process()}
        disabled={isProcessing}
      >
        {isProcessing ? "Processing..." : "Process image"}
      </button>
      {isProcessing && (
        <button className={styles.btnCancel} onClick={cancel}>
          Cancel
        </button>
      )}

      {/* progress bar */}
      {overall.state !== "idle" && (
        <div className={styles.progressWrapper}>
          <div className={styles.progressHeader}>
            <span>{overall.label}</span>
            <span>{Math.round(overall.progress * 100)}%</span>
          </div>
          <div className={styles.progress}>
            <div
              className={`${styles.determinate} ${
                overall.state === "complete" ? styles.complete : ""
              }`}
              style={{ width: Math.round(overall.progress * 100) + "%" }}
            />
          </div>
        </div>
      )}

      {/* output tabs */}
      <div className={styles.tabs}>
        {OUTPUT_TABS.map((t) => (
          <button
            key={t.key}
            className={outputTab === t.key ? styles.tabActive : styles.tab}
            onClick={() => setOutputTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <button
          className={outputTab === "log" ? styles.tabActive : styles.tab}
          onClick={() => setOutputTab("log")}
        >
          Log
        </button>
      </div>

      <div hidden={outputTab !== "kmeans-pane"} className={styles.pane}>
        <canvas ref={kmeansCanvasRef} className={styles.canvas} />
      </div>
      <div hidden={outputTab !== "reduction-pane"} className={styles.pane}>
        <canvas ref={reductionCanvasRef} className={styles.canvas} />
      </div>
      <div hidden={outputTab !== "borderpath-pane"} className={styles.pane}>
        <canvas ref={borderPathCanvasRef} className={styles.canvas} />
      </div>
      <div
        hidden={outputTab !== "bordersegmentation-pane"}
        className={styles.pane}
      >
        <canvas ref={borderSegmentationCanvasRef} className={styles.canvas} />
      </div>
      <div hidden={outputTab !== "labelplacement-pane"} className={styles.pane}>
        <canvas ref={labelPlacementCanvasRef} className={styles.canvas} />
      </div>

      {/* output pane */}
      <div hidden={outputTab !== "output-pane"} className={styles.pane}>
        <div className={styles.optionRow}>
          <span>SVG Render options</span>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Show labels
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={fillFacets}
              onChange={(e) => setFillFacets(e.target.checked)}
            />
            Fill facets
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showBorders}
              onChange={(e) => setShowBorders(e.target.checked)}
            />
            Show borders
          </label>
        </div>
        <div className={styles.optionRow}>
          <label>
            SVG size multiplier
            <input
              type="number"
              min={1}
              value={sizeMultiplier}
              onChange={(e) => setSizeMultiplier(parseInt(e.target.value) || 1)}
            />
          </label>
          <label>
            Label font size
            <input
              type="number"
              min={1}
              max={100}
              value={labelFontSize}
              onChange={(e) => setLabelFontSize(parseInt(e.target.value) || 1)}
            />
          </label>
          <label>
            Label font color
            <input
              type="text"
              value={labelFontColor}
              onChange={(e) => setLabelFontColor(e.target.value)}
            />
          </label>
          <label>
            Fill opacity ({Math.round(fillOpacity * 100)}%)
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(fillOpacity * 100)}
              onChange={(e) =>
                setFillOpacity((parseInt(e.target.value) || 0) / 100)
              }
            />
          </label>
        </div>

        <div className={styles.palette}>
          {palette.map((c, i) => (
            <div
              key={i}
              className={styles.color}
              style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
              title={`${c[0]},${c[1]},${c[2]}`}
            >
              {i}
            </div>
          ))}
        </div>
        <div ref={svgContainerRef} className={styles.svgContainer} />

        {recipes &&
          palette.length > 0 &&
          (() => {
            const usedPaints: import("@/lib/pbn/basePaints").BasePaint[] = [];
            const seen = new Set<string>();
            for (const recipe of recipes) {
              for (const e of recipe.entries) {
                if (!seen.has(e.paint.id)) {
                  seen.add(e.paint.id);
                  usedPaints.push(e.paint);
                }
              }
            }
            return (
              <div className={styles.guideCard}>
                <div className={styles.guideHead}>
                  <div className={styles.guideHeader}>
                    <div>
                      <h3 className={styles.guideTitle}>
                        Guía de mezclas de colores
                      </h3>
                      <p className={styles.guideSubtitle}>
                        {recipes.length} colores y sus fórmulas para crearlos
                      </p>
                    </div>
                  </div>
                  <div className={styles.basePaintsGrid}>
                    {(usedPaints.length > 0
                      ? usedPaints
                      : DEFAULT_BASE_PAINTS
                    ).map((p) => (
                      <div key={p.id} className={styles.basePaintItem}>
                        <span
                          className={styles.basePaintSwatch}
                          style={{
                            backgroundColor: `rgb(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]})`,
                          }}
                          title={`${p.nameEn} — nº ${p.codigo} (${p.pigmento}) — ${p.rgb[0]},${p.rgb[1]},${p.rgb[2]}`}
                        />
                        <span className={styles.basePaintName}>
                          {p.nameEs}
                          <span className={styles.basePaintCode}>
                            nº {p.codigo}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.guideTableWrap}>
                  <table className={styles.guideTable}>
                    <thead>
                      <tr>
                        <th className={styles.guideColNum}>#</th>
                        <th className={styles.guideColPreview}>Vista previa</th>
                        <th>
                          Fórmula de mezcla
                          <span className={styles.guideColHint}>
                            (suma de partes)
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipes.map((recipe, i) => {
                        const m = recipe.mixedRgb;
                        return (
                          <tr key={i}>
                            <td className={styles.guideNum}>{i + 1}</td>
                            <td>
                              <div className={styles.guidePreviewWrapper}>
                                <span
                                  className={styles.guidePreview}
                                  style={{
                                    backgroundColor: `rgb(${m[0]},${m[1]},${m[2]})`,
                                  }}
                                  title={`Mezcla: ${m[0]},${m[1]},${m[2]}`}
                                />
                                <span className={styles.guideEquals}>=</span>
                              </div>
                            </td>
                            <td>
                              <div className={styles.guideFormula}>
                                {recipe.entries.map((e, j) => (
                                  <Fragment key={j}>
                                    {j > 0 && (
                                      <span className={styles.guidePlus}>
                                        +
                                      </span>
                                    )}
                                    <span className={styles.guideComp}>
                                      <span
                                        className={styles.guideDot}
                                        style={{
                                          backgroundColor: `rgb(${e.paint.rgb[0]},${e.paint.rgb[1]},${e.paint.rgb[2]})`,
                                        }}
                                      />
                                      <div className={styles.guideCompInfo}>
                                        <span className={styles.guidePct}>
                                          {e.parts}{" "}
                                          {e.parts === 1 ? "parte" : "partes"}
                                        </span>
                                        <span className={styles.guideCompName}>
                                          {e.paint.nameEs}
                                        </span>
                                      </div>
                                    </span>
                                  </Fragment>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

        {hasOutput && (
          <>
            <div className={styles.optionRow}>
              <button className={styles.btn} onClick={handleDownloadSVG}>
                Download SVG
              </button>
              <button className={styles.btn} onClick={handleDownloadPNG}>
                Download PNG
              </button>
              <button className={styles.btn} onClick={handleDownloadPalette}>
                Download palette
              </button>
            </div>
            <div className={styles.optionRow}>
              <label>
                Unit
                <select
                  value={pdfUnit}
                  onChange={(e) =>
                    onPdfUnitChange(e.target.value as "cm" | "in")
                  }
                >
                  <option value="cm">cm</option>
                  <option value="in">inches</option>
                </select>
              </label>
              <label>
                Width ({pdfUnit})
                <input
                  type="number"
                  min={1}
                  step={0.1}
                  value={pdfWidth}
                  onChange={(e) =>
                    onPdfWidthChange(parseFloat(e.target.value) || 0)
                  }
                />
              </label>
              <label>
                Height ({pdfUnit})
                <input
                  type="number"
                  min={1}
                  step={0.1}
                  value={pdfHeight}
                  onChange={(e) =>
                    onPdfHeightChange(parseFloat(e.target.value) || 0)
                  }
                />
              </label>
              <button className={styles.btn} onClick={handleDownloadPDF}>
                Download PDF
              </button>
            </div>
            <div className={styles.optionRow}>
              <label>
                Paper size
                <select
                  value={paperFormat}
                  onChange={(e) =>
                    setPaperFormat(e.target.value as PaperFormat)
                  }
                >
                  <option value="a3">A3</option>
                  <option value="a4">A4</option>
                  <option value="a5">A5</option>
                  <option value="letter">Letter</option>
                  <option value="legal">Legal</option>
                  <option value="tabloid">Tabloid</option>
                </select>
              </label>
              <label>
                Orientation
                <select
                  value={paperOrientation}
                  onChange={(e) =>
                    setPaperOrientation(e.target.value as PaperOrientation)
                  }
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <button
                className={styles.btn}
                onClick={() => void handleDownloadPDFStandard()}
              >
                Select area &amp; download PDF
              </button>
            </div>
          </>
        )}
      </div>

      <div hidden={outputTab !== "log"} className={styles.pane}>
        <div className={styles.log}>
          {logLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      {cropModal && (
        <CropModal
          imageSrc={cropModal.src}
          imageWidth={cropModal.w}
          imageHeight={cropModal.h}
          aspect={getPaperAspect(paperFormat, paperOrientation)}
          title={`${PAPER_LABELS[paperFormat]} ${paperOrientation}`}
          onCancel={() => setCropModal(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
