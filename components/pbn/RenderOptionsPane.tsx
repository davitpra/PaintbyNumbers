import { RGB } from "@/lib/pbn/common";
import { RenderOptions } from "./useRenderOptions";
import styles from "../PaintByNumbers.module.css";

interface RenderOptionsPaneProps {
  opts: RenderOptions;
  palette: RGB[];
  svgContainerRef: React.RefObject<HTMLDivElement | null>;
}

export default function RenderOptionsPane({
  opts,
  palette,
  svgContainerRef,
}: RenderOptionsPaneProps) {
  return (
    <>
      <div className={styles.optionRow}>
        <span>SVG Render options</span>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={opts.showLabels}
            onChange={(e) => opts.setShowLabels(e.target.checked)}
          />
          Show labels
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={opts.fillFacets}
            onChange={(e) => opts.setFillFacets(e.target.checked)}
          />
          Fill facets
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={opts.showBorders}
            onChange={(e) => opts.setShowBorders(e.target.checked)}
          />
          Show borders
        </label>
      </div>
      <div className={styles.optionRow}>
        <label>
          SVG size multiplier
          <input
            type="number"
            min={1}
            value={opts.sizeMultiplier}
            onChange={(e) =>
              opts.setSizeMultiplier(parseInt(e.target.value) || 1)
            }
          />
        </label>
        <label>
          Label size
          <input
            type="number"
            min={1}
            max={40}
            value={opts.labelFontSize}
            onChange={(e) =>
              opts.setLabelFontSize(parseInt(e.target.value) || 1)
            }
          />
        </label>
        <label>
          Label font color
          <input
            type="text"
            value={opts.labelFontColor}
            onChange={(e) => opts.setLabelFontColor(e.target.value)}
          />
        </label>
        <label>
          Fill opacity ({Math.round(opts.fillOpacity * 100)}%)
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(opts.fillOpacity * 100)}
            onChange={(e) =>
              opts.setFillOpacity((parseInt(e.target.value) || 0) / 100)
            }
          />
        </label>
      </div>

      <div className={styles.palette}>
        {palette.map((c, i) => (
          <div
            key={i}
            className={styles.color}
            style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
            title={`${c[0]},${c[1]},${c[2]}`}
          >
            {i}
          </div>
        ))}
      </div>
      <div ref={svgContainerRef} className={styles.svgContainer} />
    </>
  );
}
