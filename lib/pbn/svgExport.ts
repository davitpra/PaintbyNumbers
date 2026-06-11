/**
 * Helpers to export the generated SVG to a downloadable SVG, PNG, or PDF file.
 * Replaces the external `saveSvgAsPng.js` script used by the original project.
 */

import { jsPDF } from "jspdf";

function triggerDownload(href: string, filename: string) {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function svgToPngDataUrl(svgEl: SVGSVGElement): Promise<{ dataUrl: string; width: number; height: number }> {
    const width = parseInt(svgEl.getAttribute("width") || "0", 10) || svgEl.clientWidth;
    const height = parseInt(svgEl.getAttribute("height") || "0", 10) || svgEl.clientHeight;

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve({ dataUrl: canvas.toDataURL("image/png"), width, height });
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
}

export function downloadSVG(svgEl: SVGSVGElement, filename: string = "paintbynumbers.svg") {
    svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgData = svgEl.outerHTML;
    const preface = '<?xml version="1.0" standalone="no"?>\r\n';
    const svgBlob = new Blob([preface, svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    triggerDownload(svgUrl, filename);
    URL.revokeObjectURL(svgUrl);
}

export async function downloadPNG(svgEl: SVGSVGElement, filename: string = "paintbynumbers.png") {
    const { dataUrl } = await svgToPngDataUrl(svgEl);
    triggerDownload(dataUrl, filename);
}

export interface PdfSize {
    unit: "cm" | "in";
    width: number;
    height: number;
}

export async function downloadPDF(
    svgEl: SVGSVGElement,
    size: PdfSize,
    filename: string = "paintbynumbers.pdf",
): Promise<void> {
    const { dataUrl } = await svgToPngDataUrl(svgEl);
    const orientation = size.width >= size.height ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation, unit: size.unit, format: [size.width, size.height] });
    doc.addImage(dataUrl, "PNG", 0, 0, size.width, size.height);
    doc.save(filename);
}

export type PaperFormat = "a3" | "a4" | "a5" | "letter" | "legal" | "tabloid";
export type PaperOrientation = "portrait" | "landscape";

/** Paper sizes in millimetres (portrait: width x height). */
const PAPER_DIMS: Record<PaperFormat, [number, number]> = {
    a3: [297, 420],
    a4: [210, 297],
    a5: [148, 210],
    letter: [215.9, 279.4],
    legal: [215.9, 355.6],
    tabloid: [279.4, 431.8],
};

/** Aspect ratio (width / height) of the chosen paper, accounting for orientation. */
export function getPaperAspect(format: PaperFormat, orientation: PaperOrientation): number {
    const [w, h] = PAPER_DIMS[format];
    const [pw, ph] = orientation === "landscape" ? [h, w] : [w, h];
    return pw / ph;
}

export interface CropRect {
    /** Coordinates and size in source-image pixels. */
    x: number;
    y: number;
    w: number;
    h: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Renders the selected crop of an already-rasterized PBN (PNG data URL) onto a
 * standard-sized page, filling it completely. The crop aspect ratio is expected
 * to match the page aspect ratio (see getPaperAspect), so the image is not
 * distorted nor letterboxed.
 */
export async function downloadPDFCropped(
    pngDataUrl: string,
    crop: CropRect,
    format: PaperFormat,
    orientation: PaperOrientation,
    filename: string = "paintbynumbers.pdf",
): Promise<void> {
    const img = await loadImage(pngDataUrl);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.w));
    canvas.height = Math.max(1, Math.round(crop.h));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    const croppedUrl = canvas.toDataURL("image/png");

    const doc = new jsPDF({ orientation, unit: "mm", format });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.addImage(croppedUrl, "PNG", 0, 0, pageW, pageH);
    doc.save(filename);
}
