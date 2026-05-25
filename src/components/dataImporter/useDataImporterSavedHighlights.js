import { useCallback, useMemo } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

export default function useDataImporterSavedHighlights({
  lastSyncSummary,
  mode = "saved",
  coMismatchKeySet,
  hasDuplicate11Rows = false,
  setSelectedKeys,
  setPage,
  setFilterDuplicate11,
}) {
  const { alert } = useAppDialog();
  const lastSyncFetched = lastSyncSummary?.rowsFetched ?? 0;
  const lastSyncInserted = lastSyncSummary?.rowsInserted ?? lastSyncSummary?.rowsImported ?? 0;
  const lastSyncUpdated = lastSyncSummary?.rowsUpdated ?? 0;
  const lastSyncSkipped = lastSyncSummary?.rowsSkipped ?? 0;
  const lastSyncTotal = lastSyncSummary?.totalStored ?? 0;

  const updatedDeclarations = useMemo(
    () => (Array.isArray(lastSyncSummary?.updatedDeclarations) ? lastSyncSummary.updatedDeclarations : []),
    [lastSyncSummary?.updatedDeclarations]
  );

  const updatedKeys = useMemo(
    () => (Array.isArray(lastSyncSummary?.updatedKeys) ? lastSyncSummary.updatedKeys : []),
    [lastSyncSummary?.updatedKeys]
  );

  const updatedKeySet = useMemo(() => new Set(updatedKeys), [updatedKeys]);
  const updatedPreview = useMemo(() => updatedDeclarations.slice(0, 10), [updatedDeclarations]);
  const showUpdatedBanner = lastSyncUpdated > 0 || updatedDeclarations.length > 0;

  const handleSelectUpdated = useCallback(async () => {
    if (mode !== "saved") {
      await alert("Chi co the chon khi dang xem du lieu da luu.");
      return;
    }
    if (!updatedKeySet.size) {
      return;
    }
    setSelectedKeys(Array.from(updatedKeySet));
    setPage(1);
  }, [alert, mode, setPage, setSelectedKeys, updatedKeySet]);

  const handleSelectCoMismatches = useCallback(async () => {
    if (mode !== "saved") {
      await alert("Chi co the chon khi dang xem du lieu da luu.");
      return;
    }
    if (!coMismatchKeySet.size) {
      return;
    }
    setSelectedKeys(Array.from(coMismatchKeySet));
    setPage(1);
  }, [alert, coMismatchKeySet, mode, setPage, setSelectedKeys]);

  const handleToggleDuplicateFilter = useCallback(async () => {
    if (mode !== "saved") {
      await alert("Chi co the loc khi dang xem du lieu da luu.");
      return;
    }
    if (!hasDuplicate11Rows) {
      await alert("Không có tờ khai trùng 11 số đầu để lọc.");
      return;
    }
    setFilterDuplicate11((prev) => !prev);
    setPage(1);
  }, [alert, hasDuplicate11Rows, mode, setFilterDuplicate11, setPage]);

  return {
    lastSyncFetched,
    lastSyncInserted,
    lastSyncUpdated,
    lastSyncSkipped,
    lastSyncTotal,
    updatedDeclarations,
    updatedKeys,
    updatedKeySet,
    updatedPreview,
    showUpdatedBanner,
    handleSelectUpdated,
    handleSelectCoMismatches,
    handleToggleDuplicateFilter,
  };
}
