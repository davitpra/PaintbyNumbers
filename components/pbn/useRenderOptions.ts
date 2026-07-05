import { useState } from "react";

/** Owns the SVG render options that re-generate the output without re-processing. */
export function useRenderOptions() {
  const [showLabels, setShowLabels] = useState(true);
  const [fillFacets, setFillFacets] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [labelFontSize, setLabelFontSize] = useState(12);
  const [labelFontColor, setLabelFontColor] = useState("#000");
  const [fillOpacity, setFillOpacity] = useState(0.3);

  return {
    showLabels,
    fillFacets,
    showBorders,
    labelFontSize,
    labelFontColor,
    fillOpacity,
    setShowLabels,
    setFillFacets,
    setShowBorders,
    setLabelFontSize,
    setLabelFontColor,
    setFillOpacity,
  };
}

export type RenderOptions = ReturnType<typeof useRenderOptions>;
