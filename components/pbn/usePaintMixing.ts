import { useCallback, useState } from "react";
import { RGB } from "@/lib/pbn/common";
import type { MixRecipe } from "@/lib/pbn/paintMixing";

/** Computes the paint-mixing recipes (formulas) for a generated palette. */
export function usePaintMixing() {
  const [recipes, setRecipes] = useState<MixRecipe[] | null>(null);
  const [mixingBusy, setMixingBusy] = useState(false);
  const [mixingProgress, setMixingProgress] = useState(0);

  const computeRecipes = useCallback(async (pal: RGB[]) => {
    if (pal.length === 0) return;
    setMixingBusy(true);
    setMixingProgress(0);
    try {
      const { findRecipes } = await import("@/lib/pbn/paintMixing");
      const result = await findRecipes(pal, undefined, (done, total) =>
        setMixingProgress(done / total),
      );
      setRecipes(result);
    } finally {
      setMixingBusy(false);
    }
  }, []);

  return { recipes, setRecipes, mixingBusy, mixingProgress, computeRecipes };
}
