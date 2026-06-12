/**
 * Renders the color palette to a PNG and downloads it.
 * Extracted from the original gui.ts `downloadPalettePng`.
 */
import { RGB } from "./common";
import type { MixRecipe } from "./paintMixing";

/**
 * Renders an on-screen DOM node (the "Guía de mezclas de colores" card) to a
 * PNG so the download matches exactly what the user sees, then downloads it.
 */
export async function downloadGuidePng(
  node: HTMLElement,
  filename: string = "guia-mezclas.png"
) {
  // html-to-image renders via the browser's own <foreignObject> path, so CSS
  // mask-image + SVG filters (the brush-stroke swatches) are preserved — unlike
  // html2canvas, which would flatten them to plain rectangles.
  const { toPng } = await import("html-to-image");
  const dataURL = await toPng(node, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    cacheBust: true,
  });
  const dl = document.createElement("a");
  document.body.appendChild(dl);
  dl.setAttribute("href", dataURL);
  dl.setAttribute("download", filename);
  dl.click();
  document.body.removeChild(dl);
}

export function downloadPalettePng(
  colorsByIndex: RGB[],
  recipes?: MixRecipe[],
  filename: string = "palette.png"
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  if (recipes && recipes.length === colorsByIndex.length) {
    // List layout: one row per color with recipe text
    const margin = 10;
    const rowHeight = 52;
    const swatchSize = 36;
    const padding = 8;

    // Measure longest recipe text to determine canvas width
    ctx.font = "11px Tahoma";
    let maxTextWidth = 200;
    for (const recipe of recipes) {
      const text = recipe.entries
        .map(e => `${e.parts} ${e.parts === 1 ? "parte" : "partes"} ${e.paint.nameEs}`)
        .join(" + ");
      const w = ctx.measureText(text).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    const badgeWidth = 60;
    const swatchGap = 8;
    const canvasWidth = margin + swatchSize + swatchGap + swatchSize + swatchGap + Math.ceil(maxTextWidth) + badgeWidth + margin * 2;
    canvas.width = Math.max(canvasWidth, 480);
    canvas.height = margin + colorsByIndex.length * (rowHeight + 4) + margin + 18;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < colorsByIndex.length; i++) {
      const c = colorsByIndex[i];
      const recipe = recipes[i];
      const y = margin + i * (rowHeight + 4);

      // Target color swatch
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(margin, y, swatchSize, swatchSize);
      ctx.strokeStyle = "#aaa";
      ctx.strokeRect(margin, y, swatchSize, swatchSize);

      // Index number centered in swatch
      ctx.font = "bold 12px Tahoma";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      const idx = String(i + 1);
      const idxW = ctx.measureText(idx).width;
      ctx.strokeText(idx, margin + swatchSize / 2 - idxW / 2, y + swatchSize / 2 + 4);
      ctx.lineWidth = 1;
      ctx.fillText(idx, margin + swatchSize / 2 - idxW / 2, y + swatchSize / 2 + 4);

      // Mixed result swatch
      const mx = margin + swatchSize + swatchGap;
      const m = recipe.mixedRgb;
      ctx.fillStyle = `rgb(${m[0]},${m[1]},${m[2]})`;
      ctx.fillRect(mx, y, swatchSize, swatchSize);
      ctx.strokeStyle = "#aaa";
      ctx.strokeRect(mx, y, swatchSize, swatchSize);

      // Approx arrow between swatches
      ctx.fillStyle = "#888";
      ctx.font = "14px Tahoma";
      ctx.fillText("≈", margin + swatchSize + 1, y + swatchSize / 2 + 5);

      // Recipe text
      const recipeText = recipe.entries
        .map(e => `${e.parts} ${e.parts === 1 ? "parte" : "partes"} ${e.paint.nameEs}`)
        .join(" + ");
      const tx = mx + swatchSize + swatchGap;
      ctx.font = "11px Tahoma";
      ctx.fillStyle = "#222";
      ctx.fillText(recipeText, tx, y + swatchSize / 2 + 4, canvas.width - tx - badgeWidth - margin);

      // RGB of target
      ctx.font = "9px Tahoma";
      ctx.fillStyle = "#666";
      ctx.fillText(`RGB ${c[0]},${c[1]},${c[2]}`, tx, y + swatchSize - 1);

      // DeltaE badge
      const badgeColors: Record<string, string[]> = {
        good: ["#d4edda", "#155724"],
        fair: ["#fff3cd", "#856404"],
        poor: ["#f8d7da", "#721c24"],
      };
      const [bg, fg] = badgeColors[recipe.quality];
      const badgeText = `ΔE ${recipe.deltaE.toFixed(1)}`;
      ctx.font = "bold 10px Tahoma";
      const bw = ctx.measureText(badgeText).width + padding * 2;
      const bx = canvas.width - margin - bw;
      const by = y + (swatchSize - 18) / 2;
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, 18, 9);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.fillText(badgeText, bx + padding, by + 13);
    }

    // Attribution footer
    ctx.font = "9px Tahoma";
    ctx.fillStyle = "#aaa";
    ctx.fillText(
      "Mixing recipes powered by Mixbox © Secret Weapons — CC BY-NC 4.0",
      margin,
      canvas.height - 4
    );
  } else {
    // Original grid layout
    const nrOfItemsPerRow = 10;
    const nrRows = Math.ceil(colorsByIndex.length / nrOfItemsPerRow);
    const margin = 10;
    const cellWidth = 80;
    const cellHeight = 70;

    canvas.width = margin + nrOfItemsPerRow * (cellWidth + margin);
    canvas.height = margin + nrRows * (cellHeight + margin);
    ctx.translate(0.5, 0.5);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < colorsByIndex.length; i++) {
      const color = colorsByIndex[i];
      const x = margin + (i % nrOfItemsPerRow) * (cellWidth + margin);
      const y = margin + Math.floor(i / nrOfItemsPerRow) * (cellHeight + margin);

      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.fillRect(x, y, cellWidth, cellHeight - 20);
      ctx.strokeStyle = "#888";
      ctx.strokeRect(x, y, cellWidth, cellHeight - 20);

      const nrText = i + 1 + "";
      ctx.fillStyle = "black";
      ctx.strokeStyle = "#CCC";
      ctx.font = "20px Tahoma";
      const nrTextSize = ctx.measureText(nrText);
      ctx.lineWidth = 2;
      ctx.strokeText(nrText, x + cellWidth / 2 - nrTextSize.width / 2, y + cellHeight / 2 - 5);
      ctx.fillText(nrText, x + cellWidth / 2 - nrTextSize.width / 2, y + cellHeight / 2 - 5);
      ctx.lineWidth = 1;

      ctx.font = "10px Tahoma";
      const rgbText = "RGB: " + Math.floor(color[0]) + "," + Math.floor(color[1]) + "," + Math.floor(color[2]);
      const rgbTextSize = ctx.measureText(rgbText);
      ctx.fillStyle = "black";
      ctx.fillText(rgbText, x + cellWidth / 2 - rgbTextSize.width / 2, y + cellHeight - 10);
    }
  }

  const dataURL = canvas.toDataURL("image/png");
  const dl = document.createElement("a");
  document.body.appendChild(dl);
  dl.setAttribute("href", dataURL);
  dl.setAttribute("download", filename);
  dl.click();
  document.body.removeChild(dl);
}
