import { ExportControls as ExportControlsState } from "./useExport";
import styles from "../PaintByNumbers.module.css";

interface ExportControlsProps {
  exp: ExportControlsState;
  hasOutput: boolean;
}

export default function ExportControls({ exp, hasOutput }: ExportControlsProps) {
  if (!hasOutput) return null;
  return (
    <>
      <div className={styles.optionRow}>
        <button className={styles.btn} onClick={exp.handleDownloadSVG}>
          Download SVG
        </button>
        <button className={styles.btn} onClick={exp.handleDownloadPNG}>
          Download PNG
        </button>
        <button className={styles.btn} onClick={exp.handleDownloadPalette}>
          Download palette
        </button>
      </div>
      <div className={styles.optionRow}>
        <label>
          Unit
          <select
            value={exp.pdfUnit}
            onChange={(e) => exp.onPdfUnitChange(e.target.value as "cm" | "in")}
          >
            <option value="cm">cm</option>
            <option value="in">inches</option>
          </select>
        </label>
        <label>
          Width ({exp.pdfUnit})
          <input
            type="number"
            min={1}
            step={0.1}
            value={exp.pdfWidth}
            onChange={(e) => exp.onPdfWidthChange(parseFloat(e.target.value) || 0)}
          />
        </label>
        <label>
          Height ({exp.pdfUnit})
          <input
            type="number"
            min={1}
            step={0.1}
            value={exp.pdfHeight}
            onChange={(e) =>
              exp.onPdfHeightChange(parseFloat(e.target.value) || 0)
            }
          />
        </label>
        <button className={styles.btn} onClick={exp.handleDownloadPDF}>
          Download PDF
        </button>
      </div>
      <div className={styles.optionRow}>
        <label>
          Paper size
          <select
            value={exp.paperFormat}
            onChange={(e) =>
              exp.setPaperFormat(e.target.value as typeof exp.paperFormat)
            }
          >
            <option value="a3">A3</option>
            <option value="a4">A4</option>
            <option value="a5">A5</option>
            <option value="letter">Letter</option>
            <option value="legal">Legal</option>
            <option value="tabloid">Tabloid</option>
          </select>
        </label>
        <label>
          Orientation
          <select
            value={exp.paperOrientation}
            onChange={(e) =>
              exp.setPaperOrientation(
                e.target.value as typeof exp.paperOrientation,
              )
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <button
          className={styles.btn}
          onClick={() => void exp.handleDownloadPDFStandard()}
        >
          Select area &amp; download PDF
        </button>
      </div>
    </>
  );
}
