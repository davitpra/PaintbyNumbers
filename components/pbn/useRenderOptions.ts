import { useState } from "react";

/** Owns the SVG render options that re-generate the output without re-processing. */
export function useRenderOptions() {
  const [showLabels, setShowLabels] = useState(true);
  const [fillFacets, setFillFacets] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [sizeMultiplier, setSizeMultiplier] = useState(3);
  const [labelFontSize, setLabelFontSize] = useState(12);
  const [labelFontColor, setLabelFontColor] = useState("#000");
  const [fillOpacity, setFillOpacity] = useState(1);

  return {
    showLabels,
    fillFacets,
    showBorders,
    sizeMultiplier,
    labelFontSize,
    labelFontColor,
    fillOpacity,
    setShowLabels,
    setFillFacets,
    setShowBorders,
    setSizeMultiplier,
    setLabelFontSize,
    setLabelFontColor,
    setFillOpacity,
  };
}

export type RenderOptions = ReturnType<typeof useRenderOptions>;
