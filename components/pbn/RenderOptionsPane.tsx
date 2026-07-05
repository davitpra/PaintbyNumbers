import { RenderOptions } from "./useRenderOptions";
import styles from "../PaintByNumbers.module.css";

interface RenderOptionsPaneProps {
  opts: RenderOptions;
}

/** Native <input type="color"> only accepts #rrggbb, so expand shorthand
 * (#rgb) and fall back to black for anything it can't parse. */
function toColorInputValue(value: string): string {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return "#000000";
}

export default function RenderOptionsPane({ opts }: RenderOptionsPaneProps) {
  const toggles: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }[] = [
    {
      label: "Show labels",
      checked: opts.showLabels,
      onChange: opts.setShowLabels,
    },
    {
      label: "Fill facets",
      checked: opts.fillFacets,
      onChange: opts.setFillFacets,
    },
    {
      label: "Show borders",
      checked: opts.showBorders,
      onChange: opts.setShowBorders,
    },
  ];

  return (
    <section className={styles.renderCard}>
      <header className={styles.renderHeader}>
        <h4 className={styles.renderTitle}>Render options</h4>
        <p className={styles.renderHint}>
          Tweak the SVG output — changes apply without reprocessing.
        </p>
      </header>

      <div className={styles.toggleGroup}>
        {toggles.map((t) => (
          <label key={t.label} className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={t.checked}
              onChange={(e) => t.onChange(e.target.checked)}
            />
            <span className={styles.toggleTrack} aria-hidden>
              <span className={styles.toggleThumb} />
            </span>
            <span className={styles.toggleText}>{t.label}</span>
          </label>
        ))}
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>SVG size multiplier</span>
          <input
            type="number"
            className={styles.fieldInput}
            min={1}
            value={opts.sizeMultiplier}
            onChange={(e) =>
              opts.setSizeMultiplier(parseInt(e.target.value) || 1)
            }
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Label size</span>
          <input
            type="number"
            className={styles.fieldInput}
            min={1}
            max={40}
            value={opts.labelFontSize}
            onChange={(e) =>
              opts.setLabelFontSize(parseInt(e.target.value) || 1)
            }
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Label color</span>
          <div className={styles.colorField}>
            <input
              type="color"
              className={styles.colorSwatch}
              value={toColorInputValue(opts.labelFontColor)}
              onChange={(e) => opts.setLabelFontColor(e.target.value)}
            />
            <input
              type="text"
              className={styles.fieldInput}
              value={opts.labelFontColor}
              onChange={(e) => opts.setLabelFontColor(e.target.value)}
            />
          </div>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Fill opacity
            <span className={styles.fieldValue}>
              {Math.round(opts.fillOpacity * 100)}%
            </span>
          </span>
          <input
            type="range"
            className={styles.range}
            min={0}
            max={100}
            value={Math.round(opts.fillOpacity * 100)}
            onChange={(e) =>
              opts.setFillOpacity((parseInt(e.target.value) || 0) / 100)
            }
          />
        </label>
      </div>
    </section>
  );
}
