import { useCallback, useState } from "react";

export default function useDataImporterRowHistory({
  getDeclHistoryForRow,
  historyEntryLimit,
}) {
  const [rowHistoryExpanded, setRowHistoryExpanded] = useState({});
  const [rowHistoryEntries, setRowHistoryEntries] = useState({});

  const refreshRowHistory = useCallback(
    (rowKey) => {
      const key = typeof rowKey === "string" ? rowKey.trim() : String(rowKey || "").trim();
      if (!key) {
        return;
      }

      const entries = getDeclHistoryForRow(key, historyEntryLimit) || [];
      setRowHistoryEntries((prev) => ({
        ...prev,
        [key]: entries,
      }));
    },
    [getDeclHistoryForRow, historyEntryLimit]
  );

  const handleToggleHistory = useCallback(
    (rowKey) => {
      const key = typeof rowKey === "string" ? rowKey.trim() : String(rowKey || "").trim();
      if (!key) {
        return;
      }

      setRowHistoryExpanded((prev) => {
        const nextExpanded = !prev[key];
        const nextState = { ...prev, [key]: nextExpanded };
        if (nextExpanded) {
          refreshRowHistory(key);
        }
        return nextState;
      });
    },
    [refreshRowHistory]
  );

  return {
    rowHistoryExpanded,
    rowHistoryEntries,
    setRowHistoryExpanded,
    setRowHistoryEntries,
    refreshRowHistory,
    handleToggleHistory,
  };
}
