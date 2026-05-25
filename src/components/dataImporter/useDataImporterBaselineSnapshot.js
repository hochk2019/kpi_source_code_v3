import { useCallback, useMemo, useRef, useState } from "react";

import { collectEditableDiff } from "@/components/dataImporter/dataImporterRowUtils.js";

export default function useDataImporterBaselineSnapshot({
  mode = "source",
  rawRows = [],
  keyOfRow,
}) {
  const savedRowSnapshotRef = useRef(new Map());
  const [baselineSnapshot, setBaselineSnapshot] = useState(() => new Map());
  const [baselineVersion, setBaselineVersion] = useState(0);

  const updateBaselineSnapshot = useCallback(
    (rows) => {
      const snapshot = new Map();

      if (Array.isArray(rows)) {
        for (const row of rows) {
          const rowKey = keyOfRow?.(row);
          if (!rowKey) continue;
          snapshot.set(rowKey, { ...row });
        }
      }

      savedRowSnapshotRef.current = snapshot;
      setBaselineSnapshot(snapshot);
      setBaselineVersion((prev) => prev + 1);
    },
    [keyOfRow]
  );

  const commitRowToBaseline = useCallback((rowKey, row) => {
    if (!rowKey || !row || typeof row !== "object") {
      return false;
    }

    const nextSnapshot = new Map(savedRowSnapshotRef.current || new Map());
    nextSnapshot.set(rowKey, { ...row });
    savedRowSnapshotRef.current = nextSnapshot;
    setBaselineSnapshot(nextSnapshot);
    setBaselineVersion((prev) => prev + 1);
    return true;
  }, []);

  const rowDiffMap = useMemo(() => {
    if (mode !== "saved") {
      return new Map();
    }

    const baseline = baselineSnapshot || new Map();
    const diffMap = new Map();

    for (const row of rawRows) {
      const rowKey = keyOfRow?.(row);
      if (!rowKey) continue;

      const baselineRow = baseline.get(rowKey);
      if (!baselineRow) continue;

      const diff = collectEditableDiff(baselineRow, row);
      if (diff) {
        diffMap.set(rowKey, diff);
      }
    }

    return diffMap;
  }, [baselineSnapshot, keyOfRow, mode, rawRows]);

  return {
    savedRowSnapshotRef,
    baselineVersion,
    rowDiffMap,
    updateBaselineSnapshot,
    commitRowToBaseline,
  };
}
