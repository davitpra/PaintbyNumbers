import { useCallback, useState } from "react";
import { ClusteringColorSpace, Settings } from "@/lib/pbn/settings";
import { PresetValues } from "./constants";

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
  // force pure black/white into the palette as dedicated swatches
  const [includeBlack, setIncludeBlack] = useState(true);
  const [includeWhite, setIncludeWhite] = useState(true);
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

  const buildSettings = useCallback((): Settings => {
    const settings = new Settings();
    settings.kMeansClusteringColorSpace = colorSpace;
    settings.removeFacetsFromLargeToSmall = largeToSmall;
    settings.randomSeed = randomSeed;
    settings.kMeansNrOfClusters = nrOfClusters;
    settings.kMeansMinDeltaDifference = clusterPrecision;
    settings.removeFacetsSmallerThanNrOfPoints = removeFacetsSmallerThan;
    settings.maximumNumberOfFacets = maximumNumberOfFacets;
    settings.nrOfTimesToHalveBorderSegments = halveBorderSegments;
    settings.narrowPixelStripCleanupRuns = narrowPixelCleanupRuns;
    settings.resizeImageIfTooLarge = resizeImage;
    settings.resizeImageWidth = resizeWidth;
    settings.resizeImageHeight = resizeHeight;

    settings.kMeansFixedColors = [];
    if (includeBlack) settings.kMeansFixedColors.push([0, 0, 0]);
    if (includeWhite) settings.kMeansFixedColors.push([255, 255, 255]);

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
    includeBlack,
    includeWhite,
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
    includeBlack,
    includeWhite,
    narrowPixelCleanupRuns,
    removeFacetsSmallerThan,
    maximumNumberOfFacets,
    largeToSmall,
    halveBorderSegments,
    // setters
    setResizeImage,
    setResizeWidth,
    setResizeHeight,
    setNrOfClusters,
    setClusterPrecision,
    setRandomSeed,
    setColorSpace,
    setColorRestrictions,
    setIncludeBlack,
    setIncludeWhite,
    setNarrowPixelCleanupRuns,
    setRemoveFacetsSmallerThan,
    setMaximumNumberOfFacets,
    setLargeToSmall,
    setHalveBorderSegments,
    // helpers
    applyPreset,
    isPresetActive,
    buildSettings,
  };
}

export type InputOptions = ReturnType<typeof useInputOptions>;
