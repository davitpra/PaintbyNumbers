import { useCallback, useState } from "react";

export function useLog() {
  const [logLines, setLogLines] = useState<string[]>([]);

  const log = useCallback((msg: string) => {
    setLogLines((prev) => [...prev, msg]);
  }, []);

  const clearLog = useCallback(() => setLogLines([]), []);

  return { logLines, log, clearLog };
}
