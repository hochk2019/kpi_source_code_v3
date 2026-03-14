import { useCallback } from "react";

export default function useDataImporterSavedEdits({
  isReadOnlyForEdits = false,
  mode = "source",
  actor = "system",
  isAdminRole = false,
  rowDiffMap = new Map(),
  reviewLockMessage = "",
  keyOfRow,
  ensureLicenseFields,
  ensureCOFields,
  saveDeclRowDiffs,
  updateDeclRowFields,
  setHasUnsaved,
  loadSavedRows,
  fetchAlerts,
  setRowSaveStatus,
  setRawRows,
  commitRowToBaseline,
  refreshRowHistory,
  toast,
}) {
  const handleSaveAll = useCallback(async () => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền lưu chỉnh sửa.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ có thể lưu chỉnh sửa khi đang xem dữ liệu đã lưu. Hãy import file hoặc quay lại chế độ dữ liệu đã lưu.");
      return;
    }

    const pendingUpdates = [];
    rowDiffMap.forEach((diff, key) => {
      if (!diff || typeof diff !== "object") {
        return;
      }

      const fields = Object.keys(diff);
      if (fields.length === 0) {
        return;
      }

      pendingUpdates.push({ key, updates: diff });
    });

    if (pendingUpdates.length === 0) {
      alert("Không có thay đổi nào cần lưu.");
      return;
    }

    try {
      const result = await saveDeclRowDiffs(pendingUpdates, {
        actor,
        detail: "Lưu chỉnh sửa tờ khai thủ công",
        allowReviewedOverride: isAdminRole,
      });

      const parts = [];
      if (result.updated > 0) {
        parts.push(`Đã cập nhật ${result.updated.toLocaleString("vi-VN")} tờ khai.`);
      } else {
        parts.push("Không có tờ khai nào được cập nhật.");
      }

      if (result.locked > 0) {
        parts.push(`${result.locked.toLocaleString("vi-VN")} tờ khai bị khoá rà soát.`);
      }

      if (result.missing > 0) {
        parts.push(`${result.missing.toLocaleString("vi-VN")} tờ khai không tìm thấy.`);
      }

      if (result.noChange > 0) {
        parts.push(`${result.noChange.toLocaleString("vi-VN")} tờ khai không có thay đổi mới.`);
      }

      if (result.invalid > 0) {
        parts.push(`${result.invalid.toLocaleString("vi-VN")} bản ghi không hợp lệ.`);
      }

      alert(parts.join(" "));

      if (result.success && result.updated > 0) {
        setHasUnsaved(false);
        loadSavedRows?.({ bypassConfirm: true });
        fetchAlerts?.();
      }
    } catch (error) {
      console.error("Không thể lưu cập nhật hàng loạt", error);
      toast?.error?.(error?.message || "Không thể lưu cập nhật hàng loạt. Vui lòng thử lại.");
    }
  }, [
    actor,
    fetchAlerts,
    isAdminRole,
    isReadOnlyForEdits,
    loadSavedRows,
    mode,
    rowDiffMap,
    saveDeclRowDiffs,
    setHasUnsaved,
    toast,
  ]);

  const handleSaveRowChanges = useCallback((rowKey) => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền lưu chỉnh sửa.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ có thể cập nhật khi đang xem dữ liệu đã lưu.");
      return;
    }

    const diff = rowDiffMap.get(rowKey);
    if (!diff || Object.keys(diff).length === 0) {
      toast?.info?.("Không có thay đổi nào cần lưu cho tờ khai này.");
      return;
    }

    setRowSaveStatus((prev) => ({
      ...prev,
      [rowKey]: { saving: true, error: "" },
    }));

    try {
      const fieldList = Object.keys(diff);
      const result = updateDeclRowFields(rowKey, diff, {
        actor,
        detail: `Cập nhật thủ công (${fieldList.join(", ")}) qua Import Data`,
        allowReviewedOverride: isAdminRole,
      });

      if (!result?.success) {
        const reason = result?.reason;
        const isReviewLockedReason = reason === "review-locked";
        const errorMessage = isReviewLockedReason
          ? reviewLockMessage
          : reason === "not-found"
            ? "Tờ khai đã bị xóa hoặc thay đổi. Vui lòng tải lại dữ liệu."
            : reason === "no-change"
              ? "Không có thay đổi mới để lưu."
              : "Không thể cập nhật tờ khai. Hãy thử lại.";

        setRowSaveStatus((prev) => ({
          ...prev,
          [rowKey]: { saving: false, error: errorMessage },
        }));

        if (isReviewLockedReason) {
          toast?.warning?.(errorMessage);
        } else {
          toast?.error?.(errorMessage);
        }
        return;
      }

      const normalizedRow = ensureCOFields(ensureLicenseFields(result.row || {}));
      setRawRows((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;

        const index = prev.findIndex((row) => keyOfRow(row) === rowKey);
        if (index === -1) return prev;

        const next = prev.slice();
        next[index] = { ...prev[index], ...normalizedRow };
        return next;
      });

      commitRowToBaseline?.(rowKey, normalizedRow);
      setRowSaveStatus((prev) => ({
        ...prev,
        [rowKey]: { saving: false, error: "" },
      }));
      refreshRowHistory(rowKey);
      toast?.success?.("Đã lưu cập nhật cho tờ khai.");
    } catch (error) {
      console.error("Không thể cập nhật tờ khai", error);
      const fallbackMessage = "Có lỗi xảy ra khi cập nhật. Vui lòng thử lại.";
      setRowSaveStatus((prev) => ({
        ...prev,
        [rowKey]: { saving: false, error: fallbackMessage },
      }));
      toast?.error?.(fallbackMessage);
    }
  }, [
    actor,
    ensureCOFields,
    ensureLicenseFields,
    isAdminRole,
    isReadOnlyForEdits,
    keyOfRow,
    mode,
    refreshRowHistory,
    reviewLockMessage,
    rowDiffMap,
    commitRowToBaseline,
    setRawRows,
    setRowSaveStatus,
    toast,
    updateDeclRowFields,
  ]);

  return {
    handleSaveAll,
    handleSaveRowChanges,
  };
}
