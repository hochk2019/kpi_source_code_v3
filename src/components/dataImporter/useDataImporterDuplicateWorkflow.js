import { useCallback, useMemo } from "react";

import { buildDuplicateSummary } from "@/components/dataImporter/dataImporterDuplicateSummary.js";
import { prepareDuplicateDiffRow } from "@/components/dataImporter/dataImporterDuplicateDiffPreparation.js";
import { extractRowTimestampDetail } from "@/components/dataImporter/dataImporterDuplicateReviewUtils.js";
import useDataImporterDuplicateDiff from "@/components/dataImporter/useDataImporterDuplicateDiff.js";
import useDataImporterDuplicateReview from "@/components/dataImporter/useDataImporterDuplicateReview.js";
import useDataImporterSavedHighlights from "@/components/dataImporter/useDataImporterSavedHighlights.js";

export default function useDataImporterDuplicateWorkflow({
  rawRows = [],
  keyOfRow,
  lastSyncSummary,
  mode = "saved",
  coMismatchKeySet,
  setSelectedKeys,
  setPage,
  setFilterDuplicate11,
  summarizeLicenseSnapshot,
  coLabel,
  coLineCount,
  createDuplicateDiffGroups,
  formatDeclarationLabel,
  actor = "system",
  isReadOnlyForEdits = false,
  isAdminRole = false,
  editingRestrictionMessage = "",
  duplicateMergeFields = [],
  isRowEditable,
  clearDuplicateReviewFlags,
  applyMergeField,
  sortDeclRows,
  saveDeclRows,
  pushAuditLog,
  loadSavedRows,
  fetchAlerts,
}) {
  const duplicate11Summary = useMemo(
    () => buildDuplicateSummary(rawRows, { keyOfRow }),
    [rawRows, keyOfRow],
  );

  const duplicate11GroupCount = duplicate11Summary.groups;
  const duplicate11TotalRows = duplicate11Summary.totalRows;
  const duplicate11DuplicatesSet = duplicate11Summary.duplicatesSet;
  const duplicate11KeeperSet = duplicate11Summary.keptKeys;
  const duplicate11Details = duplicate11Summary.details;
  const hasDuplicate11Rows = duplicate11Summary.hasDuplicates;

  const {
    lastSyncFetched,
    lastSyncInserted,
    lastSyncUpdated,
    lastSyncSkipped,
    lastSyncTotal,
    updatedDeclarations,
    updatedKeySet,
    updatedPreview,
    showUpdatedBanner,
    handleSelectUpdated,
    handleSelectCoMismatches,
    handleToggleDuplicateFilter,
  } = useDataImporterSavedHighlights({
    lastSyncSummary,
    mode,
    coMismatchKeySet,
    hasDuplicate11Rows,
    setSelectedKeys,
    setPage,
    setFilterDuplicate11,
  });

  const prepareRowForDiff = useCallback(
    (row) =>
      prepareDuplicateDiffRow(row, {
        summarizeLicenseSnapshot,
        coLabel,
        coLineCount,
        extractRowTimestampDetail,
      }),
    [coLabel, coLineCount, summarizeLicenseSnapshot],
  );

  const {
    duplicateDiffState,
    duplicateDiffGroup,
    duplicateDiffBaseItem,
    duplicateDiffCompareItem,
    duplicateDiffGroups,
    duplicateDiffChangedCount,
    duplicateDiffGroupLabel,
    duplicateDiffBaseLabel,
    duplicateDiffCompareLabel,
    handleOpenDuplicateDiff,
    handleCloseDuplicateDiff,
    handleChangeDuplicateDiffBase,
    handleChangeDuplicateDiffCompare,
    handleSwapDuplicateDiff,
    handleDuplicateDiffOpenChange,
  } = useDataImporterDuplicateDiff({
    duplicate11Details,
    createDuplicateDiffGroups,
    prepareRowForDiff,
    formatDeclarationLabel,
  });

  const {
    duplicateReviewOpen,
    duplicateReviewConfirmed,
    duplicate11Plan,
    duplicate11PlanHasActions,
    duplicate11PlannedDeleteGroups,
    duplicate11PlannedReviewGroups,
    duplicate11PlannedRemovalCount,
    setDuplicateReviewConfirmed,
    handleChangeDuplicateKeeper,
    handleChangeDuplicateMerge,
    handleChangeDuplicateResolution,
    handleChangeDuplicateNote,
    handleDeleteDuplicates11,
    handleCloseDuplicateReview,
    handleDuplicateReviewOpenChange,
    handleConfirmDuplicateRemoval,
  } = useDataImporterDuplicateReview({
    actor,
    mode,
    isReadOnlyForEdits,
    isAdminRole,
    duplicate11Details,
    rawRows,
    editingRestrictionMessage,
    duplicateMergeFields,
    keyOfRow,
    isRowEditable,
    clearDuplicateReviewFlags,
    applyMergeField,
    sortDeclRows,
    saveDeclRows,
    pushAuditLog,
    loadSavedRows,
    fetchAlerts,
  });

  return {
    duplicate11Summary,
    duplicate11GroupCount,
    duplicate11TotalRows,
    duplicate11DuplicatesSet,
    duplicate11KeeperSet,
    duplicate11Details,
    hasDuplicate11Rows,
    lastSyncFetched,
    lastSyncInserted,
    lastSyncUpdated,
    lastSyncSkipped,
    lastSyncTotal,
    updatedDeclarations,
    updatedKeySet,
    updatedPreview,
    showUpdatedBanner,
    handleSelectUpdated,
    handleSelectCoMismatches,
    handleToggleDuplicateFilter,
    duplicateDiffState,
    duplicateDiffGroup,
    duplicateDiffBaseItem,
    duplicateDiffCompareItem,
    duplicateDiffGroups,
    duplicateDiffChangedCount,
    duplicateDiffGroupLabel,
    duplicateDiffBaseLabel,
    duplicateDiffCompareLabel,
    handleOpenDuplicateDiff,
    handleCloseDuplicateDiff,
    handleChangeDuplicateDiffBase,
    handleChangeDuplicateDiffCompare,
    handleSwapDuplicateDiff,
    handleDuplicateDiffOpenChange,
    duplicateReviewOpen,
    duplicateReviewConfirmed,
    duplicate11Plan,
    duplicate11PlanHasActions,
    duplicate11PlannedDeleteGroups,
    duplicate11PlannedReviewGroups,
    duplicate11PlannedRemovalCount,
    setDuplicateReviewConfirmed,
    handleChangeDuplicateKeeper,
    handleChangeDuplicateMerge,
    handleChangeDuplicateResolution,
    handleChangeDuplicateNote,
    handleDeleteDuplicates11,
    handleCloseDuplicateReview,
    handleDuplicateReviewOpenChange,
    handleConfirmDuplicateRemoval,
  };
}
