import { RGB } from "./common";

export enum ClusteringColorSpace {
    RGB = 0,
    HSL = 1,
    LAB = 2,
}

export class Settings {
    public kMeansNrOfClusters: number = 16;
    public kMeansMinDeltaDifference: number = 1;
    public kMeansClusteringColorSpace: ClusteringColorSpace = ClusteringColorSpace.RGB;

    public kMeansColorRestrictions: Array<RGB | string> = [];

    // Colors that must always appear in the palette (e.g. pure black/white).
    // Unlike kMeansColorRestrictions (which snaps every centroid to the nearest
    // allowed color), these are added as extra pinned clusters: pixels close to
    // them collapse to the exact color while the rest are clustered normally.
    // These are only added when the image actually contains them (presence check).
    public kMeansFixedColors: RGB[] = [];

    // User-chosen palette colors (e.g. eyedropped from the photo). Like
    // kMeansFixedColors these are added as pinned clusters, but unconditionally:
    // no presence check, because the user explicitly asked for them.
    public kMeansPinnedColors: RGB[] = [];

    public colorAliases: { [key: string]: RGB } = {};

    public narrowPixelStripCleanupRuns: number = 3; // 3 seems like a good compromise between removing enough narrow pixel strips to convergence. This fixes e.g. https://i.imgur.com/dz4ANz1.png

    public removeFacetsSmallerThanNrOfPoints: number = 20;
    public removeFacetsFromLargeToSmall: boolean = true;
    public maximumNumberOfFacets: number = Number.MAX_VALUE;

    public nrOfTimesToHalveBorderSegments: number = 2;

    public resizeImageIfTooLarge: boolean = true;
    public resizeImageWidth: number = 1024;
    public resizeImageHeight: number = 1024;

    public randomSeed: number = new Date().getTime();
}
