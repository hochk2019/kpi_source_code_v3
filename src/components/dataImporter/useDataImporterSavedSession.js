import { useCallback, useEffect } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

export default function useDataImporterSavedSession({
  fileRef,
  hasUnsaved = false,
  mode = "source",
  rawRowsLength = 0,
  defaultCoFilterMin = 5,
  loadRules,
  getDeclRows,
  sortDeclRows,
  ensureLicenseFields,
  ensureCOFields,
  updateBaselineSnapshot,
  setRules,
  setRawRows,
  setRowSaveStatus,
  setRowHistoryExpanded,
  setRowHistoryEntries,
  setMode,
  setPage,
  setQuery,
  setSelectedFile,
  setPreviewSource,
  setSyncPreviewMeta,
  setFilterNoStaff,
  setFilterNoTeam,
  setFilterDuplicate11,
  setCoFilterMode,
  setCoFilterMin,
  setSelectedKeys,
  setHasUnsaved,
}) {
  const { confirm } = useAppDialog();

  const loadSavedRows = useCallback(async (opts = {}) => {
    const { bypassConfirm = false } = opts;

    if (!bypassConfirm && hasUnsaved && mode === "saved") {
      const shouldDiscard = await confirm(
        "Bạn có các thay đổi chưa lưu. Tiếp tục sẽ bỏ qua các chỉnh sửa đó. Bạn có muốn tiếp tục?"
      );

      if (!shouldDiscard) {
        if (fileRef.current) fileRef.current.value = "";
        return false;
      }
    }

    const activeRules = loadRules();
    setRules(activeRules);

    const saved = sortDeclRows(getDeclRows()).map(ensureLicenseFields).map(ensureCOFields);

    setRawRows(saved);
    updateBaselineSnapshot(saved);
    setRowSaveStatus({});
    setRowHistoryExpanded({});
    setRowHistoryEntries({});
    setMode("saved");
    setPage(1);
    setQuery("");
    setSelectedFile("");
    setPreviewSource?.(null);
    setSyncPreviewMeta?.(null);
    setFilterNoStaff(false);
    setFilterNoTeam(false);
    setFilterDuplicate11(false);
    setCoFilterMode("all");
    setCoFilterMin(defaultCoFilterMin);
    setSelectedKeys([]);
    setHasUnsaved(false);

    if (fileRef.current) fileRef.current.value = "";
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    defaultCoFilterMin,
    ensureCOFields,
    ensureLicenseFields,
    fileRef,
    getDeclRows,
    hasUnsaved,
    loadRules,
    mode,
    setCoFilterMin,
    setCoFilterMode,
    setFilterDuplicate11,
    setFilterNoStaff,
    setFilterNoTeam,
    setHasUnsaved,
    setMode,
    setPage,
    setQuery,
    setRawRows,
    setRowHistoryEntries,
    setRowHistoryExpanded,
    setRowSaveStatus,
    setRules,
    setSelectedFile,
    setPreviewSource,
    setSyncPreviewMeta,
    setSelectedKeys,
    sortDeclRows,
    updateBaselineSnapshot,
  ]);

  useEffect(() => {
    if (mode !== "saved") return;
    if (hasUnsaved) return;
    if (rawRowsLength > 0) return;
    loadSavedRows({ bypassConfirm: true });
  }, [hasUnsaved, loadSavedRows, mode, rawRowsLength]);

  useEffect(() => {
    if (mode !== "saved") {
      setFilterDuplicate11(false);
    }
  }, [mode, setFilterDuplicate11]);

  useEffect(() => {
    if (!hasUnsaved) return undefined;

    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  return {
    loadSavedRows,
  };
}
