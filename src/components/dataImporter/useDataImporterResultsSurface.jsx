import { useEffect } from "react";
import * as XLSX from "xlsx";

import {
  hardDeleteDeclRows,
  normalizeName,
  normalizeStr,
  restoreDeclRows,
  saveDeclRowDiffs,
  softDeleteDeclRows,
  updateDeclRowFields,
} from "@/lib/store.js";
import { computeKPI, extractLicenseCodesFromRowObj } from "@/lib/rules.js";
import { fetchWithAuth } from "@/auth/localAuth.js";
import DataImporterLastSyncSummaryCard from "@/components/dataImporter/DataImporterLastSyncSummaryCard.jsx";
import useDataImporterLicenseExclusions from "@/components/dataImporter/useDataImporterLicenseExclusions.js";
import useDataImporterResultRows from "@/components/dataImporter/useDataImporterResultRows.js";
import useDataImporterResultsController from "@/components/dataImporter/useDataImporterResultsController.js";
import useDataImporterSavedEdits from "@/components/dataImporter/useDataImporterSavedEdits.js";
import {
  DEFAULT_PAGE_SIZE,
  SERVER_SEARCH_MAX_PAGE_SIZE,
} from "@/components/dataImporter/dataImporterConfig.js";
import {
  ensureCOFields,
  ensureLicenseFields,
  extractAgencyKeys,
  normalizeAgencyKey,
  normalizeLicenseCode,
} from "@/components/dataImporter/dataImporterLicenseUtils.js";
import useTooltipTitles from "@/hooks/useTooltipTitles.js";
import { filterDeclRows } from "../../../packages/domain/src/declSearch.js";
import { computeLicenseSnapshot } from "../../../shared/licenseSummary.js";
import { toast } from "@/shared/toast.js";

export default function useDataImporterResultsSurface({
  actor,
  agencyOptions,
  blockedEditNoticeRef,
  canAutoReconcile,
  canEdit,
  canManageAlerts,
  canReviewAlerts,
  cardGridColumns,
  coCodeConfig,
  coDiscrepancyForm,
  coDiscrepancyState,
  coMismatchKeySet,
  columnHiddenSet,
  columnWidths,
  commitRowToBaseline,
  containerWidth,
  duplicate11DuplicatesSet,
  duplicate11KeeperSet,
  duplicate11Summary,
  editingRestrictionMessage,
  ensureEditableKeys,
  ensureHardDeleteKeys,
  fetchAlerts,
  filterEditableKeys,
  filterHardDeleteKeys,
  freezeColumnsEnabled,
  getLicenseExcludeSetForRow,
  handleMarkReviewed,
  handleToggleHistory,
  handleUnmarkReviewed,
  isAdminRole,
  isReadOnlyForEdits,
  isRowEditable,
  isRowReviewLocked,
  keyOfRow,
  licenseAgencyExcludeMap,
  licenseExcludeSet,
  loadSavedRows,
  memberTeamMap,
  mode,
  normalizedFilters,
  page,
  pageResetKey,
  pageSize,
  pushAuditLog,
  rawRows,
  refreshRowHistory,
  registerHeaderRef,
  renderResizeHandle,
  reviewLockMessage,
  rootRef,
  rosterTeams,
  rowDiffMap,
  rowHistoryEntries,
  rowHistoryExpanded,
  rowSaveStatus,
  rules,
  sanitizeRowUpdates,
  selectedKeys,
  setHasUnsaved,
  setPage,
  setRawRows,
  setRowSaveStatus,
  setSelectedKeys,
  shouldUseServerSearch,
  showDeletedRows,
  summarizeLicenseSnapshot,
  syncConfig,
  updatedKeySet,
  visibleColumnCount,
  lastSyncFetched,
  lastSyncInserted,
  lastSyncRangeLabel,
  lastSyncRunAtLabel,
  lastSyncSkipped,
  lastSyncSummary,
  lastSyncTotal,
  lastSyncUpdated,
}) {
  const lastSyncSummaryCard = (
    <DataImporterLastSyncSummaryCard
      visible={Boolean(lastSyncSummary)}
      rangeLabel={lastSyncRangeLabel}
      runAtLabel={lastSyncRunAtLabel}
      fetched={lastSyncFetched}
      inserted={lastSyncInserted}
      updated={lastSyncUpdated}
      skipped={lastSyncSkipped}
      total={lastSyncTotal}
    />
  );

  const {
    serverSearchState,
    setServerSearchState,
    total,
    maxPage,
    safePage,
    pageRows,
    filteredKeys,
  } = useDataImporterResultRows({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    serverSearchMaxPageSize: SERVER_SEARCH_MAX_PAGE_SIZE,
    shouldUseServerSearch,
    normalizedFilters,
    pageResetKey,
    page,
    pageSize,
    rawRows,
    duplicateCounts: duplicate11Summary.counts,
    filterDeclRows,
    fetchWithAuth,
    setPage,
    keyOfRow,
    setSelectedKeys,
    showDeletedRows,
  });

  useEffect(() => {
    if (mode !== "saved") return;

    const pending = rowDiffMap.size > 0;

    setHasUnsaved((prev) => (prev === pending ? prev : pending));
  }, [mode, rowDiffMap, setHasUnsaved]);

  const { handleSaveAll, handleSaveRowChanges } = useDataImporterSavedEdits({
    isReadOnlyForEdits,
    mode,
    actor,
    isAdminRole,
    rowDiffMap,
    reviewLockMessage,
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
  });

  const { handleApplyLicenseExclusion, handleAutoApplyLicenseExclusion } =
    useDataImporterLicenseExclusions({
      mode,
      rawRows,
      rules,
      selectedKeys,
      filteredKeys,
      canEdit,
      canAutoReconcile,
      editingRestrictionMessage,
      ensureEditableKeys,
      filterEditableKeys,
      keyOfRow,
      getLicenseExcludeSetForRow,
      licenseExcludeSet,
      licenseAgencyExcludeMap,
      setRawRows,
      setHasUnsaved,
      normalizeLicenseCode,
      normalizeAgencyKey,
      extractAgencyKeys,
      extractLicenseCodesFromRowObj,
      computeLicenseSnapshot,
      computeKPI,
    });

  useTooltipTitles(rootRef, [
    rawRows,
    filteredKeys,
    selectedKeys,
    coDiscrepancyState,
    syncConfig,
    coCodeConfig,
    coDiscrepancyForm,
    mode,
  ]);

  const {
    selectionEnabled,
    deleteEnabled,
    effectiveCardColumns,
    appliedCardColumns,
    tableResultsProps,
    cardResultsProps,
    selectionActionsProps,
  } = useDataImporterResultsController({
    actor,
    mode,
    canEdit,
    canManageAlerts,
    canReviewAlerts,
    isReadOnlyForEdits,
    shouldUseServerSearch,
    rules,
    rawRows,
    pageRows,
    filteredKeys,
    selectedKeys,
    rowDiffMap,
    rowSaveStatus,
    rowHistoryEntries,
    rowHistoryExpanded,
    updatedKeySet,
    coMismatchKeySet,
    duplicate11KeeperSet,
    duplicate11DuplicatesSet,
    rosterTeams,
    agencyOptions,
    columnHiddenSet,
    columnWidths,
    freezeColumnsEnabled,
    cardGridColumns,
    containerWidth,
    visibleColumnCount,
    handleToggleHistory,
    handleSaveRowChanges,
    summarizeLicenseSnapshot,
    handleMarkReviewed,
    handleUnmarkReviewed,
    handleApplyLicenseExclusion,
    keyOfRow,
    normalizeStr,
    normalizeName,
    editingRestrictionMessage,
    reviewLockMessage,
    blockedEditNoticeRef,
    isRowEditable,
    isRowReviewLocked,
    sanitizeRowUpdates,
    setServerSearchState,
    setHasUnsaved,
    setPage,
    setSelectedKeys,
    setRawRows,
    memberTeamMap,
    ensureEditableKeys,
    ensureHardDeleteKeys,
    filterEditableKeys,
    filterHardDeleteKeys,
    loadSavedRows,
    fetchAlerts,
    softDeleteDeclRows,
    hardDeleteDeclRows,
    restoreDeclRows,
    pushAuditLog,
    xlsx: XLSX,
    toast,
    registerHeaderRef,
    renderResizeHandle,
  });

  return {
    appliedCardColumns,
    cardResultsProps,
    deleteEnabled,
    effectiveCardColumns,
    filteredKeys,
    handleAutoApplyLicenseExclusion,
    handleSaveAll,
    lastSyncSummaryCard,
    maxPage,
    safePage,
    selectionActionsProps,
    selectionEnabled,
    serverSearchState,
    tableResultsProps,
    total,
  };
}
