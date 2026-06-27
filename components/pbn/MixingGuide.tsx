import { Fragment } from "react";
import { RGB } from "@/lib/pbn/common";
import { DEFAULT_BASE_PAINTS } from "@/lib/pbn/basePaints";
import type { BasePaint, MixRecipe } from "@/lib/pbn/paintMixing";
import styles from "../PaintByNumbers.module.css";

interface MixingGuideProps {
  recipes: MixRecipe[] | null;
  palette: RGB[];
  guideRef: React.RefObject<HTMLDivElement | null>;
}

export default function MixingGuide({
  recipes,
  palette,
  guideRef,
}: MixingGuideProps) {
  if (!recipes || palette.length === 0) return null;

  const usedPaints: BasePaint[] = [];
  const seen = new Set<string>();
  for (const recipe of recipes) {
    for (const e of recipe.entries) {
      if (!seen.has(e.paint.id)) {
        seen.add(e.paint.id);
        usedPaints.push(e.paint);
      }
    }
  }

  return (
    <div className={styles.guideCard} ref={guideRef}>
      <div className={styles.guideHead}>
        <div className={styles.guideHeader}>
          <div>
            <h3 className={styles.guideTitle}>Color mixing guide</h3>
            <p className={styles.guideSubtitle}>
              {recipes.length} colors and the formulas to create them
            </p>
          </div>
        </div>
        <div className={styles.basePaintsGrid}>
          {(usedPaints.length > 0 ? usedPaints : DEFAULT_BASE_PAINTS).map((p) => (
            <div key={p.id} className={styles.basePaintItem}>
              <span
                className={styles.basePaintSwatch}
                style={{
                  backgroundColor: `rgb(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]})`,
                }}
                title={`${p.nameEn} — nº ${p.codigo} (${p.pigmento}) — ${p.rgb[0]},${p.rgb[1]},${p.rgb[2]}`}
              />
              <span className={styles.basePaintName}>
                {p.nameEn}
                <span className={styles.basePaintCode}>no. {p.codigo}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.guideTableWrap}>
        <table className={styles.guideTable}>
          <thead>
            <tr>
              <th className={styles.guideColNum}>#</th>
              <th className={styles.guideColPreview}>Preview</th>
              <th>
                Mixing formula
                <span className={styles.guideColHint}>(sum of parts)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe, i) => {
              const m = recipe.mixedRgb;
              return (
                <tr key={i}>
                  <td className={styles.guideNum}>{i + 1}</td>
                  <td>
                    <div className={styles.guidePreviewWrapper}>
                      <span
                        className={styles.guidePreview}
                        style={{
                          backgroundColor: `rgb(${m[0]},${m[1]},${m[2]})`,
                        }}
                        title={`Mix: ${m[0]},${m[1]},${m[2]}`}
                      />
                      <span className={styles.guideEquals}>=</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.guideFormula}>
                      {recipe.entries.map((e, j) => (
                        <Fragment key={j}>
                          {j > 0 && <span className={styles.guidePlus}>+</span>}
                          <span className={styles.guideComp}>
                            <span
                              className={styles.guideDot}
                              style={{
                                backgroundColor: `rgb(${e.paint.rgb[0]},${e.paint.rgb[1]},${e.paint.rgb[2]})`,
                              }}
                            />
                            <div className={styles.guideCompInfo}>
                              <span className={styles.guidePct}>
                                {e.parts} {e.parts === 1 ? "part" : "parts"}
                              </span>
                              <span className={styles.guideCompName}>
                                {e.paint.nameEn}
                              </span>
                            </div>
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
