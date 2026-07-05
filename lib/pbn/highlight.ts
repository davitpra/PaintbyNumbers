import { RGB } from "./common";
import { FacetResult } from "./facetmanagement";
import { buildFacetLabel, buildFacetPathData } from "./guiprocessmanager";

const XMLNS = "http://www.w3.org/2000/svg";

export interface HighlightOverlayOptions {
  showBorders: boolean;
  showLabels: boolean;
  fontSize: number;
  fontColor: string;
}

/**
 * Builds an SVG data URL that spotlights one color's sections. It overlays only
 * the facets of the chosen color, painted at their true palette color (100%),
 * with the border and number redrawn on top so they stay visible over the solid
 * fill. Every other facet is left out of the overlay (fully transparent), so the
 * base image — and all its other numbers — shows through untouched.
 *
 * The SVG uses the same width/height/viewBox as the processed output, so it
 * lines up when the compare slider scales it via CSS.
 */
export function buildHighlightOverlayDataUrl(
  facetResult: FacetResult,
  colorIndex: number,
  palette: RGB[],
  opts: HighlightOverlayOptions,
): string {
  const { width, height, facets } = facetResult;
  const svg = document.createElementNS(XMLNS, "svg");
  svg.setAttribute("width", width + "");
  svg.setAttribute("height", height + "");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  for (const f of facets) {
    if (f == null || f.color !== colorIndex) continue;
    const data = buildFacetPathData(f);
    if (data == null) continue;

    const c = palette[f.color];

    // Solid fill at 100% — this is the highlight.
    const fillPath = document.createElementNS(XMLNS, "path");
    fillPath.setAttribute("d", data);
    fillPath.style.stroke = "none";
    fillPath.style.fill = `rgb(${c[0]},${c[1]},${c[2]})`;
    svg.appendChild(fillPath);

    // The solid fill would cover the base image's border, so redraw it here.
    if (opts.showBorders) {
      const strokePath = document.createElementNS(XMLNS, "path");
      strokePath.setAttribute("d", data);
      strokePath.style.fill = "none";
      strokePath.style.strokeWidth = "0.33px";
      strokePath.style.stroke = "#000";
      svg.appendChild(strokePath);
    }

    // Keep the number readable on top of the full-color fill.
    if (opts.showLabels) {
      svg.appendChild(buildFacetLabel(f, opts.fontSize, opts.fontColor));
    }
  }

  const serialized = new XMLSerializer().serializeToString(svg);
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);
}
