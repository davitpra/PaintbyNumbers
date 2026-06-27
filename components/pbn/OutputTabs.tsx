import { OutputTab } from "@/lib/pbn/guiprocessmanager";
import { OUTPUT_TABS } from "./constants";
import styles from "../PaintByNumbers.module.css";

interface OutputTabsProps {
  outputTab: OutputTab | "log";
  onSelect: (tab: OutputTab | "log") => void;
}

export default function OutputTabs({ outputTab, onSelect }: OutputTabsProps) {
  return (
    <div className={styles.tabs}>
      {OUTPUT_TABS.map((t) => (
        <button
          key={t.key}
          className={outputTab === t.key ? styles.tabActive : styles.tab}
          onClick={() => onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
      <button
        className={outputTab === "log" ? styles.tabActive : styles.tab}
        onClick={() => onSelect("log")}
      >
        Log
      </button>
    </div>
  );
}
