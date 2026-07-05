import { useCallback, useState } from "react";
import { RGB } from "@/lib/pbn/common";
import { ClusteringColorSpace, Settings } from "@/lib/pbn/settings";
import { PresetValues } from "./constants";

/** How user-chosen colors are used to build the palette. */
export type PaletteMode = "exact" | "complement";

const sameColor = (a: RGB, b: RGB) =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * Owns every input-side option (resize, clustering, facet pruning, …) together
 * with the helpers that act on them: applying a preset, deciding whether a preset
 * is currently active and building the `Settings` object the pipeline consumes.
 */
export function useInputOptions() {
  const [resizeImage, setResizeImage] = useState(true);
  const [resizeWidth, setResizeWidth] = useState(1024);
  const [resizeHeight, setResizeHeight] = useState(1024);
  const [nrOfClusters, setNrOfClusters] = useState(16);
  const [clusterPrecision, setClusterPrecision] = useState(1);
  const [randomSeed, setRandomSeed] = useState(0);
  const [colorSpace, setColorSpace] = useState<ClusteringColorSpace>(
    ClusteringColorSpace.RGB,
  );
  const [colorRestrictions, setColorRestrictions] = useState(
    "//0,0,0\n//255,255,255\n",
  );
  // colors the user picked from the photo (eyedropper / suggested swatches)
  const [pickedColors, setPickedColors] = useState<RGB[]>([]);
  // how those colors drive the palette: "exact" = only these, "complement" =
  // these guaranteed plus automatic colors to fill up to nrOfClusters
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("complement");
  const [narrowPixelCleanupRuns, setNarrowPixelCleanupRuns] = useState(3);
  const [removeFacetsSmallerThan, setRemoveFacetsSmallerThan] = useState(20);
  const [maximumNumberOfFacets, setMaximumNumberOfFacets] = useState(100000);
  const [largeToSmall, setLargeToSmall] = useState(true);
  const [halveBorderSegments, setHalveBorderSegments] = useState(2);

  const applyPreset = (p: PresetValues) => {
    setResizeImage(true);
    setResizeWidth(p.resizeWidth);
    setResizeHeight(p.resizeHeight);
    setNrOfClusters(p.nrOfClusters);
    setRemoveFacetsSmallerThan(p.removeFacetsSmallerThan);
    setNarrowPixelCleanupRuns(p.narrowPixelCleanupRuns);
    setHalveBorderSegments(p.halveBorderSegments);
  };

  // derived: a preset is "active" when the current options match it exactly,
  // so hand-editing any field simply deselects all presets
  const isPresetActive = (p: PresetValues) =>
    resizeImage &&
    resizeWidth === p.resizeWidth &&
    resizeHeight === p.resizeHeight &&
    nrOfClusters === p.nrOfClusters &&
    removeFacetsSmallerThan === p.removeFacetsSmallerThan &&
    narrowPixelCleanupRuns === p.narrowPixelCleanupRuns &&
    halveBorderSegments === p.halveBorderSegments;

  // toggle a color in/out of the picked list (used by suggested swatches)
  const togglePickedColor = useCallback((rgb: RGB) => {
    setPickedColors((prev) =>
      prev.some((c) => sameColor(c, rgb))
        ? prev.filter((c) => !sameColor(c, rgb))
        : [...prev, rgb],
    );
  }, []);

  const addPickedColor = useCallback((rgb: RGB) => {
    setPickedColors((prev) =>
      prev.some((c) => sameColor(c, rgb)) ? prev : [...prev, rgb],
    );
  }, []);

  const removePickedColor = useCallback((rgb: RGB) => {
    setPickedColors((prev) => prev.filter((c) => !sameColor(c, rgb)));
  }, []);

  const clearPickedColors = useCallback(() => setPickedColors([]), []);

  const buildSettings = useCallback((): Settings => {
    const settings = new Settings();
    settings.kMeansClusteringColorSpace = colorSpace;
    settings.removeFacetsFromLargeToSmall = largeToSmall;
    settings.randomSeed = randomSeed;
    settings.kMeansMinDeltaDifference = clusterPrecision;
    settings.removeFacetsSmallerThanNrOfPoints = removeFacetsSmallerThan;
    settings.maximumNumberOfFacets = maximumNumberOfFacets;
    settings.nrOfTimesToHalveBorderSegments = halveBorderSegments;
    settings.narrowPixelStripCleanupRuns = narrowPixelCleanupRuns;
    settings.resizeImageIfTooLarge = resizeImage;
    settings.resizeImageWidth = resizeWidth;
    settings.resizeImageHeight = resizeHeight;

    // user-chosen colors are pinned into the palette unconditionally
    settings.kMeansPinnedColors = pickedColors;

    if (pickedColors.length > 0 && paletteMode === "exact") {
      // exact mode: the palette IS the chosen colors — pin them all and size
      // the clustering to match so every centroid is fixed. Skip the automatic
      // black/white candidates so the user's palette is the only source.
      settings.kMeansNrOfClusters = pickedColors.length;
      settings.kMeansFixedColors = [];
    } else {
      // complement (or no picks): keep automatic black/white candidates and make
      // sure there's room for the pinned colors on top of the requested count.
      settings.kMeansNrOfClusters = Math.max(nrOfClusters, pickedColors.length);
      settings.kMeansFixedColors = [
        [0, 0, 0],
        [255, 255, 255],
      ];
    }

    settings.kMeansColorRestrictions = [];
    for (const line of colorRestrictions.split("\n")) {
      const tline = line.trim();
      if (tline.indexOf("//") === 0) continue;
      const rgbparts = tline.split(",");
      if (rgbparts.length === 3) {
        let red = parseInt(rgbparts[0]);
        let green = parseInt(rgbparts[1]);
        let blue = parseInt(rgbparts[2]);
        if (red < 0) red = 0;
        if (red > 255) red = 255;
        if (green < 0) green = 0;
        if (green > 255) green = 255;
        if (blue < 0) blue = 0;
        if (blue > 255) blue = 255;
        if (!isNaN(red) && !isNaN(green) && !isNaN(blue)) {
          settings.kMeansColorRestrictions.push([red, green, blue]);
        }
      }
    }
    return settings;
  }, [
    colorSpace,
    largeToSmall,
    randomSeed,
    nrOfClusters,
    clusterPrecision,
    removeFacetsSmallerThan,
    maximumNumberOfFacets,
    halveBorderSegments,
    narrowPixelCleanupRuns,
    resizeImage,
    resizeWidth,
    resizeHeight,
    colorRestrictions,
    pickedColors,
    paletteMode,
  ]);

  return {
    // values
    resizeImage,
    resizeWidth,
    resizeHeight,
    nrOfClusters,
    clusterPrecision,
    randomSeed,
    colorSpace,
    colorRestrictions,
    narrowPixelCleanupRuns,
    removeFacetsSmallerThan,
    maximumNumberOfFacets,
    largeToSmall,
    halveBorderSegments,
    pickedColors,
    paletteMode,
    // setters
    setResizeImage,
    setResizeWidth,
    setResizeHeight,
    setNrOfClusters,
    setClusterPrecision,
    setRandomSeed,
    setColorSpace,
    setColorRestrictions,
    setNarrowPixelCleanupRuns,
    setRemoveFacetsSmallerThan,
    setMaximumNumberOfFacets,
    setLargeToSmall,
    setHalveBorderSegments,
    setPaletteMode,
    // helpers
    applyPreset,
    isPresetActive,
    buildSettings,
    togglePickedColor,
    addPickedColor,
    removePickedColor,
    clearPickedColors,
  };
}

export type InputOptions = ReturnType<typeof useInputOptions>;
