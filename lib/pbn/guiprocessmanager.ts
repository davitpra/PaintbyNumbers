/**
 * Module that runs the full paint-by-numbers processing pipeline.
 *
 * Refactored from the original jQuery/Materialize based version: instead of
 * reaching into the DOM directly it receives the canvases it should draw the
 * intermediate steps onto and a set of callbacks to report progress, switch
 * the active output tab and log timing information.
 */

import { ColorMapResult, ColorReducer } from "./colorreductionmanagement";
import { CancellationToken, createYielder, RGB, yieldToMain } from "./common";
import { FacetBorderSegmenter } from "./facetBorderSegmenter";
import { FacetBorderTracer } from "./facetBorderTracer";
import { FacetCreator } from "./facetCreator";
import { FacetLabelPlacer } from "./facetLabelPlacer";
import { FacetResult } from "./facetmanagement";
import { FacetReducer } from "./facetReducer";
import { Settings } from "./settings";
import { Point } from "./structs/point";

export class ProcessResult {
    public facetResult!: FacetResult;
    public colorsByIndex!: RGB[];
}

/** The intermediate-step canvases the pipeline draws onto. */
export interface ProcessCanvases {
    input: HTMLCanvasElement;
    kmeans: HTMLCanvasElement;
    reduction: HTMLCanvasElement;
    borderPath: HTMLCanvasElement;
    borderSegmentation: HTMLCanvasElement;
    labelPlacement: HTMLCanvasElement;
}

export type ProcessPhase =
    | "kMeans"
    | "facetBuilding"
    | "facetReduction"
    | "facetBorderPath"
    | "facetBorderSegmentation"
    | "facetLabelPlacement";

/** Tab keys, matching the output panes in the UI. */
export type OutputTab =
    | "kmeans-pane"
    | "reduction-pane"
    | "borderpath-pane"
    | "bordersegmentation-pane"
    | "labelplacement-pane"
    | "output-pane";

export interface ProcessCallbacks {
    /** Reports the progress (0..1) and the activity state of a phase. */
    onStatus?: (phase: ProcessPhase, progress: number, state: "active" | "complete") => void;
    /** Asks the UI to switch the visible output tab. */
    onSelectTab?: (tab: OutputTab) => void;
    /** Logs a (timing) message. */
    log?: (msg: string) => void;
}

/**
 *  Manages the processing of the image step by step.
 */
export class GUIProcessManager {

    public static async process(
        settings: Settings,
        cancellationToken: CancellationToken,
        canvases: ProcessCanvases,
        callbacks: ProcessCallbacks = {},
    ): Promise<ProcessResult> {

        const timers: { [name: string]: number } = {};
        const time = (name: string) => {
            timers[name] = Date.now();
        };
        const timeEnd = (name: string) => {
            const ms = Date.now() - timers[name];
            if (callbacks.log) { callbacks.log(name + ": " + ms + "ms"); }
            delete timers[name];
        };
        const status = (phase: ProcessPhase, progress: number, state: "active" | "complete") => {
            if (callbacks.onStatus) { callbacks.onStatus(phase, progress, state); }
        };
        const selectTab = (tab: OutputTab) => {
            if (callbacks.onSelectTab) { callbacks.onSelectTab(tab); }
        };

        const c = canvases.input;
        const ctx = c.getContext("2d")!;
        let imgData = ctx.getImageData(0, 0, c.width, c.height);

        if (settings.resizeImageIfTooLarge && (c.width > settings.resizeImageWidth || c.height > settings.resizeImageHeight)) {
            let width = c.width;
            let height = c.height;
            if (width > settings.resizeImageWidth) {
                const newWidth = settings.resizeImageWidth;
                const newHeight = c.height / c.width * settings.resizeImageWidth;
                width = newWidth;
                height = newHeight;
            }
            if (height > settings.resizeImageHeight) {
                const newHeight = settings.resizeImageHeight;
                const newWidth = width / height * newHeight;
                width = newWidth;
                height = newHeight;
            }

            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = width;
            tempCanvas.height = height;
            tempCanvas.getContext("2d")!.drawImage(c, 0, 0, width, height);
            c.width = width;
            c.height = height;
            ctx.drawImage(tempCanvas, 0, 0, width, height);
            imgData = ctx.getImageData(0, 0, c.width, c.height);
        }

        // Phases that finish in under the 150ms internal yield window never hand
        // control back to the browser on their own, so a fast image would run the
        // whole post-kmeans pipeline as one synchronous block and the progress bar
        // would appear frozen. Yield at every phase boundary so each completed
        // phase gets painted.

        // k-means clustering
        const kmeansImgData = await GUIProcessManager.processKmeansClustering(imgData, canvases.kmeans, ctx, settings, cancellationToken, time, timeEnd, status, selectTab);
        await yieldToMain();

        let facetResult: FacetResult = new FacetResult();
        let colormapResult: ColorMapResult = new ColorMapResult();

        // build color map
        colormapResult = ColorReducer.createColorMap(kmeansImgData);

        if (settings.narrowPixelStripCleanupRuns === 0) {
            // facet building
            facetResult = await GUIProcessManager.processFacetBuilding(colormapResult, cancellationToken, time, timeEnd, status);
            await yieldToMain();

            // facet reduction
            await GUIProcessManager.processFacetReduction(facetResult, canvases.reduction, settings, colormapResult, cancellationToken, time, timeEnd, status, selectTab);
            await yieldToMain();
        } else {
            for (let run = 0; run < settings.narrowPixelStripCleanupRuns; run++) {

                // clean up narrow pixel strips
                await ColorReducer.processNarrowPixelStripCleanup(colormapResult);

                // facet building
                facetResult = await GUIProcessManager.processFacetBuilding(colormapResult, cancellationToken, time, timeEnd, status);
                await yieldToMain();

                // facet reduction
                await GUIProcessManager.processFacetReduction(facetResult, canvases.reduction, settings, colormapResult, cancellationToken, time, timeEnd, status, selectTab);
                await yieldToMain();

                // the colormapResult.imgColorIndices get updated as the facets are reduced, so just do a few runs of pixel cleanup
            }
        }

        // facet border tracing
        await GUIProcessManager.processFacetBorderTracing(canvases.borderPath, facetResult, cancellationToken, time, timeEnd, status, selectTab);
        await yieldToMain();

        // facet border segmentation
        const cBorderSegment = await GUIProcessManager.processFacetBorderSegmentation(facetResult, canvases.borderSegmentation, settings, cancellationToken, time, timeEnd, status, selectTab);
        await yieldToMain();

        // facet label placement
        await GUIProcessManager.processFacetLabelPlacement(facetResult, cBorderSegment, canvases.labelPlacement, cancellationToken, time, timeEnd, status, selectTab);
        await yieldToMain();

        // everything is now ready to generate the SVG, return the result
        const processResult = new ProcessResult();
        processResult.facetResult = facetResult;
        processResult.colorsByIndex = colormapResult.colorsByIndex;
        return processResult;
    }

    private static async processKmeansClustering(
        imgData: ImageData, cKmeans: HTMLCanvasElement, ctx: CanvasRenderingContext2D,
        settings: Settings, cancellationToken: CancellationToken,
        time: (name: string) => void, timeEnd: (name: string) => void,
        status: (phase: ProcessPhase, progress: number, state: "active" | "complete") => void,
        selectTab: (tab: OutputTab) => void,
    ) {
        time("K-means clustering");

        cKmeans.width = imgData.width;
        cKmeans.height = imgData.height;

        const ctxKmeans = cKmeans.getContext("2d")!;
        ctxKmeans.fillStyle = "white";
        ctxKmeans.fillRect(0, 0, cKmeans.width, cKmeans.height);

        const kmeansImgData = ctxKmeans.getImageData(0, 0, cKmeans.width, cKmeans.height);

        selectTab("kmeans-pane");
        status("kMeans", 0, "active");

        await ColorReducer.applyKMeansClustering(imgData, kmeansImgData, ctx, settings, (kmeans) => {
            const progress = (100 - (kmeans.currentDeltaDistanceDifference > 100 ? 100 : kmeans.currentDeltaDistanceDifference)) / 100;
            status("kMeans", progress, "active");
            ctxKmeans.putImageData(kmeansImgData, 0, 0);
            if (cancellationToken.isCancelled) {
                throw new Error("Cancelled");
            }
        });

        status("kMeans", 1, "complete");
        timeEnd("K-means clustering");
        return kmeansImgData;
    }

    private static async processFacetBuilding(
        colormapResult: ColorMapResult, cancellationToken: CancellationToken,
        time: (name: string) => void, timeEnd: (name: string) => void,
        status: (phase: ProcessPhase, progress: number, state: "active" | "complete") => void,
    ) {
        time("Facet building");
        status("facetBuilding", 0, "active");
        const facetResult = await FacetCreator.getFacets(colormapResult.width, colormapResult.height, colormapResult.imgColorIndices, (progress) => {
            if (cancellationToken.isCancelled) {
                throw new Error("Cancelled");
            }
            status("facetBuilding", progress, "active");
        });
        status("facetBuilding", 1, "complete");
        timeEnd("Facet building");
        return facetResult;
    }

    private static async processFacetReduction(
        facetResult: FacetResult, cReduction: HTMLCanvasElement, settings: Settings, colormapResult: ColorMapResult, cancellationToken: CancellationToken,
        time: (name: string) => void, timeEnd: (name: string) => void,
        status: (phase: ProcessPhase, progress: number, state: "active" | "complete") => void,
        selectTab: (tab: OutputTab) => void,
    ) {
        time("Facet reduction");
        cReduction.width = facetResult.width;
        cReduction.height = facetResult.height;
        const ctxReduction = cReduction.getContext("2d")!;
        ctxReduction.fillStyle = "white";
        ctxReduction.fillRect(0, 0, cReduction.width, cReduction.height);
        const reductionImgData = ctxReduction.getImageData(0, 0, cReduction.width, cReduction.height);
        selectTab("reduction-pane");
        status("facetReduction", 0, "active");
        await FacetReducer.reduceFacets(settings.removeFacetsSmallerThanNrOfPoints, settings.removeFacetsFromLargeToSmall, settings.maximumNumberOfFacets, colormapResult.colorsByIndex, facetResult, colormapResult.imgColorIndices, (progress) => {
            if (cancellationToken.isCancelled) {
                throw new Error("Cancelled");
            }
            // update status & image
            status("facetReduction", progress, "active");
            let idx = 0;
            for (let j: number = 0; j < facetResult.height; j++) {
                for (let i: number = 0; i < facetResult.width; i++) {
                    const facet = facetResult.facets[facetResult.facetMap.get(i, j)];
                    const rgb = colormapResult.colorsByIndex[facet!.color];
                    reductionImgData.data[idx++] = rgb[0];
                    reductionImgData.data[idx++] = rgb[1];
                    reductionImgData.data[idx++] = rgb[2];
                    idx++;
                }
            }
            ctxReduction.putImageData(reductionImgData, 0, 0);
        });
        status("facetReduction", 1, "complete");
        timeEnd("Facet reduction");
    }

    private static async processFacetBorderTracing(
        cBorderPath: HTMLCanvasElement, facetResult: FacetResult, cancellationToken: CancellationToken,
        time: (name: string) => void, timeEnd: (name: string) => void,
        status: (phase: ProcessPhase, progress: number, state: "active" | "complete") => void,
        selectTab: (tab: OutputTab) => void,
    ) {
        time("Facet border tracing");
        selectTab("borderpath-pane");
        cBorderPath.width = facetResult.width;
        cBorderPath.height = facetResult.height;
        const ctxBorderPath = cBorderPath.getContext("2d")!;
        status("facetBorderPath", 0, "active");
        await FacetBorderTracer.buildFacetBorderPaths(facetResult, (progress) => {
            if (cancellationToken.isCancelled) {
                throw new Error("Cancelled");
            }
            // update status & image
            status("facetBorderPath", progress, "active");
            ctxBorderPath.fillStyle = "white";
            ctxBorderPath.fillRect(0, 0, cBorderPath.width, cBorderPath.height);
            for (const f of facetResult.facets) {
                if (f != null && f.borderPath != null) {
                    ctxBorderPath.beginPath();
                    ctxBorderPath.moveTo(f.borderPath[0].getWallX(), f.borderPath[0].getWallY());
                    for (let i: number = 1; i < f.borderPath.length; i++) {
                        ctxBorderPath.lineTo(f.borderPath[i].getWallX(), f.borderPath[i].getWallY());
                    }
                    ctxBorderPath.stroke();
                }
            }
        });
        status("facetBorderPath", 1, "complete");
        timeEnd("Facet border tracing");
    }

    private static async processFacetBorderSegmentation(
        facetResult: FacetResult, cBorderSegment: HTMLCanvasElement, settings: Settings, cancellationToken: CancellationToken,
        time: (name: string) => void, timeEnd: (name: string) => void,
        status: (phase: ProcessPhase, progress: number, state: "active" | "complete") => void,
        selectTab: (tab: OutputTab) => void,
    ) {
        time("Facet border segmentation");
        cBorderSegment.width = facetResult.width;
        cBorderSegment.height = facetResult.height;
        const ctxBorderSegment = cBorderSegment.getContext("2d")!;
        selectTab("bordersegmentation-pane");
        status("facetBorderSegmentation", 0, "active");

        await FacetBorderSegmenter.buildFacetBorderSegments(facetResult, settings.nrOfTimesToHalveBorderSegments, (progress) => {
            if (cancellationToken.isCancelled) {
                throw new Error("Cancelled");
            }

            // update status & image
            status("facetBorderSegmentation", progress, "active");
            ctxBorderSegment.fillStyle = "white";
            ctxBorderSegment.fillRect(0, 0, cBorderSegment.width, cBorderSegment.height);
            for (const f of facetResult.facets) {
                if (f != null && progress > f.id / facetResult.facets.length) {
                    ctxBorderSegment.beginPath();
                    const path = f.getFullPathFromBorderSegments(false);
                    ctxBorderSegment.moveTo(path[0].x, path[0].y);
                    for (let i: number = 1; i < path.length; i++) {
                        ctxBorderSegment.lineTo(path[i].x, path[i].y);
                    }
                    ctxBorderSegment.stroke();
                }
            }
        });
        status("facetBorderSegmentation", 1, "complete");
        timeEnd("Facet border segmentation");
        return cBorderSegment;
    }

    private static async processFacetLabelPlacement(
        facetResult: FacetResult, cBorderSegment: HTMLCanvasElement, cLabelPlacement: HTMLCanvasElement, cancellationToken: CancellationToken,
        time: (name: string) => void, timeEnd: (name: string) => void,
        status: (phase: ProcessPhase, progress: number, state: "active" | "complete") => void,
        selectTab: (tab: OutputTab) => void,
    ) {
        time("Facet label placement");
        cLabelPlacement.width = facetResult.width;
        cLabelPlacement.height = facetResult.height;
        const ctxLabelPlacement = cLabelPlacement.getContext("2d")!;
        ctxLabelPlacement.fillStyle = "white";
        ctxLabelPlacement.fillRect(0, 0, cBorderSegment.width, cBorderSegment.height);
        ctxLabelPlacement.drawImage(cBorderSegment, 0, 0);
        selectTab("labelplacement-pane");
        status("facetLabelPlacement", 0, "active");
        await FacetLabelPlacer.buildFacetLabelBounds(facetResult, (progress) => {
            if (cancellationToken.isCancelled) {
                throw new Error("Cancelled");
            }

            // update status & image
            status("facetLabelPlacement", progress, "active");
            for (const f of facetResult.facets) {
                if (f != null && f.labelBounds != null) {
                    ctxLabelPlacement.fillStyle = "red";
                    ctxLabelPlacement.fillRect(f.labelBounds.minX, f.labelBounds.minY, f.labelBounds.width, f.labelBounds.height);
                }
            }
        });
        status("facetLabelPlacement", 1, "complete");
        timeEnd("Facet label placement");
    }

    /**
     *  Creates a vector based SVG image of the facets with the given configuration
     */
    public static async createSVG(facetResult: FacetResult, colorsByIndex: RGB[], sizeMultiplier: number, fill: boolean, stroke: boolean, addColorLabels: boolean, fontSize: number = 50, fontColor: string = "black", fillOpacity: number = 1, onUpdate: ((progress: number) => void) | null = null) {
        const xmlns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(xmlns, "svg");
        const svgWidth = sizeMultiplier * facetResult.width;
        const svgHeight = sizeMultiplier * facetResult.height;
        svg.setAttribute("width", svgWidth + "");
        svg.setAttribute("height", svgHeight + "");
        // Without a viewBox the content is not scaled when CSS resizes the SVG box,
        // so it renders at full coordinate size anchored at the top-left corner.
        svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

        // All facet fills go inside this group. Applying opacity to the group
        // (instead of fill-opacity per facet) flattens the facets first and then
        // composites the result once, so overlapping/nested facets don't stack
        // translucent layers and equal colors render identically. Labels are
        // appended to the svg directly (after this group) so they stay fully
        // opaque and on top.
        const fillGroup = document.createElementNS(xmlns, "g");
        fillGroup.style.opacity = fillOpacity + "";
        svg.appendChild(fillGroup);

        // strokeGroup has no opacity — borders stay fully opaque regardless of fillOpacity.
        // Appended after fillGroup so borders render on top of fills.
        const strokeGroup = document.createElementNS(xmlns, "g");
        svg.appendChild(strokeGroup);

        const yielder = createYielder(150);
        let count = 0;
        for (const f of facetResult.facets) {

            if (f != null && f.borderSegments.length > 0) {
                let newpath: Point[] = [];
                const useSegments = true;
                if (useSegments) {
                    newpath = f.getFullPathFromBorderSegments(false);
                } else {
                    for (let i: number = 0; i < f.borderPath.length; i++) {
                        newpath.push(new Point(f.borderPath[i].getWallX() + 0.5, f.borderPath[i].getWallY() + 0.5));
                    }
                }
                if (newpath[0].x !== newpath[newpath.length - 1].x || newpath[0].y !== newpath[newpath.length - 1].y) {
                    newpath.push(newpath[0]);
                } // close loop if necessary

                // Build path data (shared by fill and stroke paths)
                let data = "M ";
                data += newpath[0].x * sizeMultiplier + " " + newpath[0].y * sizeMultiplier + " ";
                for (let i: number = 1; i < newpath.length; i++) {
                    const midpointX = (newpath[i].x + newpath[i - 1].x) / 2;
                    const midpointY = (newpath[i].y + newpath[i - 1].y) / 2;
                    data += "Q " + (midpointX * sizeMultiplier) + " " + (midpointY * sizeMultiplier) + " " + (newpath[i].x * sizeMultiplier) + " " + (newpath[i].y * sizeMultiplier) + " ";
                }
                data += "Z";

                // Fill path — color fill only, no stroke. Goes in fillGroup which has opacity applied.
                const fillPath = document.createElementNS(xmlns, "path");
                fillPath.setAttribute("data-facetId", f.id + "");
                fillPath.setAttribute("d", data);
                fillPath.style.stroke = "none";
                if (fill) {
                    fillPath.style.fill = `rgb(${colorsByIndex[f.color][0]},${colorsByIndex[f.color][1]},${colorsByIndex[f.color][2]})`;
                } else {
                    fillPath.style.fill = "none";
                }
                fillGroup.appendChild(fillPath);

                // Stroke path — border only, no fill. Goes in strokeGroup (no opacity) so borders stay fully opaque.
                if (stroke || fill) {
                    const strokePath = document.createElementNS(xmlns, "path");
                    strokePath.setAttribute("data-facetId", f.id + "");
                    strokePath.setAttribute("d", data);
                    strokePath.style.fill = "none";
                    strokePath.style.strokeWidth = "1px";
                    if (stroke) {
                        strokePath.style.stroke = "#000";
                    } else {
                        // Close pixel-gaps between adjacent facets using the facet's own color
                        strokePath.style.stroke = `rgb(${colorsByIndex[f.color][0]},${colorsByIndex[f.color][1]},${colorsByIndex[f.color][2]})`;
                    }
                    strokeGroup.appendChild(strokePath);
                }

                // add the color labels if necessary. I mean, this is the whole idea behind the paint by numbers part
                // so I don't know why you would hide them
                if (addColorLabels) {
                    const txt = document.createElementNS(xmlns, "text");
                    txt.setAttribute("font-family", "Tahoma");
                    const nrOfDigits = (f.color + 1 + "").length;
                    // Glyph size is fixed within the 100x100 viewBox (only compensating for
                    // multi-digit width). The final physical size is dictated solely by the
                    // capped box below, so all numbers render at a uniform size.
                    txt.setAttribute("font-size", (90 / nrOfDigits) + "");
                    txt.setAttribute("dominant-baseline", "middle");
                    txt.setAttribute("text-anchor", "middle");
                    txt.setAttribute("fill", fontColor);

                    txt.textContent = f.color + 1 + "";

                    // Cap the label box to a uniform target size (fontSize). Facets with enough
                    // room render at the uniform size; smaller facets shrink so the number fits.
                    const boxW = Math.min(f.labelBounds.width, fontSize);
                    const boxH = Math.min(f.labelBounds.height, fontSize);
                    const centerX = f.labelBounds.minX + f.labelBounds.width / 2;
                    const centerY = f.labelBounds.minY + f.labelBounds.height / 2;

                    const subsvg = document.createElementNS(xmlns, "svg");
                    subsvg.setAttribute("width", boxW * sizeMultiplier + "");
                    subsvg.setAttribute("height", boxH * sizeMultiplier + "");
                    subsvg.setAttribute("overflow", "visible");
                    subsvg.setAttribute("viewBox", "-50 -50 100 100");
                    subsvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

                    subsvg.appendChild(txt);

                    const g = document.createElementNS(xmlns, "g");
                    g.setAttribute("class", "label");
                    // Re-center the capped box within the facet's available room.
                    g.setAttribute("transform", "translate(" + (centerX - boxW / 2) * sizeMultiplier + "," + (centerY - boxH / 2) * sizeMultiplier + ")");
                    g.appendChild(subsvg);
                    svg.appendChild(g);
                }

                if (await yielder()) {
                    if (onUpdate != null) {
                        onUpdate(f.id / facetResult.facets.length);
                    }
                }
            }

            count++;
        }

        if (onUpdate != null) {
            onUpdate(1);
        }

        return svg;
    }
}
