import { useState } from "react";
import { RGB } from "@/lib/pbn/common";
import { ProcessResult } from "@/lib/pbn/guiprocessmanager";
import {
  CropRect,
  downloadPDF,
  downloadPDFCropped,
  downloadPNG,
  downloadSVG,
  PaperFormat,
  PaperOrientation,
  PdfSize,
  svgToPngDataUrl,
} from "@/lib/pbn/svgExport";
import { downloadGuidePng, downloadPalettePng } from "@/lib/pbn/paletteExport";
import type { MixRecipe } from "@/lib/pbn/paintMixing";

interface UseExportArgs {
  svgContainerRef: React.RefObject<HTMLDivElement | null>;
  guideRef: React.RefObject<HTMLDivElement | null>;
  processResultRef: React.RefObject<ProcessResult | null>;
  recipes: MixRecipe[] | null;
  palette: RGB[];
}

/** PDF/paper options and every download action (SVG / PNG / palette / PDF). */
export function useExport({
  svgContainerRef,
  guideRef,
  processResultRef,
  recipes,
  palette,
}: UseExportArgs) {
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

  const getSvg = () =>
    svgContainerRef.current?.querySelector("svg") as SVGSVGElement | null;

  const handleDownloadSVG = () => {
    const svg = getSvg();
    if (svg) downloadSVG(svg);
  };
  const handleDownloadPNG = () => {
    const svg = getSvg();
    if (svg) void downloadPNG(svg);
  };
  const handleDownloadPalette = () => {
    // Prefer capturing the on-screen mixing guide so the download matches it
    // exactly; fall back to the canvas-rendered palette if it isn't available.
    if (guideRef.current && recipes && palette.length > 0) {
      void downloadGuidePng(guideRef.current);
    } else if (processResultRef.current) {
      downloadPalettePng(
        processResultRef.current.colorsByIndex,
        recipes ?? undefined,
      );
    }
  };

  const getSvgAspect = (): number | null => {
    const svg = getSvg();
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
    const svg = getSvg();
    if (svg)
      void downloadPDF(svg, {
        unit: pdfUnit,
        width: pdfWidth,
        height: pdfHeight,
      } as PdfSize);
  };

  const handleDownloadPDFStandard = async () => {
    const svg = getSvg();
    if (!svg) return;
    const { dataUrl, width, height } = await svgToPngDataUrl(svg);
    setCropModal({ src: dataUrl, w: width, h: height });
  };

  const handleCropConfirm = (crop: CropRect) => {
    if (cropModal) {
      // Append the on-screen mixing guide as extra page(s) when available.
      const guideNode =
        recipes && palette.length > 0
          ? (guideRef.current ?? undefined)
          : undefined;
      void downloadPDFCropped(
        cropModal.src,
        crop,
        paperFormat,
        paperOrientation,
        "paintbynumbers.pdf",
        guideNode,
      );
    }
    setCropModal(null);
  };

  return {
    // state
    pdfUnit,
    pdfWidth,
    pdfHeight,
    paperFormat,
    paperOrientation,
    cropModal,
    setPaperFormat,
    setPaperOrientation,
    setCropModal,
    // handlers
    handleDownloadSVG,
    handleDownloadPNG,
    handleDownloadPalette,
    onPdfWidthChange,
    onPdfHeightChange,
    onPdfUnitChange,
    handleDownloadPDF,
    handleDownloadPDFStandard,
    handleCropConfirm,
  };
}

export type ExportControls = ReturnType<typeof useExport>;
