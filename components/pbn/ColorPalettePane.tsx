import { RGB } from "@/lib/pbn/common";
import type { MixRecipe } from "@/lib/pbn/paintMixing";
import styles from "../PaintByNumbers.module.css";

interface ColorPalettePaneProps {
  palette: RGB[];
  recipes: MixRecipe[] | null;
  showGuide: boolean;
  onToggleGuide: () => void;
  /** Currently spotlighted color index, or null when none is selected. */
  selectedColor: number | null;
  /** Toggle the spotlight for a color index. */
  onSelectColor: (index: number) => void;
}

export default function ColorPalettePane({
  palette,
  recipes,
  showGuide,
  onToggleGuide,
  selectedColor,
  onSelectColor,
}: ColorPalettePaneProps) {
  const hasSelection = selectedColor !== null;
  return (
    <section className={styles.renderCard}>
      <div className={styles.paletteBlock}>
        <div className={styles.paletteHead}>
          <strong>Color palette</strong>
          <span className={styles.paletteCount}>{palette.length} colors</span>
        </div>
        <p className={styles.paletteHint}>
          Click a color to highlight its sections in the preview.
        </p>
        <div className={styles.palette}>
          {palette.map((c, i) => {
            const isSelected = selectedColor === i;
            return (
              <button
                key={i}
                type="button"
                className={`${styles.color} ${
                  isSelected ? styles.colorSelected : ""
                } ${hasSelection && !isSelected ? styles.colorDimmed : ""}`}
                style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
                title={`#${i} · rgb(${c[0]}, ${c[1]}, ${c[2]})`}
                aria-pressed={isSelected}
                onClick={() => onSelectColor(i)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      {recipes && palette.length > 0 && (
        <div>
          <button
            type="button"
            className={styles.guideToggle}
            onClick={onToggleGuide}
            aria-expanded={showGuide}
          >
            <span className={styles.guideToggleChevron}>
              {showGuide ? "▾" : "▸"}
            </span>
            See mixing guide ({recipes.length} colors)
          </button>
        </div>
      )}
    </section>
  );
}
