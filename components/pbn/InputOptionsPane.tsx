import { ClusteringColorSpace } from "@/lib/pbn/settings";
import { PRESETS } from "./constants";
import { InputOptions } from "./useInputOptions";
import styles from "../PaintByNumbers.module.css";

export default function InputOptionsPane({ opts }: { opts: InputOptions }) {
  return (
    <div className={styles.pane}>
      <div className={styles.optionRow}>
        <span>Presets</span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={
              opts.isPresetActive(p.apply)
                ? styles.presetBtnActive
                : styles.presetBtn
            }
            onClick={() => opts.applyPreset(p.apply)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={styles.optionRow}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={opts.resizeImage}
            onChange={(e) => opts.setResizeImage(e.target.checked)}
          />
          Resize image larger than
        </label>
        <label>
          width
          <input
            type="number"
            min={1}
            value={opts.resizeWidth}
            onChange={(e) => opts.setResizeWidth(parseInt(e.target.value) || 0)}
          />
        </label>
        <label>
          height
          <input
            type="number"
            min={1}
            value={opts.resizeHeight}
            onChange={(e) => opts.setResizeHeight(parseInt(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className={styles.optionRow}>
        <label>
          Number of colors
          <input
            type="number"
            min={1}
            value={opts.nrOfClusters}
            onChange={(e) => opts.setNrOfClusters(parseInt(e.target.value) || 1)}
          />
        </label>
        <label>
          Cluster precision
          <input
            type="number"
            min={1}
            step={0.05}
            value={opts.clusterPrecision}
            onChange={(e) =>
              opts.setClusterPrecision(parseFloat(e.target.value) || 1)
            }
          />
        </label>
        <label>
          Random seed
          <input
            type="number"
            min={0}
            step={1}
            value={opts.randomSeed}
            onChange={(e) => opts.setRandomSeed(parseInt(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className={styles.optionRow}>
        <span>Clustering color space</span>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="colorspace"
            checked={opts.colorSpace === ClusteringColorSpace.RGB}
            onChange={() => opts.setColorSpace(ClusteringColorSpace.RGB)}
          />
          RGB
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="colorspace"
            checked={opts.colorSpace === ClusteringColorSpace.HSL}
            onChange={() => opts.setColorSpace(ClusteringColorSpace.HSL)}
          />
          HSL
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="colorspace"
            checked={opts.colorSpace === ClusteringColorSpace.LAB}
            onChange={() => opts.setColorSpace(ClusteringColorSpace.LAB)}
          />
          Lab
        </label>
      </div>

      <div className={styles.optionColumn}>
        <label>
          Restrict clustering colors (one r,g,b per line, // to comment)
          <textarea
            className={styles.textarea}
            value={opts.colorRestrictions}
            onChange={(e) => opts.setColorRestrictions(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.optionRow}>
        <label>
          Narrow pixel cleanup runs
          <input
            type="number"
            min={0}
            value={opts.narrowPixelCleanupRuns}
            onChange={(e) =>
              opts.setNarrowPixelCleanupRuns(parseInt(e.target.value) || 0)
            }
          />
        </label>
        <label>
          Remove facets smaller than (pixels)
          <input
            type="number"
            min={1}
            value={opts.removeFacetsSmallerThan}
            onChange={(e) =>
              opts.setRemoveFacetsSmallerThan(parseInt(e.target.value) || 1)
            }
          />
        </label>
        <label>
          Maximum number of facets
          <input
            type="number"
            min={1}
            value={opts.maximumNumberOfFacets}
            onChange={(e) =>
              opts.setMaximumNumberOfFacets(parseInt(e.target.value) || 1)
            }
          />
        </label>
      </div>

      <div className={styles.optionRow}>
        <span>Small facet removal order</span>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="facetremovalorder"
            checked={opts.largeToSmall}
            onChange={() => opts.setLargeToSmall(true)}
          />
          Largest to smallest
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="facetremovalorder"
            checked={!opts.largeToSmall}
            onChange={() => opts.setLargeToSmall(false)}
          />
          Smallest to largest
        </label>
      </div>

      <div className={styles.optionRow}>
        <label>
          Times to halve border segment complexity
          <input
            type="number"
            min={0}
            value={opts.halveBorderSegments}
            onChange={(e) =>
              opts.setHalveBorderSegments(parseInt(e.target.value) || 0)
            }
          />
        </label>
      </div>
    </div>
  );
}
