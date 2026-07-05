/**
 * Helpers for the "choose your colors" feature: extracting the dominant colors
 * from a photo (to suggest a palette) and sampling a single color under the
 * eyedropper. Both run on the main thread; the dominant-color extraction works
 * on a tiny downscaled copy of the image so it stays fast.
 */
import { RGB } from "./common";
import { KMeans, Vector } from "./lib/clustering";
import { lab2rgb, rgb2lab } from "./lib/colorconversion";
import { Random } from "./random";

// Downscale the image so both axes fit within this box before clustering.
// Dominant colors don't need full resolution and this keeps extraction instant.
const SAMPLE_MAX_SIDE = 96;
// Deterministic seed so the suggested palette is stable for a given image.
const EXTRACT_SEED = 1;

/** Loads an image source (data URL / URL) into an HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Unable to load image"));
        img.src = src;
    });
}

/**
 * Extracts up to `count` dominant colors from the image, ordered from most to
 * least prominent. Uses the same weighted k-means (in Lab space) as the main
 * pipeline so the suggestions match how the final palette is built.
 */
export async function extractDominantColors(src: string, count = 12): Promise<RGB[]> {
    const img = await loadImage(src);

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w === 0 || h === 0) {
        return [];
    }

    const scale = Math.min(1, SAMPLE_MAX_SIDE / Math.max(w, h));
    const sw = Math.max(1, Math.round(w * scale));
    const sh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return [];
    }
    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;

    // bucket pixels by (bit-reduced) color, weighted by frequency
    const countByColor = new Map<string, { rgb: RGB; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // skip mostly-transparent pixels
        const r = data[i] & 0xf8;
        const g = data[i + 1] & 0xf8;
        const b = data[i + 2] & 0xf8;
        const key = `${r},${g},${b}`;
        const entry = countByColor.get(key);
        if (entry) {
            entry.n++;
        } else {
            countByColor.set(key, { rgb: [r, g, b], n: 1 });
        }
    }

    const entries = [...countByColor.values()];
    if (entries.length === 0) {
        return [];
    }

    const totalPixels = entries.reduce((acc, e) => acc + e.n, 0);
    const vectors = entries.map((e) => {
        const v = new Vector(rgb2lab(e.rgb), e.n / totalPixels);
        v.tag = e; // keep pixel weight around for ordering
        return v;
    });

    const k = Math.min(count, vectors.length);
    const kmeans = new KMeans(vectors, k, new Random(EXTRACT_SEED));
    kmeans.step();
    let guard = 0;
    while (kmeans.currentDeltaDistanceDifference > 1 && guard++ < 50) {
        kmeans.step();
    }

    // order clusters by total pixel weight so the most prominent colors come first
    const clusters: { rgb: RGB; weight: number }[] = [];
    for (let c = 0; c < kmeans.centroids.length; c++) {
        const members = kmeans.pointsPerCategory[c];
        if (!members || members.length === 0) continue;
        let weight = 0;
        for (const m of members) {
            weight += (m.tag as { n: number }).n;
        }
        const rgb = lab2rgb(kmeans.centroids[c].values).map((v) =>
            Math.min(255, Math.max(0, Math.round(v))),
        ) as RGB;
        clusters.push({ rgb, weight });
    }
    clusters.sort((a, b) => b.weight - a.weight);
    return clusters.map((c) => c.rgb);
}

/**
 * Samples the color at (x, y) on a canvas, averaging a small 3×3 neighborhood so
 * the eyedropper isn't thrown off by single-pixel noise. Coordinates are in the
 * canvas's own pixel space and clamped to its bounds.
 */
export function sampleColorAt(canvas: HTMLCanvasElement, x: number, y: number): RGB {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return [0, 0, 0];
    }
    const cx = Math.min(canvas.width - 1, Math.max(0, Math.round(x)));
    const cy = Math.min(canvas.height - 1, Math.max(0, Math.round(y)));
    const x0 = Math.max(0, cx - 1);
    const y0 = Math.max(0, cy - 1);
    const x1 = Math.min(canvas.width - 1, cx + 1);
    const y1 = Math.min(canvas.height - 1, cy + 1);
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const data = ctx.getImageData(x0, y0, bw, bh).data;

    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
    }
    if (n === 0) {
        return [0, 0, 0];
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
