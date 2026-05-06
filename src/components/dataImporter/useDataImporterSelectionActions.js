import { useCallback, useMemo } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

export default function useDataImporterSelectionActions({
  selectionEnabled,
  filteredKeys,
  selectedKeys,
  rawRows,
  keyOfRow,
  setSelectedKeys,
  setPage,
  isReadOnlyForEdits,
  isRowEditable,
  isRowReviewLocked,
  reviewLockMessage,
  editingRestrictionMessage,
  toast,
}) {
  const { alert } = useAppDialog();

  const filteredSelected = useMemo(() => {
    if (!filteredKeys.length) return false;
    if (!selectedKeys.length) return false;
    const selectedSet = new Set(selectedKeys);
    return filteredKeys.every((key) => selectedSet.has(key));
  }, [filteredKeys, selectedKeys]);

  const selectedReviewedCount = useMemo(() => {
    if (!selectedKeys.length) return 0;
    const keySet = new Set(selectedKeys);
    let count = 0;
    for (const row of rawRows) {
      if (!row || typeof row !== "object") continue;
      if (!keySet.has(keyOfRow(row))) continue;
      if (row.reviewed) count += 1;
    }
    return count;
  }, [selectedKeys, rawRows, keyOfRow]);

  const handleToggleSelect = useCallback(
    async (row) => {
      if (isReadOnlyForEdits) {
        return;
      }
      if (!isRowEditable(row)) {
        if (isRowReviewLocked(row)) {
          toast.warning(reviewLockMessage);
        } else if (editingRestrictionMessage) {
          await alert(editingRestrictionMessage);
        }
        return;
      }

      const key = keyOfRow(row);
      setSelectedKeys((prev) => {
        if (prev.includes(key)) {
          return prev.filter((item) => item !== key);
        }
        return [...prev, key];
      });
    },
    [
      editingRestrictionMessage,
      isReadOnlyForEdits,
      isRowEditable,
      isRowReviewLocked,
      keyOfRow,
      reviewLockMessage,
      setSelectedKeys,
      toast,
    ]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedKeys([]);
  }, [setSelectedKeys]);

  const handleSelectFiltered = useCallback(async () => {
    if (!selectionEnabled) {
      await alert("Chỉ có thể chọn tờ khai khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (!filteredKeys.length) {
      await alert("Không có tờ khai phù hợp với điều kiện lọc hiện tại.");
      return;
    }

    setSelectedKeys(filteredKeys);
    setPage(1);
  }, [filteredKeys, selectionEnabled, setPage, setSelectedKeys]);

  return {
    filteredSelected,
    selectedReviewedCount,
    handleToggleSelect,
    handleClearSelection,
    handleSelectFiltered,
  };
}
