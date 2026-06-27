import { OverallStatus } from "./constants";
import styles from "../PaintByNumbers.module.css";

export default function ProgressBar({ overall }: { overall: OverallStatus }) {
  if (overall.state === "idle") return null;
  return (
    <div className={styles.progressWrapper}>
      <div className={styles.progressHeader}>
        <span>{overall.label}</span>
        <span>{Math.round(overall.progress * 100)}%</span>
      </div>
      <div className={styles.progress}>
        <div
          className={`${styles.determinate} ${
            overall.state === "complete" ? styles.complete : ""
          }`}
          style={{ width: Math.round(overall.progress * 100) + "%" }}
        />
      </div>
    </div>
  );
}
