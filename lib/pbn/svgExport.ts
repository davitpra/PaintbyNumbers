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

function svgToPngDataUrl(svgEl: SVGSVGElement): Promise<{ dataUrl: string; width: number; height: number }> {
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

export async function downloadPDFStandard(
    svgEl: SVGSVGElement,
    format: PaperFormat,
    orientation: PaperOrientation,
    filename: string = "paintbynumbers.pdf",
): Promise<void> {
    const { dataUrl, width: imgW, height: imgH } = await svgToPngDataUrl(svgEl);
    const doc = new jsPDF({ orientation, unit: "mm", format });

    // Fit the PBN into the page (with a small margin) keeping the aspect ratio,
    // then center it on the page.
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10; // mm
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const scale = Math.min(availW / imgW, availH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    doc.addImage(dataUrl, "PNG", x, y, drawW, drawH);
    doc.save(filename);
}
