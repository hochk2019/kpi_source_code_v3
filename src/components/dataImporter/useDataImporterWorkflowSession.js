import { useCallback } from "react";

import useDataImporterImportFlow from "@/components/dataImporter/useDataImporterImportFlow.js";
import useDataImporterOverview from "@/components/dataImporter/useDataImporterOverview.js";
import useDataImporterReviewActions from "@/components/dataImporter/useDataImporterReviewActions.js";
import useDataImporterSavedSession from "@/components/dataImporter/useDataImporterSavedSession.js";
import useDataImporterSync from "@/components/dataImporter/useDataImporterSync.js";

export default function useDataImporterWorkflowSession({
  actor = "system",
  canManageSync = false,
  canReviewAlerts = false,
  canUploadFiles = false,
  isReadOnlyForEdits = true,
  isAdminRole = false,
  hasUnsaved = false,
  mode = "source",
  rawRows = [],
  selectedKeys = [],
  selectedFile = "",
  previewSource = null,
  effectivePreviewRows = [],
  importPreview = null,
  canOverwriteData = false,
  overwrite = false,
  autoAssignStaff = true,
  showDeletedRows = false,
  fileRef,
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
  handleRefreshCoDiscrepancy,
  fetchWithAuth,
  refreshDeclRowsFromServer,
  getTeamRoster,
  mapMemberNamesToTeams,
  mapHQAgenciesByMST,
  detectDateOrder,
  mapRow,
  saveDeclRows,
  pushImportLog,
  xlsx,
  xlsxLoader,
  FileReaderCtor,
  toast,
  acceptedImportExtensions,
  maxImportFileSizeBytes,
  maxImportRows,
  ensureEditableKeys,
  keyOfRow,
  markDeclRowsReviewed,
  unmarkDeclRowsReviewed,
  formatDateRangeLabel,
  formatDisplayDate,
  toDateInputValue,
}) {
  const { loadSavedRows } = useDataImporterSavedSession({
    fileRef,
    hasUnsaved,
    mode,
    rawRowsLength: rawRows.length,
    defaultCoFilterMin: 5,
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
  });

  const {
    syncConfig,
    syncForm,
    setSyncForm,
    syncLoading,
    syncRunning,
    syncMessage,
    syncError,
    manualRange,
    setManualRange,
    handleManualRangeChange,
    alertSummary,
    alertEntries,
    alertLoading,
    statusInfo,
    statusLoading,
    statusError,
    previewRows,
    previewLimited,
    previewLoading,
    previewError,
    previewRangeInfo,
    previewRangeLabel,
    mstFilterNotice,
    fetchSyncConfig,
    fetchSyncStatus,
    handleRefreshAlerts: fetchAlerts,
    handleSaveSyncConfig,
    handleRunSync,
    handlePreviewSync: previewSyncRows,
  } = useDataImporterSync({
    actor,
    canManageSync,
    fetchWithAuth,
    refreshDeclRowsFromServer,
    loadSavedRows,
    onAfterSyncSuccess: handleRefreshCoDiscrepancy,
  });

  const { handleFileChange, handleImport } = useDataImporterImportFlow({
    fileRef,
    canUploadFiles,
    isReadOnlyForEdits,
    hasUnsaved,
    mode,
    selectedFile,
    effectivePreviewRows,
    importPreview,
    canOverwriteData,
    overwrite,
    actor,
    isAdminRole,
    autoAssignStaff,
    defaultCoFilterMin: 5,
    loadRules,
    setRules,
    getTeamRoster,
    mapMemberNamesToTeams,
    mapHQAgenciesByMST,
    detectDateOrder,
    mapRow,
    ensureLicenseFields,
    sortDeclRows,
    setRawRows,
     setPage,
     setMode,
     setSelectedFile,
     setPreviewSource,
     setSyncPreviewMeta,
     setQuery,
    setFilterNoStaff,
    setFilterNoTeam,
    setCoFilterMode,
    setCoFilterMin,
    setSelectedKeys,
    setHasUnsaved,
    saveDeclRows,
    pushImportLog,
    loadSavedRows,
    fetchAlerts,
    xlsx,
    xlsxLoader,
    FileReaderCtor,
    toast,
    acceptedImportExtensions,
    maxImportFileSizeBytes,
    maxImportRows,
  });

  const handlePreviewSync = useCallback(async () => {
    const preview = await previewSyncRows();

    if (!preview?.ok) {
      return preview;
    }

    const normalizedRows = sortDeclRows(
      (Array.isArray(preview.rows) ? preview.rows : [])
        .map(ensureLicenseFields)
        .map(ensureCOFields),
    );

    if (!normalizedRows.length) {
      if (previewSource === "sync" || mode === "preview") {
        loadSavedRows({ bypassConfirm: true });
      }

      return { ...preview, rows: normalizedRows };
    }

    setRawRows(normalizedRows);
    setPage(1);
    setMode("preview");
    setSelectedFile("");
    setPreviewSource?.("sync");
    setSyncPreviewMeta?.({
      fetched: Number.isFinite(Number(preview?.fetched)) ? Number(preview.fetched) : normalizedRows.length,
    });
    setQuery("");
    setFilterNoStaff(false);
    setFilterNoTeam(false);
    setFilterDuplicate11(false);
    setCoFilterMode("all");
    setCoFilterMin(5);
    setSelectedKeys([]);
    setHasUnsaved(false);

    return { ...preview, rows: normalizedRows };
  }, [
    ensureCOFields,
    ensureLicenseFields,
    loadSavedRows,
    mode,
    previewSource,
    previewSyncRows,
    setCoFilterMin,
    setCoFilterMode,
    setFilterDuplicate11,
    setFilterNoStaff,
    setFilterNoTeam,
    setHasUnsaved,
    setMode,
    setPage,
    setPreviewSource,
    setSyncPreviewMeta,
    setQuery,
    setRawRows,
    setSelectedFile,
    setSelectedKeys,
    sortDeclRows,
  ]);

  const applyRangePreset = useCallback((days) => {
    const totalDays = Math.max(0, Number(days) || 0);
    const end = new Date();
    const start = new Date(end.getTime() - totalDays * 24 * 60 * 60 * 1000);

    setManualRange({
      from: toDateInputValue(start),
      to: toDateInputValue(end),
    });
  }, [setManualRange, toDateInputValue]);

  const {
    handleRefreshAlerts,
    handleMarkReviewed,
    handleUnmarkReviewed,
  } = useDataImporterReviewActions({
    actor,
    canReviewAlerts,
    mode,
    selectedKeys,
    rawRows,
    ensureEditableKeys,
    keyOfRow,
    markDeclRowsReviewed,
    unmarkDeclRowsReviewed,
    fetchWithAuth,
    setSelectedKeys,
    setHasUnsaved,
    loadSavedRows,
    fetchAlerts,
  });

  const {
    outstandingAlerts,
    summaryCards,
    lastAlertEvaluated,
    syncLastRunLabel,
    lastSyncSummary,
    lastSyncRangeLabel,
    lastSyncRunAtLabel,
  } = useDataImporterOverview({
    rawRows,
    mode,
    showDeletedRows,
    alertSummary,
    alertEntries,
    syncConfig,
    formatDateRangeLabel,
    formatDisplayDate,
  });

  return {
    loadSavedRows,
    syncConfig,
    syncForm,
    setSyncForm,
    syncLoading,
    syncRunning,
    syncMessage,
    syncError,
    manualRange,
    setManualRange,
    handleManualRangeChange,
    alertSummary,
    alertEntries,
    alertLoading,
    statusInfo,
    statusLoading,
    statusError,
    previewRows,
    previewLimited,
    previewLoading,
    previewError,
    previewRangeInfo,
    previewRangeLabel,
    mstFilterNotice,
    fetchSyncConfig,
    fetchSyncStatus,
    fetchAlerts,
    handleSaveSyncConfig,
    handleRunSync,
    handlePreviewSync,
    handleFileChange,
    handleImport,
    applyRangePreset,
    handleRefreshAlerts,
    handleMarkReviewed,
    handleUnmarkReviewed,
    outstandingAlerts,
    summaryCards,
    lastAlertEvaluated,
    syncLastRunLabel,
    lastSyncSummary,
    lastSyncRangeLabel,
    lastSyncRunAtLabel,
  };
}
