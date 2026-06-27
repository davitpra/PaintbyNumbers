import { ClusteringColorSpace } from "@/lib/pbn/settings";
import { PRESETS } from "./constants";
import { InputOptions } from "./useInputOptions";
import styles from "../PaintByNumbers.module.css";

const COLOR_SPACES: { value: ClusteringColorSpace; label: string }[] = [
  { value: ClusteringColorSpace.RGB, label: "RGB" },
  { value: ClusteringColorSpace.HSL, label: "HSL" },
  { value: ClusteringColorSpace.LAB, label: "Lab" },
];

export default function InputOptionsPane({ opts }: { opts: InputOptions }) {
  return (
    <div className={styles.inputPane}>
      {/* Presets */}
      <div className={styles.optGroup}>
        <span className={styles.optGroupTitle}>Presets</span>
        <div className={styles.presetRow}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
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
      </div>

      {/* Resize */}
      <div className={styles.optGroup}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            className={styles.toggleInput}
            checked={opts.resizeImage}
            onChange={(e) => opts.setResizeImage(e.target.checked)}
          />
          <span className={styles.toggleTrack} aria-hidden>
            <span className={styles.toggleThumb} />
          </span>
          <span className={styles.toggleText}>Resize large images</span>
        </label>
        <div
          className={styles.fieldGrid}
          aria-disabled={!opts.resizeImage}
          style={{ opacity: opts.resizeImage ? 1 : 0.5 }}
        >
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Max width</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={1}
              disabled={!opts.resizeImage}
              value={opts.resizeWidth}
              onChange={(e) =>
                opts.setResizeWidth(parseInt(e.target.value) || 0)
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Max height</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={1}
              disabled={!opts.resizeImage}
              value={opts.resizeHeight}
              onChange={(e) =>
                opts.setResizeHeight(parseInt(e.target.value) || 0)
              }
            />
          </label>
        </div>
      </div>

      {/* Clustering */}
      <div className={styles.optGroup}>
        <span className={styles.optGroupTitle}>Clustering</span>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Number of colors</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={1}
              value={opts.nrOfClusters}
              onChange={(e) =>
                opts.setNrOfClusters(parseInt(e.target.value) || 1)
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Cluster precision</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={1}
              step={0.05}
              value={opts.clusterPrecision}
              onChange={(e) =>
                opts.setClusterPrecision(parseFloat(e.target.value) || 1)
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Random seed</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={0}
              step={1}
              value={opts.randomSeed}
              onChange={(e) =>
                opts.setRandomSeed(parseInt(e.target.value) || 0)
              }
            />
          </label>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Clustering color space</span>
          <div className={styles.segmented} role="radiogroup">
            {COLOR_SPACES.map((cs) => (
              <label
                key={cs.label}
                className={
                  opts.colorSpace === cs.value
                    ? styles.segmentActive
                    : styles.segment
                }
              >
                <input
                  type="radio"
                  name="colorspace"
                  className={styles.segmentInput}
                  checked={opts.colorSpace === cs.value}
                  onChange={() => opts.setColorSpace(cs.value)}
                />
                {cs.label}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Always include in palette</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={opts.includeBlack}
              onChange={(e) => opts.setIncludeBlack(e.target.checked)}
            />
            <span className={styles.toggleTrack} aria-hidden>
              <span className={styles.toggleThumb} />
            </span>
            <span className={styles.toggleText}>Black</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={opts.includeWhite}
              onChange={(e) => opts.setIncludeWhite(e.target.checked)}
            />
            <span className={styles.toggleTrack} aria-hidden>
              <span className={styles.toggleThumb} />
            </span>
            <span className={styles.toggleText}>White</span>
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Restrict clustering colors</span>
          <span className={styles.fieldSub}>
            one r,g,b per line — use // to comment
          </span>
          <textarea
            className={styles.textarea}
            value={opts.colorRestrictions}
            onChange={(e) => opts.setColorRestrictions(e.target.value)}
          />
        </label>
      </div>

      {/* Facet cleanup */}
      <div className={styles.optGroup}>
        <span className={styles.optGroupTitle}>Facet cleanup</span>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Narrow pixel cleanup runs</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={0}
              value={opts.narrowPixelCleanupRuns}
              onChange={(e) =>
                opts.setNarrowPixelCleanupRuns(parseInt(e.target.value) || 0)
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Remove facets under (px)</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={1}
              value={opts.removeFacetsSmallerThan}
              onChange={(e) =>
                opts.setRemoveFacetsSmallerThan(parseInt(e.target.value) || 1)
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Maximum facets</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={1}
              value={opts.maximumNumberOfFacets}
              onChange={(e) =>
                opts.setMaximumNumberOfFacets(parseInt(e.target.value) || 1)
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Border simplify passes</span>
            <input
              type="number"
              className={styles.fieldInput}
              min={0}
              value={opts.halveBorderSegments}
              onChange={(e) =>
                opts.setHalveBorderSegments(parseInt(e.target.value) || 0)
              }
            />
          </label>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Small facet removal order</span>
          <div className={styles.segmented} role="radiogroup">
            <label
              className={
                opts.largeToSmall ? styles.segmentActive : styles.segment
              }
            >
              <input
                type="radio"
                name="facetremovalorder"
                className={styles.segmentInput}
                checked={opts.largeToSmall}
                onChange={() => opts.setLargeToSmall(true)}
              />
              Largest first
            </label>
            <label
              className={
                !opts.largeToSmall ? styles.segmentActive : styles.segment
              }
            >
              <input
                type="radio"
                name="facetremovalorder"
                className={styles.segmentInput}
                checked={!opts.largeToSmall}
                onChange={() => opts.setLargeToSmall(false)}
              />
              Smallest first
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
