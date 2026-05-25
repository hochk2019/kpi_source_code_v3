import { useCallback } from "react";

export default function useDataImporterRowEditing({
  isReadOnlyForEdits = false,
  mode = "source",
  rules,
  editingRestrictionMessage = "",
  isRowEditable,
  blockedEditNoticeRef,
  keyOfRow,
  sanitizeRowUpdates,
  shouldUseServerSearch = false,
  setServerSearchState,
  setHasUnsaved,
  setSelectedKeys,
  setRawRows,
  computeKPI,
}) {
  const applyEdit = useCallback((rowKey, updater) => {
    if (isReadOnlyForEdits) return;

    let didChange = false;
    let pendingSelectionUpdater = null;
    let updatedRowSnapshot = null;
    let updatedOldKey = null;
    let updatedNewKey = null;

    setRawRows((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      const pos = prev.findIndex((row) => keyOfRow(row) === rowKey);
      if (pos === -1) return prev;

      const current = prev[pos];
      if (!isRowEditable(current)) {
        if (editingRestrictionMessage && !blockedEditNoticeRef.current.has(rowKey)) {
          blockedEditNoticeRef.current.add(rowKey);
          alert(editingRestrictionMessage);
        }
        return prev;
      }

      const updates = sanitizeRowUpdates(current, updater(current));
      if (!updates || typeof updates !== "object") return prev;

      let changed = false;
      const nextRow = { ...current };
      for (const [key, value] of Object.entries(updates)) {
        if (nextRow[key] !== value) {
          nextRow[key] = value;
          changed = true;
        }
      }

      if (!changed) return prev;

      nextRow.updatedAt = new Date().toISOString();
      const recalculated = computeKPI(nextRow, rules);
      if (Number.isFinite(recalculated)) {
        nextRow.kpi = Math.round(recalculated * 10) / 10;
      }

      const copy = prev.slice();
      copy[pos] = nextRow;

      const oldKey = keyOfRow(current);
      const newKey = keyOfRow(nextRow);
      updatedRowSnapshot = nextRow;
      updatedOldKey = oldKey;
      updatedNewKey = newKey;

      if (oldKey !== newKey) {
        pendingSelectionUpdater = (keys) => {
          if (!Array.isArray(keys) || keys.length === 0) return keys;
          if (!keys.includes(oldKey)) return keys;
          return keys.filter((key) => key !== oldKey);
        };
      }

      didChange = true;
      return copy;
    });

    if (pendingSelectionUpdater) {
      setSelectedKeys?.(pendingSelectionUpdater);
    }

    if (didChange && mode === "saved") {
      if (shouldUseServerSearch && updatedRowSnapshot) {
        const matchKeys = new Set(
          [rowKey, updatedOldKey, updatedNewKey].filter(
            (value) => typeof value === "string" && value
          )
        );

        setServerSearchState?.((prev) => {
          if (!Array.isArray(prev.rows) || prev.rows.length === 0) {
            return prev;
          }

          let changed = false;
          const rows = prev.rows.map((row) => {
            const key = keyOfRow(row);
            if (!matchKeys.has(key)) {
              return row;
            }

            changed = true;
            return { ...row, ...updatedRowSnapshot };
          });

          if (!changed) {
            return prev;
          }

          return {
            ...prev,
            rows,
          };
        });
      }

      setHasUnsaved?.(true);
    }
  }, [
    blockedEditNoticeRef,
    computeKPI,
    editingRestrictionMessage,
    isReadOnlyForEdits,
    isRowEditable,
    keyOfRow,
    mode,
    rules,
    sanitizeRowUpdates,
    setHasUnsaved,
    setRawRows,
    setSelectedKeys,
    setServerSearchState,
    shouldUseServerSearch,
  ]);

  return {
    applyEdit,
  };
}
