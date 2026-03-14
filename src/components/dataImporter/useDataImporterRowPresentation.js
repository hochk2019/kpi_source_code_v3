import { useCallback } from "react";

export default function useDataImporterRowPresentation({
  isReadOnlyForEdits = false,
  editingRestrictionMessage = "",
  reviewLockMessage = "",
  isRowEditable,
  isRowReviewLocked,
  keyOfRow,
  normalizeStr,
  rowDiffMap,
  rowSaveStatus,
  rowHistoryEntries,
  rowHistoryExpanded,
  applyEdit,
  coLineCount,
  coLabel,
  computeKPI,
  rules,
}) {
  const buildRowState = useCallback(
    (row, index = 0) => {
      const rowKey = keyOfRow(row);
      const rowReviewLocked = isRowReviewLocked(row);
      const rowDeleted = !!(row && row.deleted_at);
      const rowDeletedAt = rowDeleted ? row.deleted_at : null;
      const rowDeletedBy = rowDeleted ? normalizeStr(row.deleted_by || "") : "";
      const rowEditable = !rowDeleted && isRowEditable(row);
      const rowReadOnly = isReadOnlyForEdits || !rowEditable;
      const rowReadOnlyReason = rowDeleted
        ? rowDeletedBy
          ? `Đã xóa bởi ${rowDeletedBy}`
          : "Đã xóa mềm"
        : rowReviewLocked
          ? reviewLockMessage
          : rowReadOnly && editingRestrictionMessage
            ? editingRestrictionMessage
            : rowReadOnly && isReadOnlyForEdits
              ? "Chỉ xem"
              : "";
      const rowDiff = rowDiffMap.get(rowKey);
      const hasPendingDiff = !!(rowDiff && Object.keys(rowDiff).length > 0);
      const currentSaveState = rowSaveStatus[rowKey] || { saving: false, error: "" };
      const historyList = rowHistoryEntries[rowKey] || [];
      const historyExpanded = !!rowHistoryExpanded[rowKey];

      return {
        index,
        row,
        rowKey,
        rowEditable,
        rowReadOnly,
        rowReviewLocked,
        rowDeleted,
        rowDeletedAt,
        rowDeletedBy,
        rowReadOnlyReason,
        rowDiff,
        hasPendingDiff,
        canSaveRow: hasPendingDiff && !rowReadOnly,
        rowSaving: currentSaveState.saving,
        rowError: currentSaveState.error || "",
        historyList,
        historyExpanded,
        historyCount: Array.isArray(historyList) ? historyList.length : 0,
      };
    },
    [
      editingRestrictionMessage,
      isReadOnlyForEdits,
      isRowEditable,
      isRowReviewLocked,
      keyOfRow,
      normalizeStr,
      reviewLockMessage,
      rowDiffMap,
      rowHistoryEntries,
      rowHistoryExpanded,
      rowSaveStatus,
    ]
  );

  const handleCardLicenseCountChange = useCallback(
    (rowKey, input) => {
      if (input === "") {
        applyEdit(rowKey, () => ({ licenses: "", so_luong_gp: "", licenseManualCount: null }));
        return;
      }

      const parsed = Number(input);
      if (!Number.isFinite(parsed)) {
        return;
      }

      const normalized = Math.max(0, Math.round(parsed));
      applyEdit(rowKey, () => ({
        licenses: normalized,
        so_luong_gp: normalized,
        licenseManualCount: normalized,
      }));
    },
    [applyEdit]
  );

  const getCardCoDisplay = useCallback(
    (row) => {
      const lines = coLineCount(row);
      const status = coLabel(row);
      return lines > 0 ? String(lines) : status || "—";
    },
    [coLabel, coLineCount]
  );

  const getCardKpiDisplay = useCallback(
    (row) => {
      const kpi = computeKPI(row, rules);
      if (!Number.isFinite(kpi)) {
        return "-";
      }

      return kpi.toFixed(1);
    },
    [computeKPI, rules]
  );

  return {
    buildRowState,
    handleCardLicenseCountChange,
    getCardCoDisplay,
    getCardKpiDisplay,
  };
}
