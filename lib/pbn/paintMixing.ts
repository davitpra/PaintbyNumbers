import { RGB } from "./common";
import { createYielder } from "./common";
import { rgb2lab } from "./lib/colorconversion";
import { rgbToLatent, latentToRgb, mixLatents, Latent } from "./vendor/mixbox";
import { BasePaint, DEFAULT_BASE_PAINTS } from "./basePaints";

export type { BasePaint } from "./basePaints";
export { DEFAULT_BASE_PAINTS } from "./basePaints";

export interface RecipeEntry {
  paint: BasePaint;
  parts: number;
}

export interface MixRecipe {
  entries: RecipeEntry[];
  mixedRgb: RGB;
  deltaE: number;
  quality: "good" | "fair" | "poor";
}

// --------------- ratio tables (precomputed) ---------------

function gcd(a: number, b: number): number {
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}

function gcd3(a: number, b: number, c: number): number {
  return gcd(gcd(a, b), c);
}

// All primitive pairs (a,b) with a,b >= 1 and a+b <= 10
const PAIR_RATIOS: [number, number][] = [];
for (let s = 2; s <= 10; s++) {
  for (let a = 1; a < s; a++) {
    const b = s - a;
    if (gcd(a, b) === 1) PAIR_RATIOS.push([a, b]);
  }
}

// All primitive triples (a,b,c) with a,b,c >= 1 and a+b+c <= 8
const TRIPLE_RATIOS: [number, number, number][] = [];
for (let s = 3; s <= 8; s++) {
  for (let a = 1; a <= s - 2; a++) {
    for (let b = 1; b <= s - a - 1; b++) {
      const c = s - a - b;
      if (gcd3(a, b, c) === 1) TRIPLE_RATIOS.push([a, b, c]);
    }
  }
}

// --------------- helpers ---------------

function labDist(lab1: number[], lab2: number[]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

function quality(deltaE: number): "good" | "fair" | "poor" {
  return deltaE < 3 ? "good" : deltaE < 6 ? "fair" : "poor";
}

function makeRecipe(
  paints: BasePaint[],
  parts: number[],
  paintLatents: Latent[],
  targetLab: number[]
): MixRecipe {
  const total = parts.reduce((s, p) => s + p, 0);
  const weights = parts.map(p => p / total);
  const latents = paints.map((_, i) => paintLatents[i]);
  const mixed = latentToRgb(mixLatents(latents, weights));
  const mixedLab = rgb2lab(mixed);
  const dE = labDist(mixedLab, targetLab);
  const g = gcd(parts.length === 2 ? gcd(parts[0], parts[1]) : gcd3(parts[0], parts[1], parts[2]), 0);
  const div = g === 0 ? 1 : g;
  const entries: RecipeEntry[] = paints.map((paint, i) => ({
    paint,
    parts: parts[i] / div,
  })).sort((a, b) => b.parts - a.parts);
  return { entries, mixedRgb: Array.from(mixed), deltaE: dE, quality: quality(dE) };
}

// --------------- public API ---------------

export interface FindRecipeOptions {
  basePaints?: BasePaint[];
  singlePaintDeltaE?: number;
  bestPairDeltaEForEarlyExit?: number;
  simplicityBias?: number;
}

export function findRecipe(target: RGB, opts: FindRecipeOptions = {}): MixRecipe {
  const paints = opts.basePaints ?? DEFAULT_BASE_PAINTS;
  const singleThreshold = opts.singlePaintDeltaE ?? 2.5;
  const pairEarlyExit = opts.bestPairDeltaEForEarlyExit ?? 1.5;
  const bias = opts.simplicityBias ?? 1.0;

  const targetLab = rgb2lab(target);
  const K = paints.length;

  // Precompute latents for all base paints
  const paintLatents: Latent[] = paints.map(p => rgbToLatent(p.rgb));

  let best1: MixRecipe | null = null;
  let best2: MixRecipe | null = null;
  let best3: MixRecipe | null = null;

  // Phase 0: singles
  for (let i = 0; i < K; i++) {
    const mixed = latentToRgb(paintLatents[i]);
    const dE = labDist(rgb2lab(Array.from(mixed)), targetLab);
    if (!best1 || dE < best1.deltaE) {
      best1 = {
        entries: [{ paint: paints[i], parts: 1 }],
        mixedRgb: Array.from(mixed),
        deltaE: dE,
        quality: quality(dE),
      };
    }
  }
  if (best1!.deltaE < singleThreshold) return best1!;

  // Phase 1: pairs
  for (let i = 0; i < K - 1; i++) {
    for (let j = i + 1; j < K; j++) {
      for (const [a, b] of PAIR_RATIOS) {
        const recipe = makeRecipe(
          [paints[i], paints[j]],
          [a, b],
          [paintLatents[i], paintLatents[j]],
          targetLab
        );
        if (!best2 || recipe.deltaE < best2.deltaE) best2 = recipe;
      }
    }
  }

  // Phase 2: triples (skip if pairs are already excellent)
  if (!best2 || best2.deltaE >= pairEarlyExit) {
    for (let i = 0; i < K - 2; i++) {
      for (let j = i + 1; j < K - 1; j++) {
        for (let k = j + 1; k < K; k++) {
          for (const [a, b, c] of TRIPLE_RATIOS) {
            const recipe = makeRecipe(
              [paints[i], paints[j], paints[k]],
              [a, b, c],
              [paintLatents[i], paintLatents[j], paintLatents[k]],
              targetLab
            );
            if (!best3 || recipe.deltaE < best3.deltaE) best3 = recipe;
          }
        }
      }
    }
  }

  // Pick simplest recipe within bias of the global best
  const globalBest = Math.min(
    best1!.deltaE,
    best2?.deltaE ?? Infinity,
    best3?.deltaE ?? Infinity
  );
  const threshold = globalBest + bias;

  if (best1!.deltaE <= threshold) return best1!;
  if (best2 && best2.deltaE <= threshold) return best2;
  return best3 ?? best2 ?? best1!;
}

export async function findRecipes(
  targets: RGB[],
  opts: FindRecipeOptions = {},
  onProgress?: (done: number, total: number) => void
): Promise<MixRecipe[]> {
  const yielder = createYielder(150);
  const results: MixRecipe[] = [];
  for (let i = 0; i < targets.length; i++) {
    results.push(findRecipe(targets[i], opts));
    await yielder();
    onProgress?.(i + 1, targets.length);
  }
  return results;
}
