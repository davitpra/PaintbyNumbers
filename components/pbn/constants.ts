import { ProcessPhase } from "@/lib/pbn/guiprocessmanager";
import { PaperFormat } from "@/lib/pbn/svgExport";

export const PAPER_LABELS: Record<PaperFormat, string> = {
  a3: "A3",
  a4: "A4",
  a5: "A5",
  letter: "Letter",
  legal: "Legal",
  tabloid: "Tabloid",
};

export const EXAMPLE_IMAGE = "/example.png";

export const PHASE_WEIGHTS: Record<ProcessPhase | "svg", number> = {
  kMeans: 0.25,
  facetBuilding: 0.1,
  facetReduction: 0.3,
  facetBorderPath: 0.15,
  facetBorderSegmentation: 0.07,
  facetLabelPlacement: 0.08,
  svg: 0.05,
};

export const PHASE_LABELS: Record<ProcessPhase | "svg", string> = {
  kMeans: "K-means clustering",
  facetBuilding: "Facet building",
  facetReduction: "Small facet pruning",
  facetBorderPath: "Border detection",
  facetBorderSegmentation: "Border segmentation",
  facetLabelPlacement: "Label placement",
  svg: "SVG generation",
};

export type OverallStatus = {
  progress: number;
  label: string;
  state: "idle" | "active" | "complete";
};

export interface PresetValues {
  resizeWidth: number;
  resizeHeight: number;
  nrOfClusters: number;
  removeFacetsSmallerThan: number;
  narrowPixelCleanupRuns: number;
  halveBorderSegments: number;
}

export const PRESETS: { key: string; label: string; apply: PresetValues }[] = [
  {
    key: "photo",
    label: "Fast",
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
    label: "Balanced",
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
    label: "Slow (Detailed)",
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
