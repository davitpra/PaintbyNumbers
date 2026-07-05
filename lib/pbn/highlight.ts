import { RGB } from "./common";
import { FacetResult } from "./facetmanagement";

// Opacity kept for non-selected sections (composited over white). Everything
// except the chosen color fades to a 10% ghost so its hue is still readable.
const FADE_OPACITY = 0.1;

/**
 * Builds a PNG data URL the size of the source image (facet coordinates, before
 * any sizeMultiplier) that spotlights one color's sections. Non-selected pixels
 * are painted as their own palette color faded to {@link FADE_OPACITY} over
 * white (a ghost of the image), while the selected sections stay fully
 * transparent so their true color shows through at 100%.
 */
export function buildHighlightMaskDataUrl(
  facetResult: FacetResult,
  colorIndex: number,
  palette: RGB[],
): string {
  const { width, height, facetMap, facets } = facetResult;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  let i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const facet = facets[facetMap.get(x, y)];
      if (!facet || facet.color !== colorIndex) {
        // non-selected → this pixel's palette color faded to 10% over white
        const c = facet ? palette[facet.color] : [255, 255, 255];
        data[i] = fade(c[0]);
        data[i + 1] = fade(c[1]);
        data[i + 2] = fade(c[2]);
        data[i + 3] = 255;
      }
      // selected section → transparent, true color shows through (alpha stays 0)
      i += 4;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/** Composite one channel over white at FADE_OPACITY. */
function fade(channel: number): number {
  return Math.round(255 * (1 - FADE_OPACITY) + channel * FADE_OPACITY);
}
