import { useState } from "react";
import { ClusteringColorSpace } from "@/lib/pbn/settings";
import { PRESETS } from "./constants";
import { InputOptions } from "./useInputOptions";
import styles from "../PaintByNumbers.module.css";

const COLOR_SPACES: { value: ClusteringColorSpace; label: string }[] = [
  { value: ClusteringColorSpace.RGB, label: "RGB" },
  { value: ClusteringColorSpace.HSL, label: "HSL" },
  { value: ClusteringColorSpace.LAB, label: "Lab" },
];

/** Small "?" badge that reveals a definition on hover or keyboard focus. */
function HelpTip({ text }: { text: string }) {
  return (
    <span className={styles.helpTip} tabIndex={0} role="note" aria-label={text}>
      ?
      <span className={styles.helpBubble} role="tooltip">
        {text}
      </span>
    </span>
  );
}

export default function InputOptionsPane({ opts }: { opts: InputOptions }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

      {/* Custom */}
      <div className={styles.optGroup}>
        <span className={styles.optGroupTitle}>Custom</span>
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
        <div className={styles.fieldGrid}>
          <label
            className={styles.field}
            aria-disabled={!opts.resizeImage}
            style={{ opacity: opts.resizeImage ? 1 : 0.5 }}
          >
            <span className={styles.fieldLabel}>
              Maximum width (px)
              <HelpTip text="Large images are scaled down so their width doesn't exceed this, which speeds up processing." />
            </span>
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
          <label
            className={styles.field}
            aria-disabled={!opts.resizeImage}
            style={{ opacity: opts.resizeImage ? 1 : 0.5 }}
          >
            <span className={styles.fieldLabel}>
              Maximum height (px)
              <HelpTip text="Large images are scaled down so their height doesn't exceed this, which speeds up processing." />
            </span>
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
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Number of colors
              <HelpTip text="How many distinct colors the final palette will contain." />
            </span>
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
            <span className={styles.fieldLabel}>
              Remove areas smaller than (px)
              <HelpTip text="Regions with fewer pixels than this are merged into their neighbors to remove tiny specks." />
            </span>
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
        </div>
      </div>

      {/* Advanced settings */}
      <div className={styles.optGroup}>
        <button
          type="button"
          className={styles.advancedToggle}
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <span className={styles.advancedChevron} aria-hidden>
            {advancedOpen ? "▾" : "▸"}
          </span>
          Advanced settings
        </button>

        {advancedOpen && (
          <>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Color grouping precision
                  <HelpTip text="How tightly colors are grouped before the algorithm stops. Lower values are more precise but slower." />
                </span>
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
                <span className={styles.fieldLabel}>
                  Random seed
                  <HelpTip text="Starting value for the random initialization. The same seed always produces the same result." />
                </span>
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
              <span className={styles.fieldLabel}>
                Color comparison model
                <HelpTip text="Color space used to measure how similar two colors are: RGB, HSL or Lab (Lab matches human perception best)." />
              </span>
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

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Limit palette to these colors
                <HelpTip text="Restricts the palette to only the listed colors — each region snaps to the nearest one. Leave empty for no restriction." />
              </span>
              <span className={styles.fieldSub}>
                one r,g,b per line — use // to comment
              </span>
              <textarea
                className={styles.textarea}
                value={opts.colorRestrictions}
                onChange={(e) => opts.setColorRestrictions(e.target.value)}
              />
            </label>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Thin pixel strip cleanup
                  <HelpTip text="Number of passes that remove narrow one-pixel-wide strips between regions for cleaner borders." />
                </span>
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
                <span className={styles.fieldLabel}>
                  Maximum number of areas
                  <HelpTip text="Upper limit on how many separate regions are generated." />
                </span>
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
                <span className={styles.fieldLabel}>
                  Border smoothing
                  <HelpTip text="How many times each region border is simplified. More passes give smoother, less jagged edges." />
                </span>
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
              <span className={styles.fieldLabel}>
                Area removal order
                <HelpTip text="Whether small-region removal starts from the largest regions or the smallest first." />
              </span>
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
          </>
        )}
      </div>
    </div>
  );
}
